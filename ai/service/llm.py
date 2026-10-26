"""Optional language-model backend.

The AI module works without any API key: :mod:`service.generator` falls back to
a deterministic extractive generator that only ever reuses sentences from the
reviewed source. When a provider key is set, generation goes through the model
instead, under the strict prompts in :mod:`service.prompts`.

Two providers are supported, chosen with ``HIKAYA_AI_PROVIDER``:

* ``gemini`` - ``GEMINI_API_KEY``. Called over plain HTTPS with the standard
  library, so it needs no extra package. ``GEMINI_API_MODE`` may force
  ``developer`` (generativelanguage.googleapis.com) or ``vertex`` (Vertex AI
  Express); by default the Developer API is tried first and Vertex second.
* ``anthropic`` - ``ANTHROPIC_API_KEY`` and the ``anthropic`` package.

Unset (or ``auto``) picks Gemini when its key is present, otherwise Anthropic.
Settings are read on every call so a server can load ``ai/.env`` at startup.

Keeping this behind a narrow interface means the rest of the module has no
provider-specific code in it.
"""

import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from typing import Dict, List, Optional

DEFAULT_MODELS = {"gemini": "gemini-3.5-flash", "anthropic": "claude-sonnet-5-5"}
# Tried when the main Gemini model is overloaded or out of quota for the day.
DEFAULT_GEMINI_FALLBACK = "gemini-3.5-flash-lite"
DEFAULT_MAX_TOKENS = 2800

_GEMINI_HOSTS = {
    "developer": "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent",
    "vertex": "https://aiplatform.googleapis.com/v1/publishers/google/models/%s:generateContent",
}
# The mode that last worked for a Gemini key, so auto-detection runs once.
_working_gemini_mode = {}  # type: Dict[str, str]
# The model that produced the latest reply on this thread (fallbacks included).
_last = threading.local()
_RETRYABLE = (429, 500, 502, 503, 504)


class LLMUnavailable(Exception):
    """Raised when no model backend can be used, with the reason."""


def provider_name():
    # type: () -> Optional[str]
    """The provider requests will go to, or ``None`` when none is configured."""
    choice = os.environ.get("HIKAYA_AI_PROVIDER", "auto").strip().lower()
    if choice == "gemini":
        return "gemini" if os.environ.get("GEMINI_API_KEY") else None
    if choice == "anthropic":
        return "anthropic" if _anthropic_ready() else None
    if os.environ.get("GEMINI_API_KEY"):
        return "gemini"
    if _anthropic_ready():
        return "anthropic"
    return None


def model_name():
    # type: () -> str
    provider = provider_name() or "gemini"
    configured = os.environ.get("HIKAYA_AI_MODEL", "").strip()
    # A model name for the other provider (e.g. claude-* with a Gemini key) is
    # a leftover setting, not something the configured API can serve.
    other = "claude" if provider == "gemini" else "gemini"
    if configured and not configured.lower().startswith(other):
        return configured
    return DEFAULT_MODELS[provider]


def used_model():
    # type: () -> str
    """The model that answered the last :func:`complete` call on this thread."""
    return getattr(_last, "model", None) or model_name()


def is_configured():
    # type: () -> bool
    """True when a provider key is present (and, for Anthropic, its SDK)."""
    return provider_name() is not None


def _anthropic_ready():
    # type: () -> bool
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


def complete(system_prompt, user_prompt, max_tokens=None, temperature=0.4):
    # type: (str, str, Optional[int], float) -> str
    """Send one prompt to the configured model and return the text of the reply."""
    provider = provider_name()
    if provider == "gemini":
        return _complete_gemini(system_prompt, user_prompt, max_tokens, temperature)
    if provider == "anthropic":
        return _complete_anthropic(system_prompt, user_prompt, max_tokens, temperature)
    raise LLMUnavailable("No AI provider is configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY).")


# ---------------------------------------------------------------------------
# Gemini
# ---------------------------------------------------------------------------

def _complete_gemini(system_prompt, user_prompt, max_tokens, temperature):
    # type: (str, str, Optional[int], float) -> str
    key = os.environ.get("GEMINI_API_KEY", "")
    models = [model_name()]
    fallback = os.environ.get("HIKAYA_AI_FALLBACK_MODEL", DEFAULT_GEMINI_FALLBACK)
    if fallback and fallback.lower() != "none" and fallback not in models:
        models.append(fallback)
    body = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            # Thinking models spend part of this budget before answering, so the
            # ceiling is kept well above the length of the longest narrative.
            "maxOutputTokens": max(max_tokens or 0, 8192),
        },
    }
    deadline = time.time() + float(os.environ.get("HIKAYA_AI_TIMEOUT_S", "120"))
    last_error = "no attempt made"
    for model in models:
        for attempt in range(3):
            remaining = deadline - time.time()
            if remaining < 5:
                raise LLMUnavailable("Model call timed out: %s" % last_error)
            try:
                data = _post_gemini(key, model, body, remaining)
            except _RetryableError as exc:
                last_error = str(exc)
                # A daily quota will not recover within this request; move on.
                if exc.daily or attempt == 2:
                    break
                time.sleep(min(2.0 * (attempt + 1), max(0.0, deadline - time.time() - 5)))
                continue
            except _FatalError as exc:
                raise LLMUnavailable("Model call failed: %s" % exc)
            _last.model = model
            return _gemini_text(data)
    raise LLMUnavailable("Model call failed after retries: %s" % last_error)


