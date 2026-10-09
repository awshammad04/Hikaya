"""The Hikaya AI story generation function.

This is the Sprint 2 implementation of the workflow documented in
``ai/narrative-generation-workflow.md``. The entry points are:

    generate_story(StoryRequest)  -> StoryResponse
    answer_question(GuideRequest) -> GuideResponse

Both refuse to work from anything except reviewed content. There are two
generation backends:

* **model backend** - used when ``ANTHROPIC_API_KEY`` is set, under the strict
  no-invention prompts in :mod:`service.prompts`;
* **offline extractive backend** - the default. It composes the narrative out of
  sentences taken from the reviewed summary itself, so it cannot invent a fact
  by construction. It is what makes the module testable, reproducible and
  runnable with no credentials, which is what the examples in ``ai/examples/``
  were produced with.

Either way the output goes through the fact guard before being returned.
"""

import re
import os
from typing import List, Optional

from . import audiences, content_loader, fact_guard, llm, prompts, textutils
from .content_loader import ReviewedContent
from .models import (
    ERR_GENERATION_FAILED,
    ERR_UNKNOWN_LOCATION,
    STATUS_OK,
    STATUS_PARTIAL,
    GuideRequest,
    GuideResponse,
    ModelInfo,
    SourceInfo,
    StoryRequest,
    StoryResponse,
    ValidationError,
    error_response,
)

OFFLINE_MODEL = ModelInfo(provider="offline-extractive", name="hikaya-extractive-v1")

_NOT_IN_RECORDS = (
    "This information is not available in the reviewed records for this location yet."
)


def _not_in_records(language):
    # type: (str) -> str
    if language == "ar":
        return "هذه المعلومة غير متاحة بعد في السجلات المراجعة لهذا المكان، لذلك لن أخمّن."
    if language == "fr":
        return "Cette information ne figure pas encore dans les sources relues pour ce lieu."
    return _NOT_IN_RECORDS


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

def generate_story(request, content_dir=None):
    # type: (StoryRequest, Optional[str]) -> StoryResponse
    """Turn reviewed content into a simplified narrative for one audience."""
    try:
        request.validate()
    except ValidationError as exc:
        return error_response(exc.code, exc.message)

    try:
        content, source = _resolve_source(request, content_dir)
    except ValidationError as exc:
        return error_response(exc.code, exc.message)

    mode = audiences.get(request.target_audience)
    source_text = content.prompt_text() if content else (request.historical_text or "")
    fact_text = content.factual_text() if content else (request.historical_text or "")
    location_name = (
        request.location_name
        or (content.name if content else None)
        or (request.location_id or "this location")
    )

    if llm.is_configured():
        result = _generate_with_model(
            request, content, source_text, location_name, mode
        )
    else:
        result = _generate_offline(request, content, location_name, mode)

    if result is None:
        return error_response(
            ERR_GENERATION_FAILED,
            "The narrative could not be generated from the reviewed content.",
        )

    title, summary, narrative, notes, model_info = result
    if content and content.governorate_id != 'jerusalem' and request.language == 'ar':
        for old, new in [('A few facts:', 'حقائق موثّقة:'), ('Chronology:', 'التسلسل الزمني:'), ('Historical sequence:', 'التسلسل التاريخي:'), ('Attributed traditions:', 'تقاليد منسوبة:'), ('Key takeaway:', 'خلاصة:'), ('Main landmarks:', 'المعالم:'), ('Things to look for:', 'ما يوثقه السجل:'), ('A gentle discovery:', 'اكتشاف مبسّط:')]:
            narrative = narrative.replace(old, new)
        title = content.name

    warnings = fact_guard.check(
        narrative,
        # The guard checks against everything the model was allowed to see.
        source_text or fact_text,
        audience=request.target_audience,
    )

    # 'partial' means the fact guard found something a reviewer should look at.
    # Uncertainty notes on their own do not downgrade the status: they are the
    # module doing its job, not a defect in the output.
    return StoryResponse(
        status=STATUS_PARTIAL if warnings else STATUS_OK,
        title=title,
        summary=summary,
        narrative=narrative,
        target_audience=request.target_audience,
        language=request.language,
        tone=request.tone,
        word_count=textutils.word_count(narrative),
        uncertainty_notes=notes,
        warnings=warnings,
        source=source,
        model=model_info,
    )


