# Sprint 2 — Completion Report

**Project:** Hikaya — AI-Powered Personalized Guide to Jerusalem
**Team:** اوس حماد (Team lead), يزيد الحداد, امير الرشايدة, اسماء عبداللطيف (Software Developers), عبير شبانة (Marketing)
**Sprint:** Sprint 2 — MVP Integration & First Working Prototype
**Repository:** <https://github.com/nooretk/hikaya>

---

## 1. Objective

Build the first integrated MVP prototype of Hikaya by connecting the backend,
database, frontend, AI workflow and content files into one usable system.

**Status: met.** A user can open the frontend, see the eight Jerusalem locations, select
one, read its details and reviewed story, request an AI-generated narrative, and
submit a contribution — with the request travelling frontend → backend → AI module →
content files and back, and the data coming from PostgreSQL.

---

## 2. Deliverables Checklist

| Sprint 2 requirement | Status | Where |
|---|---|---|
| PostgreSQL implementation inside `database/` | Done | `database/schema.sql` |
| Seed data for the eight Jerusalem locations | Done | `database/seed.sql` |
| Working backend endpoints for locations, stories, contributions, AI | Done | `backend/src/` |
| Backend README with run instructions and endpoint documentation | Done | `backend/README.md` |
| First usable frontend pages inside `frontend/` | Done | `frontend/src/pages/` |
| Frontend connected to backend APIs or matching mock data | Done — connected, with matching mock fallback | `frontend/src/services/api.ts` |
| User contribution wizard on the frontend | Done | `frontend/src/components/ContributionWizard.tsx` |
| AI story generation function or script inside `ai/` | Done | `ai/service/generator.py` |
| Audience-specific generated story samples | Done | `ai/examples/` |
| Updated AI-backend JSON contract | Done | `ai/api-contract.md` |
| AI-ready Jerusalem summaries inside `content/ai-ready/` | Done | 8 location files |
| Improved source and media references in the content files | Done | `content/*.md` |
| Regular descriptive commits | Done | one commit per sub-team area |
| Pull request reviewed before merging into `main` | Open for review | this PR |

---

## 3. What Each Sub-Team Delivered

### Backend & Database — Software Development Team

**Task 1 — Database implementation and seed data.**
`database/schema.sql` implements the Sprint 1 draft as real PostgreSQL: `users`,
`locations`, `categories`, `location_categories`, `stories`, `media` and
`contributions`, with foreign keys, check constraints, indexes and `updated_at`
triggers. `database/seed.sql` seeds the eight Jerusalem locations with name, city,
coordinates, description, category links, one published story each, media metadata
with licensing, and two approved sample contributions. Both scripts were run against
PostgreSQL and verified.

Two design decisions worth recording:

- **Locations use readable slug primary keys** (`jerusalem`, not a UUID). The same
  slug is the API path, the `location_id` in the AI-ready content frontmatter, and the
  frontend route. One identifier across four layers removes an entire class of mapping
  bugs.
- **Review status is enforced in the schema.** `stories.status` and
  `contributions.status` are constrained columns, and the read queries filter on them,
  so "nothing publishes without review" is a property of the database rather than a
  habit.

**Task 2 — Working backend APIs.** All five required endpoints return real seeded
data:

```
GET  /api/v1/locations
GET  /api/v1/locations/:id
GET  /api/v1/stories/:locationId
POST /api/v1/contributions
POST /api/v1/ai/generate-story
```

plus `GET /api/v1/health`, `GET /api/v1/contributions` and `POST /api/v1/ai/ask-guide`.

Services depend on repository interfaces through injection tokens, with a PostgreSQL
implementation and an in-memory one seeded from the same data. The backend probes the
database once at boot and picks one, so `git clone && npm install && npm start` gives
working endpoints with real content even before anyone sets up PostgreSQL. 21 unit
tests cover both.

**Task 3 — Backend README.** Rewritten with framework, installation, run commands,
the endpoint table, and worked request/response examples for every endpoint.

### AI Smart Features — Software Development Team

**Task 1 — Story generation function.** `ai/service/` turns the Sprint 1 workflow
document into working code. `generate_story()` supports all four requested modes —
`student`, `tourist`, `child`, `short` (plus `general`) — and enforces the safety rule
at four separate points: content only enters through `content/ai-ready/`, unreviewed
content is refused, traditions must stay attributed, and a fact guard checks the
output for numbers and proper nouns that do not appear in the source. Gaps come back
as `uncertainty_notes` instead of being filled.

There are two backends. The default is an offline extractive generator that
reassembles sentences from the reviewed summary, so it cannot invent a fact by
construction and runs with no key, no network and no dependencies. When
`ANTHROPIC_API_KEY` is set, generation goes through a model under strict prompts, and
falls back to the extractive path on any failure. The response always reports which
one ran.

**Task 2 — Testing with MVP content.** `ai/examples/` holds generated samples for all
multiple Jerusalem locations and audience modes, each recording the input, story, and
the notes about limitations and missing information. They are produced by
`scripts/generate_examples.py`, never hand-written. 26 tests run on a plain Python
install.

