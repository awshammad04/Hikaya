# Hikaya — AI ↔ Backend JSON Contract

**Project:** Hikaya
**Owners:** Software development team
**Status:** v2 — updated in Sprint 2 alongside the working implementation in `ai/service/`
**Companion documents:** [`narrative-generation-workflow.md`](narrative-generation-workflow.md), [`README.md`](README.md)

Governorate-aware additions are documented in [Palestine expansion](../docs/palestine-expansion.md).
Existing story and guide requests remain valid. Story requests may add
`governorate_id`; guide requests may add `governorate_ids` and `location_ids`.
`POST /generate-journey` accepts the guide's geographic scope and the story's
`language`, `target_audience` and `tone`, returning `mode: cultural`, one joined
`narrative`, scoped `stories`, `sources`, `warnings` and `uncertainty_notes`.
All returned source objects may include `governorate_id` and `references`.

---

## 1. Purpose

This document defines the JSON exchanged between the NestJS backend and the AI
module. It is the agreement both teams build against.

```
Frontend ──POST /api/v1/ai/generate-story──▶ Backend ──POST /generate-story──▶ AI module
                                                                                   │
Frontend ◀──────── story JSON ──────────── Backend ◀──── story JSON ────────────────┘
```

The backend never sends raw user text to the AI module as historical material. It
sends a `location_id`, and the AI module loads the reviewed summary itself from
`content/ai-ready/`. Inline `historical_text` exists as an escape hatch for content
that is not yet in the repository — it must still be reviewed content.

### What changed in v2

| Change | Why |
|---|---|
| `location_id` added and preferred over `historical_text` | The AI module owns content loading, so the backend does not have to ship a 20 KB document on every request. |
| `target_audience` values fixed to `student`, `tourist`, `child`, `short`, `general` | These are the modes the implementation actually supports. |
| `word_count`, `model`, `source` added to the response | The frontend shows provenance, and reviewers need to know which backend produced the text. |
| `status` values `ok` / `partial` / `error` | `partial` signals that the fact guard flagged something for review. |
| `warnings` split from `uncertainty_notes` | They mean different things — see §6. |
| Error codes frozen | The backend maps them to HTTP statuses. |

---

## 2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Service status, active backend, and which locations have reviewed content. |
| `GET` | `/modes` | The supported audience modes. |
| `POST` | `/generate-story` | Reviewed content → narrative. |
| `POST` | `/ask-guide` | Question → answer drawn only from reviewed content. |

Base URL is configured in the backend as `AI_SERVICE_URL` (default
`http://localhost:8001`).

---

## 3. `POST /generate-story`

### 3.1 Request