def answer_question(request, content_dir=None):
    # type: (GuideRequest, Optional[str]) -> GuideResponse
    """Answer a visitor's question using only the reviewed content."""
    try:
        request.validate()
    except ValidationError as exc:
        response = GuideResponse()
        response.status = "error"
        response.error = {"code": exc.code, "message": exc.message}
        return response

    if request.governorate_ids or request.location_ids:
        from .scope import resolve_ids
        try:
            ids = resolve_ids(request.governorate_ids, [request.location_id] if request.location_id else request.location_ids, content_dir)
        except ValidationError as exc:
            return GuideResponse(status='error', answered_from_source=False, error={'code':exc.code, 'message':exc.message})
        answers = [answer_question(GuideRequest(question=request.question, location_id=id, language=request.language, history=request.history), content_dir) for id in ids]
        supported = [answer for answer in answers if answer.answered_from_source and not answer.error]
        return GuideResponse(answer='\n\n'.join(answer.source.location_name+': '+answer.answer for answer in supported) if supported else _not_in_records(request.language),
                             answered_from_source=bool(supported), excerpts=[excerpt for answer in supported for excerpt in answer.excerpts],
                             sources=[answer.source for answer in supported],
                             uncertainty_notes=[] if supported else [_not_in_records(request.language)], model=OFFLINE_MODEL)

    story_like = StoryRequest(
        location_id=request.location_id,
        historical_text=request.historical_text,
        language=request.language,
    )
    try:
        content, source = _resolve_source(story_like, content_dir)
    except ValidationError as exc:
        response = GuideResponse()
        response.status = "error"
        response.error = {"code": exc.code, "message": exc.message}
        return response

    source_text = content.prompt_text() if content else (request.historical_text or "")
    location_name = (content.name if content else None) or request.location_id or "this location"

    # Offline retrieval searches the content itself, not the source notes: the
    # notes describe what is *missing*, and matching against them would let the
    # guide "answer" precisely the questions the records cannot answer.
    if content is not None:
        retrieval_text = "\n".join(
            part for part in (content.factual_text(), content.tradition_text()) if part
        )
    else:
        retrieval_text = request.historical_text or ""

    if llm.is_configured():
        try:
            raw = llm.complete(
                prompts.GUIDE_SYSTEM_PROMPT,
                prompts.build_guide_prompt(
                    source_text, location_name, request.question, request.language,
                    history=request.history,
                ),
            )
            blocks = llm.parse_labelled_blocks(raw, ["ANSWER", "FROM_SOURCE", "EXCERPT"])
            answer = blocks["ANSWER"].strip() or _not_in_records(request.language)
            from_source = blocks["FROM_SOURCE"].strip().upper().startswith("Y")
            excerpt = blocks["EXCERPT"].strip()
            return GuideResponse(
                status=STATUS_OK,
                answer=answer,
                answered_from_source=from_source,
                excerpts=[excerpt] if excerpt and excerpt.upper() != "NONE" else [],
                uncertainty_notes=[] if from_source else [_not_in_records(request.language)],
                source=source,
                model=ModelInfo(provider=llm.PROVIDER_NAME, name=llm.DEFAULT_MODEL),
            )
        except llm.LLMUnavailable:
            if os.environ.get("NODE_ENV") == "production":
                raise
            pass  # fall through to the offline retrieval below

    # A follow-up like "and when was that?" carries almost no keywords of its
    # own, so the previous question is folded in before retrieval.
    query = _expand_with_history(request.question, request.history)
    excerpts, coverage_notes = _retrieve(query, retrieval_text, location_name)
    if not excerpts:
        return GuideResponse(
            status=STATUS_OK,
            answer=_not_in_records(request.language),
            answered_from_source=False,
            excerpts=[],
            uncertainty_notes=[
                ("لا يغطي المحتوى المراجع لهذا المكان هذا السؤال."
                 if request.language == "ar"
                 else "The reviewed content for %s does not cover this question." % location_name)
            ],
            source=source,
            model=OFFLINE_MODEL,
        )

    return GuideResponse(
        status=STATUS_OK,
        answer=" ".join(excerpts),
        answered_from_source=True,
        excerpts=excerpts,
        uncertainty_notes=coverage_notes,
        source=source,
        model=OFFLINE_MODEL,
    )