**Task 3 — Endpoint integration support.** `ai/api-contract.md` is updated to v2 with
the confirmed request/response JSON, frozen error codes and their HTTP mappings, and
`ai/examples/*.json` as ready-made test payloads for the backend team.

### Frontend — Software Development Team

**Task 1 — Main MVP pages.** Routing added, with home, interactive map, location
details, story narrative section, personalized planner and contribution wizard.
The retired `/explorer` URL redirects to the current Jerusalem map.

**Task 2 — Backend connection.** All MVP reads go through `src/services/api.ts` to the
live API. Mock data with the identical shape exists as a fallback, with one rule
attached: it is never presented as live data. Any page using it shows a clear offline
mode banner. Contribution submission has no fallback at all — a failure
is reported, because a fake receipt for an unsaved memory would be worse than an error.

**Task 3 — Frontend README.** Rewritten with framework, install, run commands, the
page table and the integration status.

### Content Documentation — Hikaya Team

**Task 1 — AI-ready summaries.** `content/ai-ready/` holds one summary per MVP
Jerusalem location with machine-readable frontmatter and fixed sections: overview,
historical timeline, cultural and religious importance, landmarks, key facts,
religious traditions, oral heritage, and source notes.

**Task 2 — References and media.** Each full content file gained a sources and media
section with direct reference links, a media table recording licence per asset, and
review notes listing known gaps. Historical facts, religious traditions and oral
heritage are separated explicitly, and every gallery item carries bilingual context,
credit, licence and a direct source link.

**Task 3 — Content README.** Explains the difference between full content files,
AI-ready summaries, media links and source notes, and documents the
fact/tradition/oral-heritage rule the AI module depends on.

### Project Management — اوس حماد

Branch, commit and review workflow followed: work done off `main` on
`sprint-2-mvp-integration`, one descriptive commit per sub-team area, and this pull
request opened for review before merge.

---

## 4. Verification

Everything below was run, not assumed:

| Check | Result |
|---|---|
| `psql -f database/schema.sql` and `seed.sql` | Applied cleanly to PostgreSQL |
| `backend: npm run build` | Clean |
| `backend: npm test` | 21 passed |
| `backend: npx eslint src/**/*.ts` | Clean |
| `ai: python3 -m unittest discover -s tests` | 26 passed |
| `frontend: npm run lint` (`tsc --noEmit`) | Clean |
| `frontend: npm run build` | Clean |
| Backend against real PostgreSQL | `GET /health` reported `"dataSource": "postgres"` |
| Backend against the running AI service | Story generated, stored as `pending_review` |
| Full flow in a browser | Locations → details → story generation → contribution reached PostgreSQL |
| Fallback behaviour | Backend stopped: the frontend showed the sample-data banner rather than failing |

---

## 5. Challenges

**Making the prototype runnable by anyone.** A demo that needs PostgreSQL, a Python
environment and an API key before it shows anything is a demo nobody runs. The
response was layered fallbacks — in-memory seed, offline generator, frontend sample
data — each of which reports itself in the response so no fallback can be mistaken for
the real thing.

**Keeping the AI honest without a model.** The no-hallucination rule had to be
demonstrable, not just asserted. The extractive generator only reuses source
sentences, which makes the guarantee testable: a test asserts the fact guard finds
nothing to flag in any generated narrative.

**Content in Arabic, interfaces in English.** The reviewed research is Arabic; the
backend, AI module and UI are English. The AI-ready summaries are the bridge, written
in English strictly from the Arabic sources. Arabic output remains unimplemented and
is declared as such rather than half-built.

**Port collision.** The frontend dev server and the API both used 3000. The frontend
moved to 5173.

---

## 6. Known Gaps

Stated plainly, because they matter for Sprint 3:

- **No review interface.** The status columns and filtered queries are in place, but
  nothing lets an editor approve a story or contribution yet. Approval currently means
  an `UPDATE` statement.
- **No Arabic output.** `language: "ar"` returns `unsupported_language`.
- **No authentication.** The `users` table exists; nobody signs in. Contributions are
  anonymous by design for now.
- **The Heritage Guide fallback is a keyword retriever.** It never invents — it selects
  sentences from the source — but with no model configured it can return a
  loosely-related passage. It reports when only part of a question matched.
- **Media is referenced, not stored.** No upload path exists.
- **Contributions submitted without PostgreSQL are lost on restart.** The mode is
  logged loudly at boot.

---

## 7. Next Steps

1. Build the editor review queue so the approval gates can actually be operated.
2. Add Arabic generation, starting with Arabic AI-ready summaries.
3. Add authentication and attach contributions to accounts.
4. Replace the keyword retriever in the Heritage Guide with proper retrieval.
5. Add media upload with licence capture.
6. Continue collecting attributed Jerusalem oral histories through the moderation workflow.

---

**Prepared by:** Hikaya team
**Sprint:** Sprint 2 — MVP Integration & First Working Prototype
