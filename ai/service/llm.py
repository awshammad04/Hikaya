"""Optional language-model backend.

The AI module works without any API key: :mod:`service.generator` falls back to
a deterministic extractive generator that only ever reuses sentences from the
reviewed source. When ``ANTHROPIC_API_KEY`` is set and the ``anthropic`` package
is installed, generation goes through the model instead, under the strict
prompts in :mod:`service.prompts`.

Keeping this behind a narrow interface means the rest of the module has no
provider-specific code in it.
"""

import os
import re
from typing import Dict, List, Optional

DEFAULT_MODEL = os.environ.get("HIKAYA_AI_MODEL", "claude-sonnet-5")
DEFAULT_MAX_TOKENS = int(os.environ.get("HIKAYA_AI_MAX_TOKENS", "2800"))

PROVIDER_NAME = "anthropic"


class LLMUnavailable(Exception):
    """Raised when no model backend can be used, with the reason."""


def is_configured():
    # type: () -> bool
    """True when an API key is present and the SDK is importable."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


def complete(system_prompt, user_prompt, max_tokens=None, temperature=0.4):
    # type: (str, str, Optional[int], float) -> str
    """Send one prompt to the model and return the text of the reply."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise LLMUnavailable("ANTHROPIC_API_KEY is not set.")
    try:
        import anthropic
    except ImportError:
        raise LLMUnavailable(
            "The 'anthropic' package is not installed. Run: pip install -r ai/requirements.txt"
        )

    client = anthropic.Anthropic(timeout=120.0, max_retries=0)
    try:
        message = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=max_tokens or DEFAULT_MAX_TOKENS,
            temperature=temperature,
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


def parse_labelled_blocks(text, labels):
    # type: (str, List[str]) -> Dict[str, str]
    """Split a reply of the form ``LABEL: value`` into a dict.

    A block runs until the next known label, so multi-line narratives survive.
    Labels the model omitted come back as empty strings.
    """
    pattern = r"^(%s)\s*:\s*" % "|".join(re.escape(label) for label in labels)
    label_re = re.compile(pattern, re.MULTILINE)

    matches = list(label_re.finditer(text))
    result = dict((label, "") for label in labels)
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        result[match.group(1)] = text[start:end].strip()
    return result
