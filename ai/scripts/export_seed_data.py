"""Generate database and backend seed data from the reviewed content files.

    python3 ai/scripts/export_seed_data.py

Writes three files, all committed:

    database/seed-generated.sql                     PostgreSQL rows
    backend/src/database/seed/generated-data.ts     the in-memory repository seed
    frontend/src/mocks/generatedMockData.ts         the frontend offline fallback

Sources of truth, none of which is edited by hand afterwards:

    content/ai-ready/*-summary.md    the historical timeline tables
    content/media/media.json         verified, licensed images
    content/quiz/quiz.json           comprehension questions

The same timeline, images and questions have to exist in three places for the
system to work offline at every layer. Written by hand they would drift apart
silently, and the frontend would end up showing a "sample" timeline that
contradicted the real one. So the content team edits content, and all three
seeds are regenerated from it.
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from service import content_loader, textutils  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SQL_OUT = os.path.join(REPO, "database", "seed-generated.sql")
TS_OUT = os.path.join(REPO, "backend", "src", "database", "seed", "generated-data.ts")
MOCK_OUT = os.path.join(REPO, "frontend", "src", "mocks", "generatedMockData.ts")
MEDIA_JSON = os.path.join(REPO, "content", "media", "media.json")
QUIZ_JSON = os.path.join(REPO, "content", "quiz", "quiz.json")

# Locations in the MVP, in display order.
LOCATIONS = [
    "muslim-quarter", "christian-quarter", "armenian-quarter",
    "maghariba-quarter", "sheikh-jarrah", "silwan", "at-tur", "bab-al-amud",
]

# Wording that marks a timeline entry as tradition rather than documented history.
TRADITION_MARKERS = (
    "according to accounts",
    "according to tradition",
    "christian tradition",
    "islamic tradition",
    "is believed",
    "are believed",
    "popular",
)

# Rough era anchors used only to sort the timeline. Never displayed.
ERA_YEARS = [
    ("canaanite", -2000), ("early bronze", -3000), ("bronze age", -2000),
    ("ancient israelite", -1000), ("persian", -539), ("hellenistic", -332),
    ("roman era", -63), ("byzantine", 324), ("islamic conquest", 638),
    ("umayyad", 661), ("abbasid", 750), ("fatimid", 969), ("crusader", 1099),
    ("ayyubid", 1187), ("mamluk", 1250), ("ottoman", 1517),
    ("british mandate", 1917), ("modern", 1948), ("name origin", -1500),
]

_NUMBER_RE = re.compile(r"\d[\d,]*")


def sort_year(period_label):
    # type: (str) -> int
    """Approximate a year from a period label so the timeline can be ordered.

    The summaries phrase periods in several ways, and each needs different
    arithmetic before the entries will sort into chronological order:

        "586 BCE"                                    -> -586
        "Umayyad era (661-750 CE)"                   ->  661
        "16th century CE"                            ->  1550
        "Canaanite era (2nd millennium BCE)"         -> -2000
        "Canaanite era (... 4,000+ years ago)"       -> -2000
        "Name origin"                                -> era keyword lookup

    Taking the first number literally would put "4,000+ years ago" at year 4,
    i.e. after the Roman era, so the shape of the label has to be read first.
    The result orders the timeline and is never displayed.
    """
    lowered = period_label.lower()
    is_bce = "bce" in lowered
    numbers = [int(match.replace(",", "")) for match in _NUMBER_RE.findall(period_label)]

    if numbers:
        first = numbers[0]
        if "years ago" in lowered:
            # Roughly "now minus N", which lands in the BCE range for large N.
            return 2000 - first
        if "millennium" in lowered:
            return -(first * 1000) if is_bce else first * 1000
        if "century" in lowered:
            # 2nd century BCE spans -200..-101; 16th century CE spans 1500..1599.
            return -(first * 100) if is_bce else (first - 1) * 100 + 50
        return -first if is_bce else first

    for keyword, year in ERA_YEARS:
        if keyword in lowered:
            return year
    return 0


def is_tradition(period_label, description):
    # type: (str, str) -> bool
    text = (period_label + " " + description).lower()
    return any(marker in text for marker in TRADITION_MARKERS)


def collect_timeline():
    # type: () -> list
    rows = []
    for location_id in LOCATIONS:
        content = content_loader.load(location_id)
        if content is None:
            raise SystemExit("No reviewed summary for '%s'." % location_id)
        entries = textutils.table_rows(content.section("timeline"))
        if not entries:
            raise SystemExit("No timeline table in the summary for '%s'." % location_id)
        # The content files are already written in chronological order by the
        # documentation team, and that order is authoritative. Sorting by the
        # derived year instead would reorder entries whose period has no
        # explicit year ("Roman era") against ones that do ("27 BCE"), which
        # silently contradicts the reviewed source.
        for order, (period, event) in enumerate(entries):
            year = sort_year(period)
            rows.append({
                "id": "tl-%s-%02d" % (location_id, order + 1),
                "location_id": location_id,
                "period_label": period,
                "description": event,
                "sort_year": year,
                "sort_order": order,
                "is_tradition": is_tradition(period, event),
                "source_file": content.repo_path,
            })
    return rows


# A photograph taken before this year is historical, whatever it was labelled.
# 1940 shots have been mislabelled "modern" here before, which turned a
# then-and-now comparison into then-and-then without anything complaining.
MODERN_FROM_YEAR = 1990

_CAPTURE_YEAR_RE = re.compile(r"\b(1[6-9]\d{2}|20\d{2})\b")


def load_media():
    # type: () -> list
    with open(MEDIA_JSON) as handle:
        document = json.load(handle)
    rows = []
    per_location = {}
    pairs = {}
    for record in document["media"]:
        location_id = record["location_id"]
        order = per_location.get(location_id, 0)
        per_location[location_id] = order + 1

        if location_id not in LOCATIONS:
            raise SystemExit("Media '%s' belongs to an out-of-scope location '%s'."
                             % (record["id"], location_id))
        required = (
            "url", "thumb_url", "subject", "subject_ar", "caption", "caption_ar",
            "credit", "license", "license_url", "source_url", "width", "height",
        )
        missing = [field for field in required if not record.get(field)]
        if missing:
            raise SystemExit("Media '%s' is missing: %s."
                             % (record["id"], ", ".join(missing)))
        if record["width"] < 1600:
            raise SystemExit(
                "Media '%s' is only %dpx wide; use an original at least 1600px wide."
                % (record["id"], record["width"])
            )

        # Cross-check the declared era against the capture date, where the
        # source gives one. Ranges like "between 1934 and 1939" use the earliest
        # year, which is the safe direction: it can only pull a photo earlier.
        years = [int(match) for match in _CAPTURE_YEAR_RE.findall(record.get("date") or "")]
        if years:
            earliest = min(years)
            expected = "modern" if earliest >= MODERN_FROM_YEAR else "historical"
            if record["era"] != expected:
                raise SystemExit(
                    "Media '%s' is dated %d but marked '%s'; expected '%s'."
                    % (record["id"], earliest, record["era"], expected)
                )

        role = record.get("pair_role")
        # `gallery` is a content-authoring label, not a database pair role.
        # Ordinary gallery items are stored with a NULL pair_role; only covers
        # and the two halves of a comparison receive a role in the API.
        stored_role = None if role == "gallery" else role
        if role in ("before", "after"):
            if role == "before" and record["era"] != "historical":
                raise SystemExit("Media '%s' is the 'before' half but is not historical."
                                 % record["id"])
            if role == "after" and record["era"] != "modern":
                raise SystemExit("Media '%s' is the 'after' half but is not modern."
                                 % record["id"])
            pairs.setdefault(location_id, {})[role] = record

        rows.append(dict(record, pair_role=stored_role, sort_order=order))

    # A comparison only means anything if both halves show the same thing.
    for location_id, halves in pairs.items():
        if len(halves) == 2 and halves["before"]["subject"] != halves["after"]["subject"]:
            raise SystemExit(
                "The before/after pair for '%s' shows two different subjects (%s vs %s)."
                % (location_id, halves["before"]["subject"], halves["after"]["subject"])
            )

    for location_id in LOCATIONS:
        count = per_location.get(location_id, 0)
        if count < 6 or count > 8:
            raise SystemExit(
                "Location '%s' has %d images; every gallery must contain 6-8."
                % (location_id, count)
            )

    return rows


def load_quiz():
    # type: () -> list
    with open(QUIZ_JSON) as handle:
        document = json.load(handle)
    for record in document["questions"]:
        options = record["options"]
        if not 0 <= record["answer_index"] < len(options):
            raise SystemExit(
                "Quiz '%s' has answer_index outside its options." % record["id"])
        if not record.get("source_note"):
            raise SystemExit("Quiz '%s' has no source_note." % record["id"])
    return document["questions"]


# --------------------------------------------------------------------------
# SQL output
# --------------------------------------------------------------------------

def sql_literal(value):
    if value is None or value == "":
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, int):
        return str(value)
    flattened = re.sub(r"\s+", " ", str(value)).strip()
    return "'" + flattened.replace("'", "''") + "'"


def sql_array(values):
    return "ARRAY[" + ", ".join(sql_literal(value) for value in values) + "]"


def write_sql(timeline, media, quiz):
    lines = [
        "-- =============================================================================",
        "-- Hikaya - GENERATED seed data. Do not edit by hand.",
        "-- =============================================================================",
        "-- Regenerate with:  python3 ai/scripts/export_seed_data.py",
        "--",
        "-- Sources:  content/ai-ready/*-summary.md   (timeline)",
        "--           content/media/media.json        (images)",
        "--",
        "-- Run after database/schema.sql and database/seed.sql:",
        "--   psql -d hikaya -f database/seed-generated.sql",
        "-- =============================================================================",
        "",
        "BEGIN;",
        "",
        "-- Keep an existing development database compatible with bilingual media metadata.",
        "ALTER TABLE media ADD COLUMN IF NOT EXISTS width INTEGER CHECK (width > 0);",
        "ALTER TABLE media ADD COLUMN IF NOT EXISTS height INTEGER CHECK (height > 0);",
        "ALTER TABLE media ADD COLUMN IF NOT EXISTS subject_ar TEXT;",
        "ALTER TABLE media ADD COLUMN IF NOT EXISTS description_ar TEXT;",
        "",
        "DELETE FROM quiz_questions;",
        "DELETE FROM timeline_events;",
        "DELETE FROM media;",
        "",
        "-- %d timeline events ---------------------------------------------------------" % len(timeline),
        "INSERT INTO timeline_events",
        "  (id, location_id, period_label, description, sort_year, sort_order, is_tradition, source_file)",
        "VALUES",
    ]
    values = []
    for row in timeline:
        values.append("  (%s, %s, %s, %s, %s, %s, %s, %s)" % (
            sql_literal(row["id"]), sql_literal(row["location_id"]),
            sql_literal(row["period_label"]), sql_literal(row["description"]),
            sql_literal(row["sort_year"]), sql_literal(row["sort_order"]),
            sql_literal(row["is_tradition"]), sql_literal(row["source_file"])))
    lines.append(",\n".join(values) + ";")
    lines.extend([
        "",
        "-- %d media records -----------------------------------------------------------" % len(media),
        "INSERT INTO media",
        "  (id, location_id, type, url, thumb_url, width, height, subject, subject_ar, description, description_ar, era, pair_role,",
        "   credit, license, license_url, captured_at, source_url, sort_order)",
        "VALUES",
    ])
    values = []
    for row in media:
        values.append("  (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)" % (
            sql_literal(row["id"]), sql_literal(row["location_id"]), sql_literal(row["type"]),
            sql_literal(row["url"]), sql_literal(row["thumb_url"]),
            sql_literal(row["width"]), sql_literal(row["height"]), sql_literal(row["subject"]),
            sql_literal(row["subject_ar"]), sql_literal(row["caption"]),
            sql_literal(row["caption_ar"]), sql_literal(row["era"]), sql_literal(row["pair_role"]),
            sql_literal(row["credit"]), sql_literal(row["license"]), sql_literal(row["license_url"]),
            sql_literal(row["date"]), sql_literal(row["source_url"]), sql_literal(row["sort_order"])))
    lines.append(",\n".join(values) + ";")

    lines.extend([
        "",
        "-- %d quiz questions ----------------------------------------------------------" % len(quiz),
        "INSERT INTO quiz_questions",
        "  (id, location_id, question, options, answer_index, explanation, source_note, sort_order)",
        "VALUES",
    ])
    values = []
    for row in quiz:
        values.append("  (%s, %s, %s, %s, %s, %s, %s, %s)" % (
            sql_literal(row["id"]), sql_literal(row["location_id"]),
            sql_literal(row["question"]), sql_array(row["options"]),
            sql_literal(row["answer_index"]), sql_literal(row["explanation"]),
            sql_literal(row["source_note"]), sql_literal(row["sort_order"])))
    lines.append(",\n".join(values) + ";")

    lines.extend(["", "COMMIT;", ""])

    with open(SQL_OUT, "w") as handle:
        handle.write("\n".join(lines))


# --------------------------------------------------------------------------
# TypeScript output
# --------------------------------------------------------------------------

def ts_literal(value):
    if value is None or value == "":
        return "undefined"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    # Commons credit fields carry embedded newlines ("X.jpg: Author\nderivative
    # work: Author"), which would end the string literal mid-line.
    escaped = (
        str(value)
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\r\n", " ")
        .replace("\n", " ")
        .replace("\r", " ")
    )
    return "'" + re.sub(r"\s{2,}", " ", escaped).strip() + "'"


def ts_array(values):
    return "[" + ", ".join(ts_literal(value) for value in values) + "]"


def _timeline_ts(rows, key_style):
    """Render timeline rows. `key_style` picks camelCase field names."""
    lines = []
    for row in rows:
        lines.append("  {")
        lines.append("    id: %s," % ts_literal(row["id"]))
        lines.append("    locationId: %s," % ts_literal(row["location_id"]))
        lines.append("    periodLabel: %s," % ts_literal(row["period_label"]))
        lines.append("    description: %s," % ts_literal(row["description"]))
        lines.append("    sortYear: %s," % ts_literal(row["sort_year"]))
        lines.append("    sortOrder: %s," % ts_literal(row["sort_order"]))
        lines.append("    isTradition: %s," % ts_literal(row["is_tradition"]))
        lines.append("    sourceFile: %s," % ts_literal(row["source_file"]))
        lines.append("  },")
    del key_style
    return lines


def _media_ts(rows):
    lines = []
    for row in rows:
        lines.append("  {")
        lines.append("    id: %s," % ts_literal(row["id"]))
        lines.append("    locationId: %s," % ts_literal(row["location_id"]))
        lines.append("    type: %s," % ts_literal(row["type"]))
        lines.append("    url: %s," % ts_literal(row["url"]))
        lines.append("    thumbUrl: %s," % ts_literal(row["thumb_url"]))
        lines.append("    width: %s," % ts_literal(row["width"]))
        lines.append("    height: %s," % ts_literal(row["height"]))
        lines.append("    subject: %s," % ts_literal(row["subject"]))
        lines.append("    arabicSubject: %s," % ts_literal(row["subject_ar"]))
        lines.append("    description: %s," % ts_literal(row["caption"]))
        lines.append("    arabicDescription: %s," % ts_literal(row["caption_ar"]))
        lines.append("    era: %s," % ts_literal(row["era"]))
        if row["pair_role"] is not None:
            lines.append("    pairRole: %s," % ts_literal(row["pair_role"]))
        lines.append("    credit: %s," % ts_literal(row["credit"]))
        lines.append("    license: %s," % ts_literal(row["license"]))
        lines.append("    licenseUrl: %s," % ts_literal(row["license_url"]))
        lines.append("    capturedAt: %s," % ts_literal(row["date"]))
        lines.append("    sourceUrl: %s," % ts_literal(row["source_url"]))
        lines.append("    sortOrder: %s," % ts_literal(row["sort_order"]))
        lines.append("  },")
    return lines


def _quiz_ts(rows):
    lines = []
    for row in rows:
        lines.append("  {")
        lines.append("    id: %s," % ts_literal(row["id"]))
        lines.append("    locationId: %s," % ts_literal(row["location_id"]))
        lines.append("    question: %s," % ts_literal(row["question"]))
        lines.append("    options: %s," % ts_array(row["options"]))
        lines.append("    answerIndex: %s," % ts_literal(row["answer_index"]))
        lines.append("    explanation: %s," % ts_literal(row["explanation"]))
        lines.append("    sourceNote: %s," % ts_literal(row["source_note"]))
        lines.append("    sortOrder: %s," % ts_literal(row["sort_order"]))
        lines.append("  },")
    return lines


HEADER = [
    "/**",
    " * GENERATED FILE - do not edit by hand.",
    " *",
    " * Regenerate with:  python3 ai/scripts/export_seed_data.py",
    " *",
    " * Produced from content/ai-ready/*-summary.md, content/media/media.json",
    " * and content/quiz/quiz.json, so every layer shows the same timeline,",
    " * images and questions.",
    " */",
    "",
]


def write_mock(timeline, media, quiz):
    """The frontend's offline fallback data."""
    lines = [
        "import {",
        "  ApiMedia,",
        "  ApiQuizQuestion,",
        "  ApiTimelineEvent,",
        "} from '../types';",
        "",
    ] + HEADER
    lines.append("export const MOCK_TIMELINE: ApiTimelineEvent[] = [")
    lines.extend(_timeline_ts(timeline, "camel"))
    lines.extend(["];", "", "export const MOCK_MEDIA: ApiMedia[] = ["])
    lines.extend(_media_ts(media))
    lines.extend(["];", "", "export const MOCK_QUIZ: ApiQuizQuestion[] = ["])
    lines.extend(_quiz_ts(quiz))
    lines.extend(["];", ""])
    with open(MOCK_OUT, "w") as handle:
        handle.write("\n".join(lines))