# ---------------------------------------------------------------------------
# Source resolution (workflow steps 1-2)
# ---------------------------------------------------------------------------

def _resolve_source(request, content_dir):
    # type: (StoryRequest, Optional[str]) -> tuple
    """Return ``(ReviewedContent or None, SourceInfo)`` for this request.

    Inline ``historical_text`` wins when the backend supplies it; otherwise the
    reviewed summary is loaded by ``location_id``.
    """
    if request.historical_text:
        if request.governorate_id:
            raise ValidationError('invalid_scope', 'Scoped requests must use the stored reviewed record.')
        return None, SourceInfo(
            location_id=request.location_id,
            location_name=request.location_name,
            provided_inline=True,
        )

    content = content_loader.load(request.location_id or "", content_dir)
    if content and request.governorate_id and content.governorate_id != request.governorate_id:
        raise ValidationError('invalid_scope', 'Location is outside the requested governorate.')
    if content:
        from .scope import localized
        content = localized(content, request.language)
    if content is None:
        raise ValidationError(
            ERR_UNKNOWN_LOCATION,
            "No reviewed content found for location_id '%s'. Add a summary in "
            "content/ai-ready/ before requesting a story." % request.location_id,
        )
    if not content.is_reviewed:
        raise ValidationError(
            "content_not_reviewed",
            "The content for '%s' is not marked reviewed." % request.location_id,
        )

    from .scope import catalog
    record = next((item for item in catalog()['locations'] if item['id'] == content.location_id), None)
    return content, SourceInfo(
        location_id=content.location_id,
        location_name=content.name,
        governorate_id=content.governorate_id,
        references=record["sources"] if record else [],
        content_file=content.source_file,
        summary_file=content.repo_path,
        provided_inline=False,
    )


# ---------------------------------------------------------------------------
# Model backend
# ---------------------------------------------------------------------------

def _generate_with_model(request, content, source_text, location_name, mode):
    # type: (StoryRequest, Optional[ReviewedContent], str, str, audiences.AudienceMode) -> Optional[tuple]
    gaps = content.known_gaps() if content else []
    prompt = prompts.build_story_prompt(
        source_text,
        location_name,
        request.target_audience,
        request.language,
        request.tone,
        max_words=request.max_words,
        known_gaps=gaps,
    )
    try:
        raw = llm.complete(prompts.SYSTEM_PROMPT, prompt)
    except llm.LLMUnavailable:
        if os.environ.get("NODE_ENV") == "production":
            raise
        # A model failure must never take the feature down - fall back to the
        # extractive backend, which needs nothing external.
        return _generate_offline(request, content, location_name, mode)

    blocks = llm.parse_labelled_blocks(raw, ["TITLE", "SUMMARY", "NARRATIVE", "UNCERTAINTY"])
    narrative = blocks["NARRATIVE"].strip()
    if not narrative:
        return _generate_offline(request, content, location_name, mode)

    notes = []  # type: List[str]
    uncertainty = blocks["UNCERTAINTY"].strip()
    if uncertainty and uncertainty.upper() != "NONE":
        notes = [line.strip("- ").strip() for line in uncertainty.splitlines() if line.strip()]

    return (
        blocks["TITLE"].strip() or _default_title(location_name, mode),
        blocks["SUMMARY"].strip(),
        narrative,
        notes,
        ModelInfo(provider=llm.PROVIDER_NAME, name=llm.DEFAULT_MODEL),
    )


