"""The Hikaya AI story generation function.

This is the Sprint 2 implementation of the workflow documented in
``ai/narrative-generation-workflow.md``. The entry points are:

    generate_story(StoryRequest)  -> StoryResponse
    answer_question(GuideRequest) -> GuideResponse

Both refuse to work from anything except reviewed content. There are two
generation backends:

* **model backend** - used when a provider key is set (see :mod:`service.llm`), under the strict
  no-invention prompts in :mod:`service.prompts`;
* **offline extractive backend** - the default. It composes the narrative out of
  sentences taken from the reviewed summary itself, so it cannot invent a fact
  by construction. It is what makes the module testable, reproducible and
  runnable with no credentials, which is what the examples in ``ai/examples/``
  were produced with.

Either way the output goes through the fact guard before being returned.
"""

import os
from typing import Dict, List, Optional, Tuple

from . import audiences, content_loader, fact_guard, llm, prompts, retrieval, textutils
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
        arabic_vocabulary=model_info is OFFLINE_MODEL,
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

    if llm.is_configured():
        try:
            return _grounded_answer(request, content_dir)
        except ValidationError as exc:
            return GuideResponse(status="error", answered_from_source=False,
                                 error={"code": exc.code, "message": exc.message})
        except llm.LLMUnavailable:
            if os.environ.get("NODE_ENV") == "production":
                raise
            # Development keeps working on the keyword fallback below.
    return _answer_offline(request, content_dir)


def _answer_offline(request, content_dir):
    # type: (GuideRequest, Optional[str]) -> GuideResponse
    """Keyword retrieval over reviewed sentences; needs no model or network."""
    if request.governorate_ids or request.location_ids:
        from .scope import resolve_ids
        try:
            ids = resolve_ids(request.governorate_ids, [request.location_id] if request.location_id else request.location_ids, content_dir)
        except ValidationError as exc:
            return GuideResponse(status='error', answered_from_source=False, error={'code':exc.code, 'message':exc.message})
        answers = [_answer_offline(GuideRequest(question=request.question, location_id=id, language=request.language, history=request.history), content_dir) for id in ids]
        supported = [answer for answer in answers if answer.answered_from_source and not answer.error]
        return GuideResponse(answer='\n\n'.join(answer.source.location_name+': '+answer.answer for answer in supported) if supported else _not_in_records(request.language),
                             answered_from_source=bool(supported), excerpts=[excerpt for answer in supported for excerpt in answer.excerpts],
                             citations=[citation for answer in supported for citation in answer.citations],
                             sources=[answer.source for answer in supported],
                             uncertainty_notes=[] if supported else [_not_in_records(request.language)], model=OFFLINE_MODEL)

    if not request.location_id and not request.historical_text:
        return _answer_across_locations(request, content_dir)

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

    location_name = (content.name if content else None) or request.location_id or "this location"

    chunks = _content_chunks(content, source, request.language) if content else [
        {
            "text": unit,
            "section": "provided content",
            "content_type": "fact",
            "language": "ar" if retrieval.has_arabic(unit) else "en",
            "source": source,
        }
        for unit in textutils.statements(request.historical_text or "")
    ]
    query = _expand_with_history(request.question, request.history)
    if _mentions_other_location(request.question, request.location_id, content_dir):
        routed = _answer_across_locations(request, content_dir)
        if routed.answered_from_source:
            return routed
    selected, coverage_notes = _rank_chunks(
        query, chunks, location_name,
        limit=1 if _is_location_question(query) else 3,
    )

    if not selected:
        # A location-specific chat can still answer a clearly cross-location
        # question, but only from another reviewed record that independently
        # passes the relevance threshold.
        if _mentions_other_location(request.question, request.location_id, content_dir):
            routed = _answer_across_locations(request, content_dir)
            if routed.answered_from_source:
                return routed
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
        answer=" ".join(_format_chunk(item, request.language) for item in selected),
        answered_from_source=True,
        excerpts=[item["text"] for item in selected],
        citations=_citations(selected),
        uncertainty_notes=coverage_notes,
        source=source,
        model=OFFLINE_MODEL,
    )