class _RetryableError(Exception):
    def __init__(self, message, daily=False):
        # type: (str, bool) -> None
        Exception.__init__(self, message)
        self.daily = daily


class _FatalError(Exception):
    pass


def _gemini_modes(key):
    # type: (str) -> List[str]
    forced = os.environ.get("GEMINI_API_MODE", "").strip().lower()
    if forced in _GEMINI_HOSTS:
        return [forced]
    known = _working_gemini_mode.get(key)
    if known:
        return [known]
    return ["developer", "vertex"]


def _post_gemini(key, model, body, timeout):
    # type: (str, str, dict, float) -> dict
    modes = _gemini_modes(key)
    for index, mode in enumerate(modes):
        request = urllib.request.Request(
            _GEMINI_HOSTS[mode] % model,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": key},
        )
        try:
            with urllib.request.urlopen(request, timeout=min(timeout, 90)) as response:
                data = json.loads(response.read().decode("utf-8"))
            _working_gemini_mode[key] = mode
            return data
        except urllib.error.HTTPError as exc:
            detail = _error_message(exc)
            # A key minted for the other API comes back as 401/403; try the
            # other host before giving up on the key.
            if exc.code in (401, 403) and index + 1 < len(modes):
                continue
            if exc.code in _RETRYABLE:
                raise _RetryableError("%s %s" % (exc.code, detail),
                                      daily=exc.code == 429 and "PerDay" in detail)
            raise _FatalError("%s %s" % (exc.code, detail))
        except (urllib.error.URLError, OSError, ValueError) as exc:
            raise _RetryableError(str(exc))
    raise _FatalError("the key was rejected by both Gemini APIs")


def _error_message(exc):
    # type: (urllib.error.HTTPError) -> str
    """The API's message plus any quota id (e.g. ...PerDay...FreeTier)."""
    try:
        error = json.loads(exc.read().decode("utf-8"))["error"]
    except Exception:  # noqa: BLE001 - only used for messages
        return str(exc.reason or "")
    quotas = [
        violation.get("quotaId", "")
        for detail in error.get("details", [])
        for violation in detail.get("violations", [])
    ]
    message = error.get("message", "")[:200]
    return "%s [%s]" % (message, ", ".join(quotas)) if quotas else message


def _gemini_text(data):
    # type: (dict) -> str
    candidates = data.get("candidates") or []
    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates")
        raise LLMUnavailable("Model returned no answer (%s)." % reason)
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(part.get("text", "") for part in parts if not part.get("thought"))
    if not text.strip():
        raise LLMUnavailable(
            "Model returned an empty response (%s)." % candidates[0].get("finishReason", "unknown")
        )
    return text


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------

def _complete_anthropic(system_prompt, user_prompt, max_tokens, temperature):
    # type: (str, str, Optional[int], float) -> str
    try:
        import anthropic
    except ImportError:
        raise LLMUnavailable(
            "The 'anthropic' package is not installed. Run: pip install -r ai/requirements.txt"
        )

    client = anthropic.Anthropic(timeout=120.0, max_retries=0)
    _last.model = model_name()
    try:
        # No temperature: current Claude models reject it as deprecated.
        message = client.messages.create(
            model=model_name(),
            max_tokens=max_tokens or DEFAULT_MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except Exception as exc:  # network, auth, rate limit - all handled the same way
        raise LLMUnavailable("Model call failed: %s" % exc)

    text = "".join(
        block.text for block in message.content if getattr(block, "type", "") == "text"
    )
    if not text.strip():
        raise LLMUnavailable("Model returned an empty response.")
    return text


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def parse_labelled_blocks(text, labels):
    # type: (str, List[str]) -> Dict[str, str]
    """Split a reply of the form ``LABEL: value`` into a dict.

    A block runs until the next known label, so multi-line narratives survive.
    Labels the model omitted come back as empty strings.
    """
    pattern = r"^\**(%s)\**\s*:\s*\**" % "|".join(re.escape(label) for label in labels)
    label_re = re.compile(pattern, re.MULTILINE)

    matches = list(label_re.finditer(text))
    result = dict((label, "") for label in labels)
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        result[match.group(1)] = text[start:end].strip()
    return result


def load_env_file(path=None):
    # type: (Optional[str]) -> None
    """Load ``KEY=value`` lines from ``ai/.env`` without overriding real env vars.

    Only the server entry points call this; importing the library (as the tests
    do) never reads a local key file.
    """
    path = path or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.isfile(path):
        return
    with open(path, "r", encoding="utf8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
