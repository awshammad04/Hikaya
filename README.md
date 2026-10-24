# Hikaya · حكاية

## Production deployment

Use [the Render deployment guide](docs/render-deployment.md) and the root
`render.yaml`. The guide includes service setup, safe PostgreSQL initialization,
custom-domain DNS, verification, and outstanding live checks.

An AI-powered personalized guide and living-memory archive covering Jerusalem,
Ramallah, Hebron and Gaza. The original Jerusalem experience is preserved inside
the national platform. The
Arabic-first interface supports smart walking itineraries, grounded storytelling,
natural narration, exact-place photography, community memories and offline fallback.

The stories are built **only** from reviewed content. When the records do not cover
something, Hikaya says so instead of filling the gap.

---

## Quick Start

For the quickest offline-ready demo, only the frontend is required:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>. If the backend is not running, the interface clearly
switches to bundled heritage data; governorate maps, stories, quizzes and cultural
journeys still work.

For the complete stack, use three terminals from the repository root:

```bash
# Terminal 1 — grounded AI module
cd ai && python3 -m service.server --port 8001

# Terminal 2 — API (uses the in-memory national seed when PostgreSQL is absent)
cd backend && npm install && cp -n .env.example .env && npm run start:dev

# Terminal 3 — web app
cd frontend && npm install && cp -n .env.example .env && npm run dev
```

To enable the more human online narration, set `GEMINI_API_KEY` in
`frontend/.env` and restart the frontend. Without the key, the app says that it is
using the best Arabic voice installed on the device instead of silently sounding
robotic.

To let the heritage guide and stories use a language model, copy
`ai/.env.example` to `ai/.env`, set `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`), and
restart the AI service. The guide then answers from the whole reviewed record of
each place instead of keyword-matched sentences. Without a key the reviewed-content
extractive engine is used. A free-tier Gemini key allows only a few requests per
model per day; enable billing on the key's Google Cloud project for real use.
No Google Maps key is needed: the maps are illustrated and offline.

With PostgreSQL (optional, recommended):

```bash
createdb hikaya
psql -d hikaya -f database/schema.sql
psql -d hikaya -f database/seed.sql
psql -d hikaya -f database/seed-generated.sql
psql -d hikaya -f database/migrations/002-governorates.sql
psql -d hikaya -f database/seed-palestine.sql
psql -d hikaya -f database/migrations/004-accounts.sql
echo 'DATABASE_URL=postgresql://user:password@localhost:5432/hikaya' >> backend/.env
```

Full setup and troubleshooting: [`docs/integration-guide.md`](docs/integration-guide.md).

For an existing populated database, apply only the governorate migration and
national seed above. See [`docs/palestine-expansion.md`](docs/palestine-expansion.md)
for the new routes, content sources, preservation checks and upgrade details.

---

## Repository Layout

| Folder | Contents |
|---|---|
| [`frontend/`](frontend/) | React + Vite web interface |
| [`backend/`](backend/) | NestJS REST API |
| [`database/`](database/) | PostgreSQL schema and seed data |
| [`ai/`](ai/) | Story generation module and the backend JSON contract |
| [`content/`](content/) | Reviewed heritage content and AI-ready summaries |
| [`docs/`](docs/) | Architecture, integration guide and sprint reports |

Each folder has its own README.

---

## Features

- National home and data-driven exploration of Jerusalem, Ramallah, Hebron and Gaza
- A unified “Create My Story in Palestine” journey across selected governorates,
  with narration, map, sourced chapters and a guide scoped to the selection
- Six new bilingual sourced location records, with explicit missing-media and
  coordinate states
- Illustrated Jerusalem map with Old City walls, four named gates, surrounding
  neighbourhoods, route numbering, category filters and visited-site markers
- Arabic-first interface with full RTL behavior and the local Thmanyah font family
- Personalized itinerary wizard with duration/interests, optimized stop ordering,
  walking time, distance, compass direction and live walking-direction links
- A location page per site: story, guide, historical timeline, photograph
  gallery, local artisans, quiz, and the memories people have contributed
- AI-generated stories in student, tourist, child, historian and short modes,
  chosen through an Audience → Style → Generate flow
- Natural online narration with two guide tones, plus ranked offline device voices
- An AI Heritage Guide that answers from reviewed content only, keeps the thread
  of a conversation, and says when it does not know
- A then-and-now slider where the archive holds a matching historical photograph
- Contribution wizard with a reference code, so an anonymous contributor can
  check what happened to their memory
- A heritage quiz whose answers cite where in the content they come from
- The archive drawn as a constellation of shared themes and attached memories
- A downloadable “My Jerusalem Story” souvenir built from visited places, quizzes
  and listened narrations
- Reviewed heritage content for eight Jerusalem quarters, gates and neighbourhoods

## Technology

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 6, React Router 7, Tailwind CSS 4 |
| Backend | NestJS 11 (TypeScript), `pg` |
| Database | PostgreSQL 13+ |
| AI module | Python 3.8+, FastAPI-compatible HTTP service, offline extractive fallback |

---

## The Rule That Shapes the Design

The AI never invents historical facts. It simplifies, rewrites and summarises reviewed
content, and nothing else.

That is enforced, not just stated:

- Content enters only through `content/ai-ready/`. A location with no reviewed summary
  gets a refusal, not a story from general knowledge.
- Religious traditions and oral heritage are stored separately from documented facts
  and must always be attributed.
- Generated text is checked for numbers and proper nouns that do not appear in the
  source; anything unmatched is flagged for a human.
- Gaps come back as uncertainty notes shown next to the story.
- Generated stories and user contributions both land in a review queue. Neither
  reaches a reader without an editor.
- Photographs are real pictures of the actual sites, each shown with its
  photographer and licence. A then-and-now comparison is only offered where the
  archive holds two photographs of the *same* subject.

---

## Current Status

The first integrated prototype works end to end: the frontend reads live data from the
backend, the backend reads PostgreSQL, and story generation runs through the AI module
against the reviewed content files.

Each part also runs alone, and says so when it does — the backend falls back to seeded
in-memory data, the AI module to an offline generator that only reuses source
sentences, the frontend to bundled sample data behind a visible banner. No fallback
pretends to be the real thing.

The current Q GUIDE build contains the eight Jerusalem locations, Arabic and English
interfaces, reviewed Arabic generation fallbacks, exact-place licensed media, route
planning and progress souvenirs. The editor review interface, authentication and
direct media upload remain outside this prototype; contribution moderation is already
enforced by status and reference code.