# ---------------------------------------------------------------------------
# Offline extractive backend
# ---------------------------------------------------------------------------

def _generate_offline(request, content, location_name, mode):
    # type: (StoryRequest, Optional[ReviewedContent], str, audiences.AudienceMode) -> Optional[tuple]
    """Compose the narrative from sentences taken out of the reviewed source.

    Nothing is written from scratch here: every sentence in the output appears in
    the source, so the fact guard has nothing to flag. The connective wording
    ("Worth seeing:", "A few facts:") carries no historical content.
    """
    notes = []  # type: List[str]
    is_child = request.target_audience == "child"

    if content is None:
        # Inline text from the backend: use it directly, trimmed to the mode.
        sentences = textutils.split_sentences(request.historical_text or "")
        if is_child:
            sentences = [s for s in sentences if not _has_unsafe_terms(s)]
        paragraphs = [" ".join(sentences)] if sentences else []
    elif mode.key == "short":
        # In Brief is deliberately prose-only and constrained to 3-5 complete
        # statements; it is not the first paragraph of the long-form modes.
        candidates = textutils.split_sentences(content.section("overview"))[:1]
        timeline = textutils.table_rows(content.section("timeline"))
        if timeline:
            candidates.append("%s: %s" % (
                timeline[-1][0], textutils.ensure_sentence(timeline[-1][1])))
        candidates.extend(
            textutils.ensure_sentence(item)
            for item in textutils.bullet_items(content.section("facts"))[:2]
        )
        importance_items = (
            textutils.bullet_items(content.section("importance"))
            or textutils.split_sentences(content.section("importance"))
        )
        candidates.extend(textutils.ensure_sentence(item) for item in importance_items[:1])
        if len(candidates) < 3:
            candidates.extend(textutils.split_sentences(content.section("overview"))[1:3])
        paragraphs = [" ".join(candidates[:5])]
    else:
        paragraphs = []
        for key in mode.sections:
            block = _render_section(content, key, mode, is_child)
            if block:
                paragraphs.append(block)
            elif key in ("overview", "timeline"):
                notes.append(
                    "The reviewed summary has no usable '%s' section for this location."
                    % key
                )

    max_words = request.max_words or mode.max_words
    paragraphs = textutils.trim_to_words(paragraphs, max_words)
    narrative = "\n\n".join(p for p in paragraphs if p.strip())

    if not narrative.strip():
        return None

    if content is not None:
        notes.extend(content.known_gaps())
        if is_child and _dropped_for_child(content):
            notes.append(
                "Periods describing sieges, destruction or war were left out of the "
                "child-friendly version; they are present in the reviewed source."
            )

    summary = _build_summary(content, request, location_name)
    title = _default_title(location_name, mode)
    return title, summary, narrative, notes, OFFLINE_MODEL


