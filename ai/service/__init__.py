"""Hikaya AI module - narrative generation from reviewed heritage content.

Public surface:

    from service import generate_story, StoryRequest

    response = generate_story(StoryRequest(location_id="muslim-quarter",
                                           target_audience="student"))
    print(response.narrative)

See ``ai/README.md`` for how to run it, and ``ai/api-contract.md`` for the JSON
exchanged with the backend.
"""

from .generator import answer_question, generate_story
from .models import (
    GuideRequest,
    GuideResponse,
    StoryRequest,
    StoryResponse,
    ValidationError,
)

__all__ = [
    "answer_question",
    "generate_story",
    "GuideRequest",
    "GuideResponse",
    "StoryRequest",
    "StoryResponse",
    "ValidationError",
]

__version__ = "0.2.0"