def _grounded_answer(request, content_dir):
    # type: (GuideRequest, Optional[str]) -> GuideResponse
    """Answer from whole reviewed records in scope (see :mod:`service.grounding`)."""
    from . import grounding
    from .scope import catalog, resolve_ids

    catalog_items = dict((item["id"], item) for item in catalog()["locations"])
    if request.historical_text and not (request.governorate_ids or request.location_ids):
        source = SourceInfo(location_id=request.location_id,
                            location_name=request.location_id, provided_inline=True)
        records = [grounding.inline_record(request.historical_text, source)]
        return grounding.answer(request, records, request.location_id or "the provided text",
                                _not_in_records)

    if request.governorate_ids or request.location_ids:
        ids = resolve_ids(request.governorate_ids,
                          [request.location_id] if request.location_id else request.location_ids,
                          content_dir)
        strict = True
    elif request.location_id:
        others = sorted(_mentioned_location_ids(request.question, content_dir)
                        - {request.location_id})
        ids = [request.location_id] + others[:3]
        strict = True
    else:
        ids = [item["location_id"] for item in content_loader.available_locations(content_dir)]
        strict = False

    records = []
    for location_id in ids:
        try:
            content, source = _resolve_source(
                StoryRequest(location_id=location_id, language="en"), content_dir)
        except ValidationError:
            if strict and location_id == (request.location_id or ids[0]):
                raise
            continue
        records.append(grounding.build_record(content, source, catalog_items.get(location_id)))
    if not records:
        raise ValidationError(ERR_UNKNOWN_LOCATION, "No reviewed content is available.")

    if request.location_id and not (request.governorate_ids or request.location_ids):
        first = records[0]
        label = "%s (%s)" % (first.name, first.arabic_name) if first.arabic_name else first.name
    elif len(records) == 1:
        label = records[0].name
    else:
        label = "Palestinian heritage places in the Hikaya archive: " + ", ".join(
            record.name for record in records)
    return grounding.answer(request, records, label, _not_in_records)


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
        ModelInfo(provider=llm.provider_name(), name=llm.used_model()),
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

    if (request.language == "ar" and content is not None
            and not retrieval.has_arabic(content.section("overview"))
            and content.section("arabic_overview")):
        # Jerusalem records carry reviewed Arabic sections; tell the story from
        # those rather than returning English to an Arabic reader.
        return _generate_offline_arabic(request, content, mode)

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


# Arabic counterparts of audiences.CHILD_UNSAFE_TERMS (normalised stems).
_ARABIC_CHILD_UNSAFE = ("حصار", "هدم", "دمار", "حرب", "حروب", "قتل", "مجزر", "غزو",
                        "صليبي", "احتلال", "تهجير", "طرد", "قصف", "معرك", "اعتداء")


def _arabic_unsafe(sentence):
    # type: (str) -> bool
    normalized = retrieval.normalize_arabic(sentence)
    return any(term in normalized for term in _ARABIC_CHILD_UNSAFE)


def _generate_offline_arabic(request, content, mode):
    # type: (StoryRequest, ReviewedContent, audiences.AudienceMode) -> tuple
    """Arabic narrative composed only from the record's reviewed Arabic sections."""
    is_child = request.target_audience == "child"

    def sentences(key):
        # type: (str) -> List[str]
        found = [part.strip() for part in textutils.split_sentences(
            content.section(key).replace("\n", " ")) if part.strip()]
        return [part for part in found if not (is_child and _arabic_unsafe(part))]

    overview = sentences("arabic_overview") + sentences("arabic_guide")
    history = sentences("arabic_history")
    importance = sentences("arabic_importance")
    landmarks = sentences("arabic_landmarks")
    traditions = sentences("arabic_traditions")

    if mode.key == "short":
        paragraphs = [" ".join((overview + history + importance)[:4])]
    else:
        paragraphs = [" ".join(overview)]
        if history:
            paragraphs.append(("حكاية المكان عبر الزمن:\n" if is_child else "التسلسل التاريخي:\n")
                              + " ".join(history))
        if importance:
            paragraphs.append("لماذا يهمّ هذا المكان:\n" + " ".join(importance))
        if landmarks:
            paragraphs.append(("ما تبحث عنه:\n" if mode.key in ("tourist", "child") else "المعالم:\n")
                              + " ".join(landmarks))
        if traditions:
            paragraphs.append("تقاليد منسوبة:\n" + " ".join(
                "وفق التقليد الديني: " + item for item in traditions))
    narrative = "\n\n".join(paragraph for paragraph in paragraphs if paragraph.strip())
    if not narrative.strip():
        return None

    notes = [
        "تعتمد هذه الحكاية على الأقسام العربية المراجعة فقط، وهي أقصر من السجل الإنجليزي؛ "
        "فعّل مزوّد الذكاء الاصطناعي للحصول على حكاية عربية كاملة من السجل كله."
    ]
    if is_child and (_dropped_for_child(content) or any(
            _arabic_unsafe(part) for part in textutils.split_sentences(content.section("arabic_history")))):
        notes.append("حُذفت من نسخة الأطفال الفترات التي تتناول الحصار أو الهدم أو الحرب؛ وهي موجودة في المصدر المراجع.")
    name = content.arabic_name or content.name
    titles = {
        "student": "%s: تاريخ موجز", "tourist": "زيارة %s", "child": "حكاية %s",
        "short": "%s باختصار", "historian": "%s: سجلّ موثّق", "general": "%s",
    }
    summary = overview[0] if overview else name
    return titles.get(mode.key, "%s") % name, summary, narrative, notes, OFFLINE_MODEL


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
    "ا", "الى", "ان", "انا", "انت", "انتم", "او", "اي", "اين", "الذي",
    "التي", "الذين", "ما", "ماذا", "متى", "من", "هل", "هو", "هي", "هم",
    "هن", "هذا", "هذه", "هناك", "ذلك", "تلك", "في", "عن", "على", "مع",
    "بين", "بعد", "قبل", "كان", "كانت", "يكون", "تكون", "كم", "كيف",
    "لماذا", "ماهو", "ماهي", "الي", "ال", "و", "يا",
}
# Compare against normalised tokens (متى is tokenised as متي).
_STOPWORDS = _STOPWORDS | set(token for word in _STOPWORDS for token in retrieval.tokens(word))