def _render_section(content, key, mode, is_child):
    # type: (ReviewedContent, str, audiences.AudienceMode, bool) -> str
    if key == "overview":
        sentences = textutils.split_sentences(content.section("overview"))
        if is_child:
            sentences = [s for s in sentences if not _has_unsafe_terms(s)]
        limit = 2 if is_child else 4
        return " ".join(sentences[:limit])

    if key == "timeline":
        rows = textutils.table_rows(content.section("timeline"))
        if is_child:
            rows = [row for row in rows if not _has_unsafe_terms(row[1])]
        rows = rows[: mode.timeline_items]
        if not rows:
            return ""
        lines = ["%s: %s" % (period, textutils.ensure_sentence(event)) for period, event in rows]
        header = "Historical sequence:" if mode.key == "student" else "Chronology:"
        return header + "\n" + "\n".join(lines)

    if key == "landmarks":
        items = textutils.bullet_items(content.section("landmarks"))
        if is_child:
            items = [item for item in items if not _has_unsafe_terms(item)]
        items = items[: mode.landmark_items]
        if not items:
            return ""
        header = "Things to look for:" if mode.key in ("tourist", "child") else "Main landmarks:"
        return header + "\n" + "\n".join(
            "- " + textutils.ensure_sentence(item) for item in items
        )

    if key == "importance":
        items = textutils.bullet_items(content.section("importance"))
        if not items:
            items = textutils.split_sentences(content.section("importance"))
        if is_child:
            items = [item for item in items if not _has_unsafe_terms(item)]
        items = items[:3]
        if not items:
            return ""
        return " ".join(textutils.ensure_sentence(item) for item in items)

    if key == "facts":
        items = textutils.bullet_items(content.section("facts"))
        if is_child:
            items = [item for item in items if not _has_unsafe_terms(item)]
        items = items[: mode.fact_items]
        if not items:
            return ""
        return "A few facts:\n" + "\n".join(
            "- " + textutils.ensure_sentence(item) for item in items
        )

    if key == "walkthrough":
        sentences = textutils.split_sentences(content.section("walkthrough"))
        if is_child:
            sentences = [s for s in sentences if not _has_unsafe_terms(s)]
        limit = 6 if is_child else 16
        body = " ".join(sentences[:limit])
        return ("A gentle discovery:\n" + body) if is_child and body else body

    if key in ("oral_heritage", "traditions"):
        items = textutils.bullet_items(content.section(key))
        if is_child:
            items = [item for item in items if not _has_unsafe_terms(item)]
        if not items:
            return ""
        header = "Living memory:" if key == "oral_heritage" else "Attributed traditions:"
        return header + "\n" + "\n".join(
            "- " + textutils.ensure_sentence(item) for item in items[:3]
        )

    if key == "takeaway":
        overview = textutils.split_sentences(content.section("overview"))[:1]
        importance = [
            textutils.ensure_sentence(item)
            for item in (
                textutils.bullet_items(content.section("importance"))
                or textutils.split_sentences(content.section("importance"))
            )[:2]
        ]
        points = overview + importance
        if not points:
            return ""
        return "Key takeaway:\n" + "\n".join("- " + point for point in points)

    return ""


def _has_unsafe_terms(text):
    # type: (str) -> bool
    return audiences.has_unsafe_terms(text)


def _dropped_for_child(content):
    # type: (ReviewedContent) -> bool
    rows = textutils.table_rows(content.section("timeline"))
    return any(_has_unsafe_terms(event) for _, event in rows)


def _build_summary(content, request, location_name):
    # type: (Optional[ReviewedContent], StoryRequest, str) -> str
    if content is not None:
        sentences = textutils.split_sentences(content.section("overview"))
        if sentences:
            return sentences[0]
    sentences = textutils.split_sentences(request.historical_text or "")
    if sentences:
        return sentences[0]
    return "A short narrative about %s drawn from reviewed heritage content." % location_name


def _default_title(location_name, mode):
    # type: (str, audiences.AudienceMode) -> str
    templates = {
        "student": "%s: a short history",
        "tourist": "Visiting %s",
        "child": "The story of %s",
        "short": "%s in brief",
        "historian": "%s: a documented site history",
        "general": "%s",
    }
    return templates.get(mode.key, "%s") % location_name


# ---------------------------------------------------------------------------
# Offline retrieval for the Heritage Guide
# ---------------------------------------------------------------------------