```json
{
  "location_id": "jerusalem",
  "location_name": "Old City of Jerusalem",
  "historical_text": null,
  "target_audience": "student",
  "language": "en",
  "tone": "storytelling",
  "is_reviewed": true,
  "max_words": 300
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `location_id` | string | yes* | — | Slug matching `content/ai-ready/*.md` frontmatter and `locations.id` in the database. |
| `location_name` | string | no | from content | Display name; only used for the title when content is supplied inline. |
| `historical_text` | string | yes* | `null` | Reviewed source text. Max 60 000 characters. |
| `target_audience` | string | no | `general` | `student` \| `tourist` \| `child` \| `short` \| `historian` \| `general`. |
| `language` | string | no | `en` | `ar` and `en` are accepted. French is currently available in the deterministic tour planner, not in AI story generation. |
| `tone` | string | no | `storytelling` | `neutral` \| `educational` \| `emotional` \| `storytelling`. |
| `is_reviewed` | boolean | no | `true` | `false` is rejected outright — the module refuses unreviewed material. |
| `max_words` | integer | no | per mode | Hard ceiling on the narrative length. |

\* At least one of `location_id` or `historical_text` is required. When both are
present, `historical_text` wins.

### 3.2 Success response

```json
{
  "status": "ok",
  "title": "Muslim Quarter: a Jerusalem walk",
  "summary": "A walk through the Muslim Quarter's reviewed architectural and social record.",
  "narrative": "As you enter the Muslim Quarter, follow the reviewed route through its streets and monuments ...",
  "target_audience": "student",
  "language": "en",
  "tone": "storytelling",
  "word_count": 318,
  "uncertainty_notes": [
    "Gaps the AI must not fill: exact founding date, population figures, ..."
  ],
  "warnings": [],
  "source": {
    "location_id": "muslim-quarter",
    "location_name": "Muslim Quarter",
    "content_file": "content/ai-ready/muslim-quarter-summary.md",
    "summary_file": "content/ai-ready/muslim-quarter-summary.md",
    "provided_inline": false
  },
  "model": {
    "provider": "offline-extractive",
    "name": "hikaya-extractive-v1"
  },
  "error": null
}
```

| Field | Type | Notes |
|---|---|---|
| `status` | string | `ok`, `partial`, or `error`. |
| `title` | string | Suggested title. |
| `summary` | string | One sentence. |
| `narrative` | string | The story. May contain blank lines and `- ` bullet lines. |
| `word_count` | integer | Words in `narrative`. |
| `uncertainty_notes` | string[] | Gaps the module refused to fill. **Not** an error — see §6. |
| `warnings` | string[] | Fact-guard findings. Non-empty means `status` is `partial`. |
| `source` | object | Provenance. The frontend shows `content_file` as the citation. |
| `model` | object | `provider` is `anthropic` or `offline-extractive`. |
| `error` | object\|null | Populated only when `status` is `error`. |

### 3.3 Error response

```json
{
  "status": "error",
  "narrative": "",
  "error": {
    "code": "unknown_location",
    "message": "No reviewed content found for location_id 'atlantis'. Add a summary in content/ai-ready/ before requesting a story."
  }
}
```

All other fields are present with empty defaults, so the backend can deserialise
one shape either way.

---

## 4. `POST /ask-guide`

### 4.1 Request

```json
{
  "question": "And when was that?",
  "location_id": "jerusalem",
  "historical_text": null,
  "language": "en",
  "history": [
    { "question": "Tell me about the Dome of the Rock",
      "answer": "Dome of the Rock - completed 691-692 CE ..." }
  ]
}
```

`history` carries earlier turns of the same conversation, oldest first, capped at
six. It exists so a short follow-up can be understood — it is **never** a source
of facts, and answers still come only from the reviewed content.

### 4.2 Response

```json
{
  "status": "ok",
  "answer": "Dome of the Rock - completed 691-692 CE; one of the oldest Islamic buildings still standing ...",
  "answered_from_source": true,
  "excerpts": ["Dome of the Rock - completed 691-692 CE; ..."],
  "uncertainty_notes": [],
  "source": { "location_id": "jerusalem", "...": "..." },
  "model": { "provider": "offline-extractive", "name": "hikaya-extractive-v1" },
  "error": null
}
```

`answered_from_source: false` means the reviewed records do not hold the answer.
The `answer` field then carries a plain refusal, and the frontend should show it
as-is rather than treating it as a failure.

---

## 5. Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `missing_content` | 400 | Neither `location_id` nor usable `historical_text` was supplied, or the body was not JSON. |
| `content_not_reviewed` | 400 | `is_reviewed` was `false`, or the summary file is not marked reviewed. |
| `unsupported_audience` | 400 | Unknown `target_audience` or `tone`. |
| `unsupported_language` | 400 | Language not implemented. Fall back to `en`. |
| `content_too_long` | 400 | `historical_text` over 60 000 characters. |
| `unknown_location` | 404 | No reviewed summary exists for that `location_id`. |
| `generation_failed` | 500 | The content parsed but produced no usable narrative. |

The backend maps these to its own HTTP responses and, on any failure, falls back
to its local simplifier so the user still sees something. See
[`docs/integration-guide.md`](../docs/integration-guide.md).

---

## 6. `uncertainty_notes` vs `warnings`

These are easy to confuse and mean opposite things.

| | `uncertainty_notes` | `warnings` |
|---|---|---|
| Produced by | The generator, before writing | The fact guard, after writing |
| Means | "The source does not cover this, so I left it out" | "The output contains something I could not find in the source" |
| Good or bad | **Good** — the module doing its job | **Bad** — needs a human look |
| Effect on `status` | None (`ok`) | Downgrades to `partial` |
| Show to the user? | Yes, as a footnote | No — route to a reviewer |

---

## 7. Fallback behaviour

| Situation | AI module behaviour |
|---|---|
| Source content missing or empty | `missing_content` error. No narrative. |
| Location has no reviewed summary | `unknown_location` error. No narrative. |
| Content not marked reviewed | `content_not_reviewed` error. |
| Source does not answer a guide question | `answered_from_source: false` and a plain refusal. |
| Model output contains unsupported facts | `warnings` populated, `status: partial`. The narrative is still returned for review, never silently edited. |
| Model backend unavailable (no key, network error, rate limit) | Silently falls back to the offline extractive backend. `model.provider` reports which one ran. |
| Requested language unsupported | `unsupported_language` error; caller falls back to `en`. |

---

## 8. Examples for backend testing

Ready-made request/response pairs live in [`examples/`](examples/) as matching
`.md` and `.json` files, regenerated by `python3 scripts/generate_examples.py`:

| File | Covers |
|---|---|
| `muslim-quarter-student.json` | `student` mode and learning structure |
| `christian-quarter-tourist.json` | on-site `tourist` mode |
| `armenian-quarter-child.json` | warm, simplified `child` mode |
| `maghariba-quarter-historian.json` | evidence-led `historian` mode |
| `bab-al-amud-short.json` | 3–5 sentence `short` mode |
| `heritage-guide-examples.md` | `/ask-guide`, including a refusal |

Quick check against a running service:

```bash
curl -s localhost:8001/generate-story \
  -H 'Content-Type: application/json' \
  -d '{"location_id":"christian-quarter","target_audience":"tourist","language":"ar"}' | head -30
```