_MIN_COVERAGE = 0.6


def _retrieve(question, source_text, location_name="", limit=3):
    # type: (str, str, str, int) -> tuple
    """Find relevant source statements with Arabic-aware BM25 ranking."""
    chunks = [
        {"text": unit, "section": "reviewed content", "content_type": "fact"}
        for unit in textutils.statements(source_text)
    ]
    ranked, notes = _rank_chunks(question, chunks, location_name, limit)
    return [item["text"] for item in ranked], notes


def _words(text):
    # type: (str) -> set
    return set(retrieval.tokens(text))


def _content_chunks(content, source, language):
    # type: (ReviewedContent, SourceInfo, str) -> List[dict]
    """Split reviewed records into citeable fact/tradition section statements."""
    chunks = []  # type: List[dict]
    if language == "ar":
        sections = []
        for key, content_type in (
            ("arabic_overview", "fact"),
            ("arabic_history", "fact"),
            ("arabic_importance", "fact"),
            ("arabic_landmarks", "fact"),
            ("arabic_traditions", "tradition"),
            ("arabic_guide", "fact"),
        ):
            section = content.section(key)
            if section:
                sections.append((key, section, content_type))
        if not sections:
            sections = _english_content_sections(content, language)
    else:
        sections = _english_content_sections(content, language)

    for section_key, body, content_type in sections:
        for statement in textutils.statements(body):
            chunks.append({
                "text": statement,
                "section": section_key,
                "content_type": content_type,
                "language": "ar" if retrieval.has_arabic(statement) else "en",
                "source": source,
            })
    return chunks


def _english_content_sections(content, language):
    # type: (ReviewedContent, str) -> List[Tuple[str, str, str]]
    sections = []
    for key in ("overview", "timeline", "importance", "landmarks", "facts", "walkthrough"):
        section = content.section(key)
        if section and (language != "ar" or retrieval.has_arabic(section)):
            sections.append((key, section, "fact"))
    for key in ("traditions", "oral_heritage"):
        section = content.section(key)
        if section and (language != "ar" or retrieval.has_arabic(section)):
            sections.append((key, section, "tradition" if key == "traditions" else "oral_heritage"))
    if not sections and language == "ar":
        return _english_content_sections(content, "en")
    return sections


def _rank_chunks(question, chunks, location_name="", limit=3):
    # type: (str, List[dict], str, int) -> tuple
    if not chunks:
        return [], []
    base_terms = retrieval.query_terms(question, location_name, include_synonyms=False)
    expanded_terms = retrieval.query_terms(question, location_name)
    if retrieval.has_arabic(question) and any(
        item.get("language") == "ar" for item in chunks
    ):
        base_terms = retrieval.arabic_terms(question)
    if not base_terms or not expanded_terms:
        return [], []
    question_words = set(retrieval.tokens(question))
    location_question = retrieval.is_location_question(question_words)

    document_tokens = [
        retrieval.tokens(
            (
                (item.get("source").location_name or "")
                + " "
                + (item.get("source").location_id or "")
                + " "
            )
            if item.get("source") else ""
        ) + retrieval.tokens(item["text"])
        for item in chunks
    ]
    present = set()
    for term in base_terms:
        if any(retrieval.term_matches(term, document) for document in document_tokens):
            present.add(term)
    minimum_coverage = 0.5 if location_question else _MIN_COVERAGE
    if not present or len(present) / len(base_terms) < minimum_coverage:
        return [], []

    scores = retrieval.bm25_scores(expanded_terms, document_tokens)
    ranked = []
    for index, score in enumerate(scores):
        if score > 0:
            item = dict(chunks[index])
            item["score"] = score
            ranked.append(item)
    ranked.sort(key=lambda item: (-item["score"], len(item["text"])))
    if location_question:
        location_chunks = [
            item for item in ranked
            if item["section"] in ("overview", "arabic_overview", "arabic_guide")
        ]
        if location_chunks:
            ranked = location_chunks

    selected = []  # type: List[dict]
    seen = set()
    for item in ranked:
        identity = (
            item.get("source").location_id if item.get("source") else None,
            item["text"],
        )
        if identity in seen:
            continue
        selected.append(item)
        seen.add(identity)
        if len(selected) == limit:
            break

    missing = sorted(base_terms - present)
    notes = []  # type: List[str]
    if missing:
        notes.append(
            "The reviewed records do not mention %s, so the answer below covers only "
            "part of the question." % ", ".join("'%s'" % word for word in missing)
        )
    return selected, notes