def _expand_with_history(question, history):
    # type: (str, List[dict]) -> str
    """Add the previous question's wording to a short follow-up.

    Only the immediately preceding question is used, and only when the current
    one is too short to retrieve on. Pulling in the previous *answer* would let
    the guide drift away from the source and start answering from itself.
    """
    if not history:
        return question
    content_words = [
        word for word in _words(question)
        if word not in _STOPWORDS and len(word) > 2
    ]
    if len(content_words) >= 2:
        return question
    previous = history[-1].get("question", "")
    return (previous + " " + question).strip() if previous else question


_STOPWORDS = {
    "a", "about", "all", "and", "any", "are", "as", "at", "be", "been", "but", "by",
    "can", "did", "do", "does", "for", "from", "had", "has", "have", "how", "in", "is",
    "it", "its", "many", "me", "much", "not", "of", "on", "or", "please", "tell", "that",
    "the", "their", "there", "they", "this", "to", "today", "was", "were", "what",
    "when", "where", "which", "who", "why", "will", "with", "you", "your",
    "here", "near", "nearby", "some", "something", "anything",
}

# A keyword occurring in more than this share of the source statements is too
# common to prove relevance - "Jerusalem" matches every line of the Jerusalem file.
_COMMON_KEYWORD_RATIO = 0.3

# At least this share of a question's content words must appear in the records
# before an answer is offered at all. Below it, one incidental word match was
# enough to return a confidently irrelevant passage: "the best falafel shop
# here" came back with the list of city gates, because "best" appears in
# "best known". Refusing is the more useful answer.
_MIN_COVERAGE = 0.5


def _retrieve(question, source_text, location_name="", limit=3):
    # type: (str, str, str, int) -> tuple
    """Find the source statements that bear on the question.

    Returns ``(excerpts, notes)``. An empty excerpt list is a valid and
    important outcome: it is what makes the guide say "not available in the
    records" instead of stitching together loosely-related sentences.

    This is a keyword retriever, not a reader. It never writes a sentence - it
    only selects sentences that are already in the reviewed source, so a poor
    match produces an unhelpful answer rather than an invented one. When only
    part of the question matched, that is reported in the notes.
    """
    units = textutils.statements(source_text)
    if not units:
        return [], []
    unit_words = [(unit, _words(unit)) for unit in units]

    # Words of the location's own name carry no information here: every
    # statement in the Jerusalem file mentions Jerusalem.
    ignored = _STOPWORDS | _words(location_name)
    keywords = {
        word for word in _words(question) if word not in ignored and len(word) > 2
    }
    if not keywords:
        return [], []

    frequencies = dict(
        (word, sum(1 for _, words in unit_words if word in words)) for word in keywords
    )
    present = {word for word in keywords if frequencies[word] > 0}
    if not present:
        # Nothing the question asks about is mentioned in the records at all.
        return [], []

    # Most of what was asked about is missing, so whatever did match is
    # incidental. Saying so beats answering a different question convincingly.
    if len(present) / len(keywords) < _MIN_COVERAGE:
        return [], []

    # Keywords that occur nearly everywhere cannot prove relevance on their own.
    common_ceiling = max(1, int(len(unit_words) * _COMMON_KEYWORD_RATIO))
    distinctive = {word for word in present if frequencies[word] <= common_ceiling}
    ranking_set = distinctive or present

    scored = []
    for unit, words in unit_words:
        strong = len(ranking_set & words)
        if strong:
            # Common keywords still break ties, they just cannot carry a match.
            scored.append((strong * 10 + len(present & words), len(unit), unit))
    if not scored:
        return [], []

    # Best score first; shorter statements win ties.
    scored.sort(key=lambda item: (-item[0], item[1]))

    notes = []  # type: List[str]
    missing = sorted(keywords - present)
    if missing:
        notes.append(
            "The reviewed records do not mention %s, so the answer below covers only "
            "part of the question." % ", ".join("'%s'" % word for word in missing)
        )
    return [unit for _, _, unit in scored[:limit]], notes


def _words(text):
    # type: (str) -> set
    return set(re.findall(r"[a-z']+", text.lower()))
