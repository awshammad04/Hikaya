"""Heritage Guide answers grounded on whole reviewed records.

The reviewed corpus is small (a few thousand words per place), so instead of
retrieving three keyword-matched sentences the model is given every reviewed
record in the question's scope - English and Arabic sections together - and is
asked to answer only from them, name the record it used, and quote the passage
it relied on. The quote is then checked against the records before it is shown
as a citation, and the answer goes through the same fact guard as stories.

Keyword retrieval (:mod:`service.retrieval`) remains the offline fallback.
"""

import re
from typing import Callable, Dict, List, Optional, Tuple

from . import fact_guard, llm, prompts, retrieval
from .content_loader import ReviewedContent
from .models import STATUS_OK, STATUS_PARTIAL, GuideRequest, GuideResponse, ModelInfo, SourceInfo

_ENGLISH_SECTIONS = (
    ("overview", "Overview", "fact"),
    ("timeline", "Historical timeline", "fact"),
    ("importance", "Cultural and religious importance", "fact"),
    ("landmarks", "Main landmarks", "fact"),
    ("facts", "Important facts", "fact"),
    ("walkthrough", "Visitor walkthrough", "fact"),
    ("traditions", "Religious traditions - attribute, never assert as fact", "tradition"),
    ("oral_heritage", "Oral heritage - attribute, never assert as fact", "oral_heritage"),
    ("source_notes", "Source notes, including gaps that must not be filled", "fact"),
)
_ARABIC_SECTIONS = (
    ("arabic_overview", "Arabic overview", "fact"),
    ("arabic_history", "Arabic history", "fact"),
    ("arabic_importance", "Arabic importance", "fact"),
    ("arabic_landmarks", "Arabic landmarks", "fact"),
    ("arabic_guide", "Arabic guide text", "fact"),
    ("arabic_traditions", "Arabic religious traditions - attribute, never assert as fact", "tradition"),
)
_LANGUAGE_NAMES = {"ar": "Arabic", "en": "English"}
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


class Record(object):
    """One reviewed place, flattened into labelled sections for the prompt."""

    def __init__(self, location_id, name, arabic_name, source, sections):
        # type: (str, str, str, SourceInfo, List[Tuple[str, str, str, str]]) -> None
        self.location_id = location_id
        self.name = name
        self.arabic_name = arabic_name
        self.source = source
        # (section key, label, content type, body)
        self.sections = sections

    def text(self):
        # type: () -> str
        names = " / ".join(item for item in (self.name, self.arabic_name) if item)
        parts = ["=== RECORD %s: %s ===" % (self.location_id, names)]
        for _, label, _, body in self.sections:
            parts.append("### %s\n%s" % (label, body))
        return "\n\n".join(parts)


def build_record(content, source, catalog_item=None):
    # type: (ReviewedContent, SourceInfo, Optional[dict]) -> Record
    """Combine a summary file with any source-checked Arabic catalog fields."""
    sections = []  # type: List[Tuple[str, str, str, str]]
    for key, label, content_type in _ENGLISH_SECTIONS + _ARABIC_SECTIONS:
        body = content.section(key).strip()
        if body:
            sections.append((key, label, content_type, body))
    if catalog_item:
        for key, label, value in (
            ("catalog_ar_overview", "Arabic overview (catalog)", catalog_item.get("arabicDescription")),
            ("catalog_ar_facts", "Arabic facts (catalog)", catalog_item.get("arabicFacts")),
            ("catalog_ar_importance", "Arabic importance (catalog)", catalog_item.get("arabicImportance")),
            ("catalog_ar_landmarks", "Arabic landmarks (catalog)",
             "\n".join("- " + item for item in catalog_item.get("arabicLandmarks") or [])),
            ("catalog_ar_walkthrough", "Arabic walkthrough (catalog)", catalog_item.get("arabicWalkthrough")),
            ("catalog_ar_timeline", "Arabic timeline (catalog)", "\n".join(
                "- %s: %s" % (event.get("label", ""), event.get("arabicDescription", ""))
                for event in catalog_item.get("timeline") or [] if event.get("arabicDescription"))),
        ):
            if value and value.strip():
                sections.append((key, label, "fact", value.strip()))
        if catalog_item.get("arabicTraditions"):
            sections.append(("catalog_ar_traditions",
                             "Arabic religious traditions (catalog) - attribute, never assert as fact",
                             "tradition", catalog_item["arabicTraditions"].strip()))
    return Record(content.location_id, content.name, content.arabic_name, source, sections)


def inline_record(text, source):
    # type: (str, SourceInfo) -> Record
    return Record(source.location_id or "provided-text", source.location_name or "Provided text", "",
                  source, [("provided", "Provided reviewed text", "fact", text.strip())])