def _citations(chunks):
    # type: (List[dict]) -> List[dict]
    citations = []
    for item in chunks:
        source = item.get("source")
        citations.append({
            "location_id": source.location_id if source else None,
            "location_name": source.location_name if source else None,
            "section": item.get("section", "reviewed content"),
            "content_type": item.get("content_type", "fact"),
            "language": item.get("language", "en"),
            "excerpt": item["text"],
            "references": source.references if source else [],
        })
    return citations


def _format_chunk(chunk, language):
    # type: (dict, str) -> str
    if chunk.get("content_type") == "tradition":
        prefix = "وفق التقليد الديني: " if language == "ar" else "Religious tradition: "
        return prefix + chunk["text"]
    if chunk.get("content_type") == "oral_heritage":
        prefix = "وفقاً للتراث الشفوي: " if language == "ar" else "Oral heritage: "
        return prefix + chunk["text"]
    return chunk["text"]


def _answer_across_locations(request, content_dir):
    # type: (GuideRequest, Optional[str]) -> GuideResponse
    """Route an unscoped or unanswered question across reviewed location chunks."""
    chunks = []  # type: List[dict]
    sources = {}  # type: Dict[str, SourceInfo]
    mentioned_ids = _mentioned_location_ids(request.question, content_dir)
    records = content_loader.available_locations(content_dir)
    if mentioned_ids:
        records = [item for item in records if item["location_id"] in mentioned_ids]
    for item in records:
        if str(item.get("reviewed", "false")).lower() != "true":
            continue
        try:
            content, source = _resolve_source(
                StoryRequest(location_id=item["location_id"], language=request.language),
                content_dir,
            )
        except ValidationError:
            continue
        if content is None:
            continue
        sources[source.location_id or item["location_id"]] = source
        chunks.extend(_content_chunks(content, source, request.language))

    if mentioned_ids and _is_location_question(request.question):
        location_chunks = [
            item for item in chunks
            if item["section"] in ("overview", "arabic_overview", "arabic_guide")
        ]
        if location_chunks:
            chunks = location_chunks

    query = _expand_with_history(request.question, request.history)
    selected, notes = _rank_chunks(query, chunks, limit=1 if mentioned_ids else 3)
    if not selected:
        return GuideResponse(
            status=STATUS_OK,
            answer=_not_in_records(request.language),
            answered_from_source=False,
            uncertainty_notes=[_not_in_records(request.language)],
            model=OFFLINE_MODEL,
        )
    selected_sources = []
    seen_sources = set()
    for chunk in selected:
        source = chunk.get("source")
        if source and source.location_id not in seen_sources:
            selected_sources.append(source)
            seen_sources.add(source.location_id)
    named_excerpts = []
    for chunk in selected:
        source = chunk.get("source")
        prefix = (source.location_name + ": ") if source else ""
        named_excerpts.append(prefix + _format_chunk(chunk, request.language))
    return GuideResponse(
        status=STATUS_OK,
        answer=" ".join(named_excerpts),
        answered_from_source=True,
        excerpts=[item["text"] for item in selected],
        citations=_citations(selected),
        sources=selected_sources,
        source=selected_sources[0] if selected_sources else SourceInfo(),
        uncertainty_notes=notes,
        model=OFFLINE_MODEL,
    )


def _mentions_other_location(question, current_location_id, content_dir):
    # type: (str, Optional[str], Optional[str]) -> bool
    return bool(
        _mentioned_location_ids(question, content_dir) - {current_location_id}
    )


def _mentioned_location_ids(question, content_dir):
    # type: (str, Optional[str]) -> set
    question_words = set(retrieval.tokens(question))
    if not question_words:
        return set()
    mentioned = set()
    for item in content_loader.available_locations(content_dir):
        content = content_loader.load(item["location_id"], content_dir)
        if not content or not content.is_reviewed:
            continue
        for name in (
            content.name,
            content.arabic_name,
            item["location_id"].replace("-", " "),
        ):
            name_words = set(retrieval.tokens(name))
            if name_words and name_words.issubset(question_words):
                mentioned.add(item["location_id"])
                break
    return mentioned


def _is_location_question(question):
    # type: (str) -> bool
    return retrieval.is_location_question(set(retrieval.tokens(question)))
