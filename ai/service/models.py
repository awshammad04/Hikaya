"""Request/response models for the Hikaya AI module.

These mirror the JSON structures defined in ``ai/api-contract.md``. Plain
dataclasses are used on purpose: the core story-generation function must be
importable and testable with the standard library alone, without FastAPI or
pydantic installed. ``service/app.py`` adapts them to HTTP.
"""

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

# Audience modes supported by the generator. 'student' and 'tourist' are the two
# required Sprint 2 modes; 'child', 'short' and 'historian' are the extras.
AUDIENCES = ("student", "tourist", "child", "short", "historian", "general")

TONES = ("neutral", "educational", "emotional", "storytelling")

LANGUAGES = ("en", "ar")

# Status values returned in the response envelope.
STATUS_OK = "ok"
STATUS_PARTIAL = "partial"
STATUS_ERROR = "error"

# Error codes. Kept stable because the backend maps them to HTTP statuses.
ERR_MISSING_CONTENT = "missing_content"
ERR_CONTENT_NOT_REVIEWED = "content_not_reviewed"
ERR_UNKNOWN_LOCATION = "unknown_location"
ERR_UNSUPPORTED_AUDIENCE = "unsupported_audience"
ERR_UNSUPPORTED_LANGUAGE = "unsupported_language"
ERR_CONTENT_TOO_LONG = "content_too_long"
ERR_GENERATION_FAILED = "generation_failed"

MAX_INPUT_CHARS = 60000

# Earlier conversation turns kept for a follow-up question.
MAX_HISTORY_TURNS = 6


class ValidationError(Exception):
    """Raised when a request cannot be served at all.

    Carries the contract error code so the caller can return it verbatim.
    """

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class StoryRequest:
    """Input sent by the backend to the AI module.

    Either ``location_id`` or ``historical_text`` must be supplied. When only
    ``location_id`` is given, the reviewed summary is loaded from
    ``content/ai-ready/``; the module never falls back to model world knowledge.
    """

    location_id: Optional[str] = None
    location_name: Optional[str] = None
    governorate_id: Optional[str] = None
    historical_text: Optional[str] = None
    target_audience: str = "general"
    language: str = "en"
    tone: str = "storytelling"
    is_reviewed: bool = True
    max_words: Optional[int] = None

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "StoryRequest":
        if not isinstance(payload, dict):
            raise ValidationError(ERR_MISSING_CONTENT, "Request body must be a JSON object.")
        known = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        return cls(**{k: v for k, v in payload.items() if k in known})

    def validate(self) -> None:
        if self.target_audience not in AUDIENCES:
            raise ValidationError(
                ERR_UNSUPPORTED_AUDIENCE,
                "Unsupported target_audience '%s'. Supported: %s."
                % (self.target_audience, ", ".join(AUDIENCES)),
            )
        if self.language not in LANGUAGES:
            raise ValidationError(
                ERR_UNSUPPORTED_LANGUAGE,
                "Unsupported language '%s'. Supported: %s."
                % (self.language, ", ".join(LANGUAGES)),
            )
        if self.tone not in TONES:
            raise ValidationError(
                ERR_UNSUPPORTED_AUDIENCE,
                "Unsupported tone '%s'. Supported: %s." % (self.tone, ", ".join(TONES)),
            )
        if not self.location_id and not self.historical_text:
            raise ValidationError(
                ERR_MISSING_CONTENT,
                "Either location_id or historical_text is required.",
            )
        if self.historical_text is not None and not self.historical_text.strip():
            raise ValidationError(
                ERR_MISSING_CONTENT,
                "historical_text was provided but is empty.",
            )
        if not self.is_reviewed:
            raise ValidationError(
                ERR_CONTENT_NOT_REVIEWED,
                "Content is not marked as reviewed. The AI module only works from "
                "reviewed content.",
            )
        if self.historical_text and len(self.historical_text) > MAX_INPUT_CHARS:
            raise ValidationError(
                ERR_CONTENT_TOO_LONG,
                "historical_text exceeds the %d character limit." % MAX_INPUT_CHARS,
            )


@dataclass
class SourceInfo:
    """Where the narrative's facts came from - always reported back."""

    location_id: Optional[str] = None
    location_name: Optional[str] = None
    governorate_id: Optional[str] = None
    references: List[Dict[str, str]] = field(default_factory=list)
    content_file: Optional[str] = None
    summary_file: Optional[str] = None
    provided_inline: bool = False


@dataclass
class ModelInfo:
    """Which backend produced the narrative."""

    provider: str = "offline-extractive"
    name: str = "hikaya-extractive-v1"


@dataclass
class StoryResponse:
    """Output returned to the backend."""

    status: str = STATUS_OK
    title: str = ""
    summary: str = ""
    narrative: str = ""
    target_audience: str = "general"
    language: str = "en"
    tone: str = "storytelling"
    word_count: int = 0
    uncertainty_notes: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    source: SourceInfo = field(default_factory=SourceInfo)
    model: ModelInfo = field(default_factory=ModelInfo)
    error: Optional[Dict[str, str]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def error_response(code: str, message: str) -> StoryResponse:
    """Build the contract's error envelope."""
    return StoryResponse(
        status=STATUS_ERROR,
        error={"code": code, "message": message},
    )


@dataclass
class GuideRequest:
    """Input for the Heritage Guide question-answering feature.

    ``history`` carries earlier turns of the same conversation as
    ``{"question": ..., "answer": ...}`` entries, oldest first. It exists so a
    follow-up like "and when was that?" can be resolved against what was just
    discussed. It never becomes a source of facts - answers still come only
    from the reviewed content.
    """

    question: str = ""
    governorate_ids: List[str] = field(default_factory=list)
    location_ids: Optional[List[str]] = None
    location_id: Optional[str] = None
    historical_text: Optional[str] = None
    language: str = "en"
    history: List[Dict[str, str]] = field(default_factory=list)

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "GuideRequest":
        if not isinstance(payload, dict):
            raise ValidationError(ERR_MISSING_CONTENT, "Request body must be a JSON object.")
        known = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        return cls(**{k: v for k, v in payload.items() if k in known})

    def validate(self) -> None:
        if not self.question or not self.question.strip():
            raise ValidationError(ERR_MISSING_CONTENT, "question is required.")
        if self.language not in LANGUAGES:
            raise ValidationError(
                ERR_UNSUPPORTED_LANGUAGE,
                "Unsupported language '%s'." % self.language,
            )
        if len(self.history) > MAX_HISTORY_TURNS:
            # Keeping the tail is enough for pronoun resolution and bounds the
            # prompt an untrusted caller can build.
            self.history = self.history[-MAX_HISTORY_TURNS:]


@dataclass
class GuideResponse:
    sources: List[SourceInfo] = field(default_factory=list)
    citations: List[Dict[str, Any]] = field(default_factory=list)
    status: str = STATUS_OK
    answer: str = ""
    answered_from_source: bool = True
    excerpts: List[str] = field(default_factory=list)
    uncertainty_notes: List[str] = field(default_factory=list)
    source: SourceInfo = field(default_factory=SourceInfo)
    model: ModelInfo = field(default_factory=ModelInfo)
    error: Optional[Dict[str, str]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
