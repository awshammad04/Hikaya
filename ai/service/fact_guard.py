"""Step 6 of the narrative workflow: the fact-guard check.

After a narrative is produced, this module compares it against the reviewed
source and reports anything that looks invented - a year, a number, or a proper
noun that does not appear in the source at all. It is a lightweight heuristic,
not a proof: it exists to catch the obvious cases and to give a human reviewer
something concrete to look at.

Findings become ``warnings`` in the response. They never silently rewrite the
narrative.
"""

import re
from typing import List, Set

from . import audiences

# Capitalised words that routinely start a sentence and are not proper nouns.
_COMMON_STARTERS = {
    "a", "after", "all", "an", "and", "archaeologists", "archaeology", "around", "as",
    "at", "be", "because", "before", "both", "but", "by", "come", "control", "during",
    "each", "even", "every", "everything", "for", "from", "here", "his", "how", "if",
    "in", "inside", "into", "it", "its", "later", "local", "many", "more", "most",
    "much", "never", "next", "no", "not", "nothing", "now", "of", "on", "once", "one",
    "only", "or", "other", "over", "people", "she", "since", "so", "some", "step",
    "stone", "than", "that", "the", "their", "then", "there", "these", "they", "this",
    "those", "through", "to", "today", "twelve", "two", "under", "until", "up", "walk",
    "was", "were", "what", "when", "where", "which", "while", "who", "why", "with",
    "yet", "you", "your",
    # Connective headings written by the extractive generator. They carry no
    # historical content, so they must not be reported as invented entities.
    "a few facts", "main landmarks", "things to look for", "visiting", "worth",
    "things", "main", "facts", "historical", "chronology", "living",
    "attributed", "key", "takeaway",
}

_NUMBER_RE = re.compile(r"\b\d[\d,.]*\b")
_ENTITY_RE = re.compile(r"\b[A-Z][a-z'’\-]+(?:\s+(?:of|the|al|ibn|bin)\s+)?(?:\s?[A-Z][a-z'’\-]+)*")


def _normalise(text):
    # type: (str) -> str
    return re.sub(r"\s+", " ", text.replace("’", "'")).lower()


def extract_numbers(text):
    # type: (str) -> Set[str]
    """Numbers and years, with thousands separators removed."""
    return set(match.group(0).replace(",", "").rstrip(".") for match in _NUMBER_RE.finditer(text))


def extract_entities(text):
    # type: (str) -> Set[str]
    """Capitalised words and phrases that look like proper nouns."""
    found = set()
    for match in _ENTITY_RE.finditer(text):
        token = match.group(0).strip()
        if len(token) < 3:
            continue
        if token.lower() in _COMMON_STARTERS:
            continue
        found.add(token)
    return found


def check_narrative(narrative, source_text):
    # type: (str, str) -> List[str]
    """Return one warning per element of ``narrative`` missing from ``source_text``."""
    warnings = []  # type: List[str]
    source_norm = _normalise(source_text)
    source_numbers = extract_numbers(source_text)

    for number in sorted(extract_numbers(narrative)):
        if number not in source_numbers:
            warnings.append(
                "unsupported_number: '%s' appears in the narrative but not in the "
                "reviewed source." % number
            )

    for entity in sorted(extract_entities(narrative)):
        if _normalise(entity) not in source_norm:
            warnings.append(
                "unsupported_entity: '%s' appears in the narrative but not in the "
                "reviewed source." % entity
            )

    return warnings


def check_child_safety(narrative):
    # type: (str) -> List[str]
    """Flag material that should not reach the child-friendly mode."""
    hits = audiences.unsafe_terms_in(narrative)
    if not hits:
        return []
    return [
        "child_mode_sensitive_content: the narrative mentions %s; review before "
        "showing it to children." % ", ".join("'%s'" % term for term in hits)
    ]


def check(narrative, source_text, audience="general"):
    # type: (str, str, str) -> List[str]
    """Run every applicable guard and return the combined warnings."""
    warnings = check_narrative(narrative, source_text)
    if audience == "child":
        warnings.extend(check_child_safety(narrative))
    return warnings