def write_ts(timeline, media, quiz):
    lines = [
        "import { MediaItem } from '../entities/media.entity';",
        "import { QuizQuestion } from '../entities/quiz-question.entity';",
        "import { TimelineEvent } from '../entities/timeline-event.entity';",
        "",
    ] + HEADER
    lines.append("export const SEED_TIMELINE: TimelineEvent[] = [")
    lines.extend(_timeline_ts(timeline, "camel"))
    lines.extend(["];", "", "export const SEED_MEDIA: MediaItem[] = ["])
    lines.extend(_media_ts(media))
    lines.extend(["];", "", "export const SEED_QUIZ: QuizQuestion[] = ["])
    lines.extend(_quiz_ts(quiz))
    lines.extend(["];", ""])

    with open(TS_OUT, "w") as handle:
        handle.write("\n".join(lines))


def main():
    timeline = collect_timeline()
    media = load_media()
    quiz = load_quiz()

    write_sql(timeline, media, quiz)
    write_ts(timeline, media, quiz)
    write_mock(timeline, media, quiz)

    print("Generated from reviewed content:")
    print("  %d timeline events, %d media, %d quiz questions ->"
          % (len(timeline), len(media), len(quiz)))
    print("    database/seed-generated.sql")
    print("    backend/src/database/seed/generated-data.ts")
    print("    frontend/src/mocks/generatedMockData.ts")
    for location_id in LOCATIONS:
        events = [row for row in timeline if row["location_id"] == location_id]
        images = [row for row in media if row["location_id"] == location_id]
        traditions = sum(1 for row in events if row["is_tradition"])
        print("    %-11s %2d events (%d flagged as tradition), %d images"
              % (location_id, len(events), traditions, len(images)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
