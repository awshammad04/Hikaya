# Hikaya — Integration Guide

How the five parts of Hikaya fit together, and how to run the whole thing.

Written for Sprint 2, where the components stopped being separate projects and
started being one system.

---

## 1. The Parts

| Part | Folder | Runs on | Talks to |
|---|---|---|---|
| Frontend | `frontend/` | `:5173` | Backend |
| Backend | `backend/` | `:3000` | PostgreSQL, AI module |
| Database | `database/` | `:5432` | — |
| AI module | `ai/` | `:8001` | Content files |
| Content | `content/` | files on disk | — |

---

## 2. The Integrated Flow

```
 ┌──────────┐   GET /locations              ┌──────────┐   SELECT        ┌────────────┐
 │          │ ────────────────────────────▶ │          │ ──────────────▶ │ PostgreSQL │
 │ Frontend │   GET /locations/:id          │ Backend  │ ◀────────────── │ locations  │
 │  :5173   │   GET /stories/:locationId    │  :3000   │                 │ stories    │
 │          │   GET /contributions          │          │                 │ media      │
 │          │ ◀──────────────────────────── │          │                 │ contribs   │
 └──────────┘                               └──────────┘                 └────────────┘
      │                                          │
      │  POST /ai/generate-story                 │  POST /generate-story
      │  { locationId, targetAudience }          │  { location_id, target_audience }
      ▼                                          ▼
 ┌──────────┐                              ┌──────────┐   reads          ┌────────────────────┐
 │  Story   │                              │    AI    │ ───────────────▶ │ content/ai-ready/  │
 │ section  │ ◀─── narrative + notes ───── │  :8001   │                  │ *-summary.md       │
 └──────────┘                              └──────────┘                  └────────────────────┘
```

Step by step, the minimum flow Sprint 2 asks for:

1. **User opens the frontend.** `HomePage` calls `GET /api/v1/locations`.
2. **User sees eight Jerusalem locations** — the four historic quarters plus Sheikh
   Jarrah, Silwan, At-Tur and Bab al-Amud — as cards and markers on `/map`.
3. **User selects one.** For example, the route becomes `/locations/muslim-quarter`.
4. **Frontend shows details and related content**: `GET /locations/muslim-quarter`,
   `GET /stories/muslim-quarter`, and
   `GET /contributions?locationId=muslim-quarter`, in parallel.
5. **User requests an AI story**, choosing an audience. The frontend sends
   `POST /ai/generate-story { locationId, targetAudience, tone }`.
6. **Backend sends the request to the AI module** as
   `POST :8001/generate-story { location_id, target_audience, ... }` — the slug, not
   the content.
7. **AI module loads the reviewed content** from
   `content/ai-ready/muslim-quarter-summary.md`, builds the narrative, runs the fact guard,
   and returns the narrative with its uncertainty notes and provenance.
8. **Backend stores the story** with status `pending_review` and returns it.
9. **Frontend displays the story**, with the source file and the uncertainty notes.
10. **User submits a contribution** via `POST /contributions`; it is stored as
    `pending_review` and confirmed on screen.

### The identifier that ties it together

One Jerusalem slug — such as `muslim-quarter`, `silwan` or `bab-al-amud` — is used everywhere:

```
locations.id in PostgreSQL
  = location_id in content/ai-ready/*.md frontmatter
  = /api/v1/locations/:id
  = /locations/:id in the frontend
```

There is no mapping table anywhere, and no translation step to get wrong.

---

## 3. Running Everything

Three terminals:

```bash
# 1. AI module (no dependencies needed)
cd ai
python3 -m service.server --port 8001

# 2. Backend
cd backend
npm install
cp .env.example .env
npm run start:dev            # http://localhost:3000/api/v1

# 3. Frontend
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

With PostgreSQL (optional but recommended):

```bash
createdb hikaya
psql -d hikaya -f database/schema.sql
psql -d hikaya -f database/seed.sql
psql -d hikaya -f database/seed-generated.sql
# then set DATABASE_URL in backend/.env
```

Confirm what is actually wired up:

```bash
curl -s localhost:3000/api/v1/health
curl -s localhost:8001/health
```

---

## 4. Every Component Also Works Alone

Sprint 2 requires that if the full integration is not up, each part still works and
the connection is documented. Each one degrades on its own, loudly:

| If this is down | What happens | How you can tell |
|---|---|---|
| **PostgreSQL** | Backend serves an in-memory copy of `seed.sql`. All endpoints work; new contributions live only for the process lifetime. | `GET /health` reports `"dataSource": "in-memory-seed"`, and a warning is logged at boot. |
| **AI module** | `POST /ai/generate-story` returns the stored location description instead of a narrative. | `generatedBy: "backend-fallback"` and an uncertainty note saying the service was not reached. |
| **Backend** | Frontend reads fall back to bundled sample data. Contribution submission fails loudly. | A "sample data" banner naming the unreachable URL. |
| **Model API key** | The AI module uses its offline extractive generator, which reassembles source sentences. | `model.provider: "offline-extractive"`. |

Nothing silently pretends to be something it is not. Every fallback names itself in
the response.

Testing each part alone:

```bash
cd ai      && python3 -m unittest discover -s tests     # 30 tests
cd backend && npm test                                  # 40 tests
cd frontend&& npm run lint && npm run build
```

---

## 5. The Two Data Contracts

### Frontend ↔ Backend

Documented with example requests and responses in
[`backend/README.md`](../backend/README.md). TypeScript shapes live in
`frontend/src/types.ts` and mirror `backend/src/database/entities/`.

The backend speaks camelCase throughout.

### Backend ↔ AI module

Documented in [`ai/api-contract.md`](../ai/api-contract.md), with ready-made
request/response pairs in `ai/examples/*.json`.

The AI module speaks snake_case; `backend/src/ai/ai.service.ts` converts between the
two so the frontend only ever sees one convention.

---

## 6. Where the Content Comes From

```
content/ai-ready/*-summary.md   reviewed Jerusalem research
        │
        │  condensed by the Content Documentation Team
        ▼
content/ai-ready/muslim-quarter-summary.md
        │  frontmatter: location_id, name, coordinates, reviewed
        │  eight fixed sections, with facts / religious traditions /
        │  oral heritage kept apart
        ├──────────────────────────────┐
        ▼                              ▼
ai/service/content_loader.py    ai/scripts/export_seed_data.py
  the only door facts             also reads content/media/media.json
  enter through                   and content/quiz/quiz.json
        ▼                              ▼
ai/service/generator.py         database/seed-generated.sql
  prompt built from               backend/.../generated-data.ts
  this file alone                 frontend/.../generatedMockData.ts
```

The timeline, gallery and quiz have to exist at three layers for the system to
work offline everywhere. One script generates all three from the content files
and validates them, so they cannot drift apart - and so the frontend's "sample"
timeline can never contradict the real one.

If a location has no reviewed summary, generation fails with `unknown_location`
rather than falling back to whatever a model happens to know. That refusal is the
feature.

---

## 7. Review Gates

Two things never reach a reader without a person:

| Content | Arrives as | Becomes public when |
|---|---|---|
| AI-generated story | `stories.status = 'pending_review'` | An editor sets it to `published` |
| User contribution | `contributions.status = 'pending_review'` | An editor sets it to `approved` |

The read paths filter on those columns, so the gate is enforced in the query, not by
convention. The review interface itself is not built yet — that is the honest gap in
Sprint 2, and the status columns are in place for whoever builds it.

---

## 8. Ports

| Service | Port | Why |
|---|---|---|
| Frontend | 5173 | Vite's default; moved off 3000 in Sprint 2 to stop colliding with the API |
| Backend | 3000 | `PORT` in `backend/.env` |
| AI module | 8001 | `AI_SERVICE_URL` in `backend/.env` |
| PostgreSQL | 5432 | `DATABASE_URL` in `backend/.env` |
