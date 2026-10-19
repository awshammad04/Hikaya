"""Audience modes for story generation.

Sprint 2 requires at least ``student`` and ``tourist``; ``child``, ``short`` and
``historian`` are the extra modes. ``general`` is the balanced default.

Each mode carries both the instruction given to a language model and the shape
used by the offline extractive generator, so the two backends produce
recognisably similar output.
"""

import re
from typing import Dict, List, NamedTuple


class AudienceMode(NamedTuple):
    key: str
    label: str
    # Instruction inserted into the LLM prompt.
    style: str
    # Target length band for the narrative, in words.
    min_words: int
    max_words: int
    # Which parts of the reviewed summary the offline generator draws on,
    # in the order they appear in the narrative.
    sections: List[str]
    # How many timeline entries / landmarks / facts the offline generator uses.
    timeline_items: int
    landmark_items: int
    fact_items: int


MODES = {
    "student": AudienceMode(
        key="student",
        label="Student",
        style=(
            "Write a structured learning narrative, not a generic travel description. "
            "Use the following visible structure: Orientation; Historical sequence; "
            "Architecture and material evidence; Why it matters; Key takeaway. Explain "
            "cause and effect between periods, retain every useful date in the source, "
            "and define architectural terms in plain language. End with a compact "
            "three-point takeaway. Address the student as an active observer who should "
            "compare evidence, not simply memorise names."
        ),
        min_words=420,
        max_words=650,
        sections=["overview", "timeline", "landmarks", "facts", "importance", "takeaway"],
        timeline_items=10,
        landmark_items=6,
        fact_items=6,
    ),
    "tourist": AudienceMode(
        key="tourist",
        label="Tourist",
        style=(
            "Write as an immersive, on-site Palestinian walking guide. Open with spatial "
            "orientation ('as you stand here', 'look toward', 'look above'). Lead the "
            "visitor through a coherent sequence of stops. Point out arches, stonework, "
            "inscriptions, paving, doors, vaults and changes of level only when supported "
            "by the source. Weave in documented sounds, scents, crafts and market life. "
            "Include practical, respectful guidance about access, worship and residents. "
            "Use second person throughout and finish with one final detail to pause over."
        ),
        min_words=500,
        max_words=750,
        sections=["walkthrough", "overview", "landmarks", "oral_heritage", "importance"],
        timeline_items=6,
        landmark_items=8,
        fact_items=6,
    ),
    "child": AudienceMode(
        key="child",
        label="Child-friendly",
        style=(
            "Speak directly to a child aged about 8 to 11 as a warm Jerusalem storyteller. "
            "Build a gentle journey with a beginning, two or three discoveries, and a "
            "closing question. Use short sentences, familiar words and sensory comparisons "
            "about colour, texture, light, sound and scent, but only where the source gives "
            "the sensory basis. Explain one unfamiliar word at a time. Invite curiosity "
            "with phrases such as 'Can you spot...?' Never use academic jargon, political "
            "argument, frightening detail, or invented characters and dialogue."
        ),
        min_words=240,
        max_words=360,
        sections=["walkthrough", "oral_heritage", "landmarks", "overview", "facts"],
        timeline_items=2,
        landmark_items=3,
        fact_items=3,
    ),
    "short": AudienceMode(
        key="short",
        label="Short summary",
        style=(
            "Write exactly 3 to 5 punchy sentences. Sentence 1 identifies the place and "
            "its Palestinian setting; sentence 2 gives the decisive historical layer; "
            "sentence 3 identifies the detail a visitor should notice. Use sentence 4 "
            "for living cultural significance and sentence 5 only for a documented "
            "caution or absence. No headings, bullet points, scene-setting or repetition."
        ),
        min_words=60,
        max_words=100,
        sections=["overview", "facts"],
        timeline_items=2,
        landmark_items=2,
        fact_items=3,
    ),
    "historian": AudienceMode(
        key="historian",
        label="Historian",
        style=(
            "Write a scholarly site history for a specialist. Use explicit chronological "
            "periodisation and distinguish surviving fabric, later restoration, archival "
            "record, waqf evidence, archaeology, religious tradition and oral testimony. "
            "Analyse inscriptions, portals, masonry, archaeological layers, endowed urban "
            "institutions and municipal or socio-political change wherever the source "
            "supports them. State exact dates and named historical figures from the record. "
            "Make evidentiary limits visible in the prose. Do not flatten the account into "
            "a tourism summary and do not simplify contested or displaced urban history."
        ),
        min_words=650,
        max_words=950,
        sections=["timeline", "overview", "facts", "landmarks", "importance", "traditions", "oral_heritage", "walkthrough"],
        timeline_items=12,
        landmark_items=5,
        fact_items=6,
    ),
    "general": AudienceMode(
        key="general",
        label="General audience",
        style=(
            "Write a substantial but accessible cultural narrative for an adult reader. "
            "Balance chronology, architecture, living Palestinian community life and "
            "practical observation. Avoid both academic compression and tourism clichés."
        ),
        min_words=380,
        max_words=600,
        sections=["overview", "timeline", "landmarks", "importance", "oral_heritage", "walkthrough"],
        timeline_items=8,
        landmark_items=6,
        fact_items=5,
    ),
}

# Words the child mode must not carry through from the source. Matched on whole
# words only, so "war" does not trigger on "warm" and "exile" does not trigger
# on "exiled" unless that form is listed.
CHILD_UNSAFE_TERMS = (
    "attack", "attacked", "attacks",
    "besieged", "siege", "sieges",
    "conquer", "conquered", "conquest",
    "crusade", "crusader", "crusaders",
    "defensive", "defences", "defense", "defenses",
    "deport", "deported", "deportation",
    "destroy", "destroyed", "destruction",
    "exile", "exiled",
    "kill", "killed", "killing", "killings",
    "massacre", "massacres",
    "militarily", "military",
    "occupation", "occupied", "occupy",
    "revolt", "revolts", "revolution",
    "violence", "violent",
    "war", "wars", "warfare",
)

_UNSAFE_RE = re.compile(
    r"\b(?:%s)\b" % "|".join(sorted(CHILD_UNSAFE_TERMS, key=len, reverse=True)),
    re.IGNORECASE,
)


def unsafe_terms_in(text):
    # type: (str) -> List[str]
    """Whole-word matches of the child-unsafe vocabulary, de-duplicated."""
    return sorted({match.group(0).lower() for match in _UNSAFE_RE.finditer(text)})


def has_unsafe_terms(text):
    # type: (str) -> bool
    return bool(_UNSAFE_RE.search(text))


TONE_STYLE = {
    "neutral": "Keep the tone plain and factual.",
    "educational": "Keep the tone explanatory, as a teacher would.",
    "emotional": "Allow warmth and feeling in the telling, without overstating.",
    "storytelling": "Tell it as a story, with a natural flow between periods.",
}


def get(audience):
    # type: (str) -> AudienceMode
    """Return the mode definition, defaulting to ``general``."""
    return MODES.get(audience, MODES["general"])


def describe():
    # type: () -> Dict[str, str]
    """Machine-readable list of modes, used by the service ``/modes`` endpoint."""
    return dict((key, mode.label) for key, mode in MODES.items())