def answer(request, records, scope_label, not_in_records):
    # type: (GuideRequest, List[Record], str, Callable[[str], str]) -> GuideResponse
    """Ask the configured model; raises :class:`llm.LLMUnavailable` on failure."""
    corpus = "\n\n".join(record.text() for record in records)
    raw = llm.complete(
        prompts.GUIDE_SYSTEM_PROMPT,
        prompts.build_guide_prompt(
            corpus, scope_label, request.question,
            _LANGUAGE_NAMES.get(request.language, request.language),
            history=request.history,
        ),
        max_tokens=1200,
        temperature=0.2,
    )
    blocks = llm.parse_labelled_blocks(raw, ["ANSWER", "FROM_SOURCE", "EXCERPT", "RECORD"])
    text = _clean_answer(blocks["ANSWER"])
    from_source = blocks["FROM_SOURCE"].strip().upper().startswith("Y") and bool(text)
    model = ModelInfo(provider=llm.provider_name(), name=llm.used_model())

    if not from_source:
        return GuideResponse(
            status=STATUS_OK,
            answer=text or not_in_records(request.language),
            answered_from_source=False,
            uncertainty_notes=[not_in_records(request.language)],
            source=records[0].source if len(records) == 1 else SourceInfo(),
            model=model,
        )

    cited = _find_record(records, blocks["RECORD"])
    excerpt = _clean_excerpt(blocks["EXCERPT"])
    citation = _locate_excerpt(records, cited, excerpt) if excerpt else None
    if citation is None and cited is None and len(records) == 1:
        cited = records[0]
    if citation is not None:
        cited = citation[0]

    notes = []  # type: List[str]
    warnings = fact_guard.check_narrative(text.translate(_ARABIC_DIGITS), corpus,
                                          arabic_vocabulary=False)
    if warnings:
        notes.append(
            "بعض التفاصيل في هذه الإجابة لم تُطابَق حرفياً مع السجلات المراجعة؛ يُرجى التحقق منها."
            if request.language == "ar" else
            "Some details in this answer could not be matched word for word to the reviewed "
            "records; check them before relying on them."
        )

    citations = []  # type: List[dict]
    if citation is not None:
        record, section_key, content_type, matched = citation
        citations.append({
            "location_id": record.location_id,
            "location_name": record.name,
            "section": section_key,
            "content_type": content_type,
            "language": "ar" if retrieval.has_arabic(matched) else "en",
            "excerpt": matched,
            "references": record.source.references,
        })
    sources = [cited.source] if cited is not None else []
    return GuideResponse(
        status=STATUS_PARTIAL if warnings else STATUS_OK,
        answer=text,
        answered_from_source=True,
        excerpts=[item["excerpt"] for item in citations],
        citations=citations,
        sources=sources,
        source=sources[0] if sources else SourceInfo(),
        uncertainty_notes=notes,
        model=model,
    )


def _clean_answer(text):
    # type: (str) -> str
    text = re.sub(r"\*\*|__", "", text or "").strip()
    return re.sub(r"\n{3,}", "\n\n", text)


def _clean_excerpt(text):
    # type: (str) -> str
    text = (text or "").strip().strip('"“”«»\'').strip()
    return "" if text.upper() in ("", "NONE", "N/A") else text


def _find_record(records, value):
    # type: (List[Record], str) -> Optional[Record]
    value = (value or "").strip().strip("`*").lower()
    for record in records:
        if record.location_id.lower() == value or value.endswith(record.location_id.lower()):
            return record
    return None


def _normalise(text):
    # type: (str) -> str
    text = retrieval.normalize_arabic(text.translate(_ARABIC_DIGITS))
    text = re.sub(r"[|*_`\"“”«»'’…]+", " ", text)
    text = re.sub(r"[–—]", "-", text)
    return re.sub(r"\s+", " ", text).strip(" .،,;:-")


def _locate_excerpt(records, preferred, excerpt):
    # type: (List[Record], Optional[Record], str) -> Optional[Tuple[Record, str, str, str]]
    """Find the section that really contains the quoted passage.

    An exact (normalised) match is accepted; otherwise the most similar source
    sentence is used if it shares at least 70% of the quote's words. Anything
    looser is treated as unverified and not shown as a citation.
    """
    wanted = _normalise(excerpt)
    if len(wanted) < 12:
        return None
    ordered = ([preferred] if preferred else []) + [r for r in records if r is not preferred]
    for record in ordered:
        for key, _, content_type, body in record.sections:
            if wanted in _normalise(body):
                return record, key, content_type, excerpt
    wanted_words = set(wanted.split())
    best = None  # type: Optional[Tuple[float, Record, str, str, str]]
    for record in ordered:
        for key, _, content_type, body in record.sections:
            for sentence in re.split(r"(?<=[.!?؟])\s+|\n+", body):
                words = set(_normalise(sentence).split())
                if not words:
                    continue
                overlap = len(wanted_words & words) / float(len(wanted_words))
                if best is None or overlap > best[0]:
                    best = (overlap, record, key, content_type, sentence.strip(" |-"))
    if best and best[0] >= 0.7:
        return best[1], best[2], best[3], best[4]
    return None
