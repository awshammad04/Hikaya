# Backend Module

REST API for Hikaya: locations, stories, user contributions, and AI story
generation, governorate exploration and unified Palestinian cultural journeys.

National scope and upgrade details: [Palestine expansion](../docs/palestine-expansion.md).

## Framework

- **[NestJS](https://nestjs.com/) 11** (TypeScript, Node.js) — chosen in Sprint 1 from
  the FastAPI/NestJS options.
- **PostgreSQL** via [`pg`](https://node-postgres.com/) — plain SQL against the schema
  in [`database/schema.sql`](../database/schema.sql), no ORM. The SQL in the repository
  *is* the schema; there is no second definition to drift from it.
- **`class-validator`** for request validation, applied globally.
- **`@nestjs/axios`** for calls to the AI module in [`ai/`](../ai/).

## Installation

```bash
cd backend
npm install
cp .env.example .env
```

Everything in `.env.example` is optional. With no database and no AI service the API
still starts and serves real seeded data — see [Running without
PostgreSQL](#running-without-postgresql).

To use PostgreSQL (13+):

```bash
createdb hikaya
psql -d hikaya -f ../database/schema.sql
psql -d hikaya -f ../database/seed.sql
psql -d hikaya -f ../database/seed-generated.sql
psql -d hikaya -f ../database/migrations/002-governorates.sql
psql -d hikaya -f ../database/seed-palestine.sql
```

then set `DATABASE_URL` in `.env`.

To use the AI module, start it in another terminal:

```bash
cd ../ai && python3 -m service.server --port 8001
```

## Run

```bash
npm run start:dev     # watch mode
npm run start         # plain
npm run build && npm run start:prod
npm test              # unit tests
```

The API is served at **`http://localhost:3000/api/v1`**.

Check what it is actually talking to:

```bash
curl -s localhost:3000/api/v1/health
```

```json
{
  "status": "ok",
  "dataSource": "postgres",
  "aiServiceUrl": "http://localhost:8001",
  "timestamp": "2026-08-02T10:00:00.000Z"
}
```

`dataSource` is `postgres` or `in-memory-seed`, so there is never any doubt about
where the data came from.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1` | API description and endpoint list |
| `GET` | `/api/v1/health` | Data source and AI service in use |
| `GET` | `/api/v1/locations` | Original Jerusalem collection; `?scope=all` selects the national archive, `?governorateId=` selects a governorate |
| `GET` | `/api/v1/governorates` | Governorate configuration and published location counts |
| `GET` | `/api/v1/governorates/:id/locations` | Locations restricted to the chosen governorate |
| `POST` | `/api/v1/journeys` | A unified cultural journey across selected governorates |
| `GET` | `/api/v1/locations/:id` | One location by slug |
| `GET` | `/api/v1/locations/:id/media` | Gallery images, each with credit and licence |
| `GET` | `/api/v1/locations/:id/before-after` | Historical/present pair of the same subject, or `null` with a reason |
| `GET` | `/api/v1/locations/:id/timeline` | Historical timeline, tradition-based entries flagged |
| `GET` | `/api/v1/locations/:id/quiz` | Comprehension questions, each citing its source |
| `GET` | `/api/v1/locations/:id/related` | Locations sharing a category |
| `GET` | `/api/v1/stories/:locationId` | Published stories for a location |
| `GET` | `/api/v1/stories/location/:locationId` | Same, explicit form |
| `GET` | `/api/v1/stories/detail/:id` | One story by id |
| `GET` | `/api/v1/stories/featured` | The story of the day |
| `GET` | `/api/v1/stories/random` | A random published story (`?exclude=` to skip one) |
| `GET` | `/api/v1/contributions` | Approved contributions (`?locationId=` to filter) |
| `GET` | `/api/v1/contributions/status/:code` | Review status by reference code |
| `POST` | `/api/v1/contributions` | Submit a contribution for review |
| `POST` | `/api/v1/ai/generate-story` | Generate a narrative from reviewed content |
| `POST` | `/api/v1/ai/ask-guide` | Ask the heritage guide a question |

Location ids are readable Jerusalem slugs — `muslim-quarter`, `silwan`, `bab-al-amud` — shared with
the database, the AI-ready content files, and the frontend routes.

## Example Requests and Responses

### `GET /api/v1/locations`

```bash
curl -s localhost:3000/api/v1/locations
```

```json
[
  {
    "id": "muslim-quarter",
    "name": "Muslim Quarter",
    "arabicName": "حارة المسلمين",
    "city": "Jerusalem",
    "country": "Palestine",
    "latitude": 31.7806,
    "longitude": 35.2339,
    "description": "The Old City’s largest quarter, shaped by Mamluk architecture and living markets...",
    "coverImageUrl": "/images/jerusalem/muslim-quarter.jpg",
    "contentFile": "content/ai-ready/muslim-quarter-summary.md",
    "aiSummaryFile": "content/ai-ready/muslim-quarter-summary.md",
    "categories": ["حارة تاريخية", "معلم ديني", "سوق تراثي"],
    "isPublished": true,
    "stats": {
      "storyCount": 1,
      "imageCount": 7,
      "timelineEventCount": 12,
      "memoryCount": 1,
      "readingTimeMinutes": 2
    }
  }
]
```

`stats` is what the location cards show, so a reader knows what is waiting inside
before opening the page. It comes from four grouped queries rather than one per
location, so the cost does not grow with the archive.

Unknown slugs return `404`:

```json
{ "statusCode": 404, "message": "Location with id \"atlantis\" not found", "error": "Not Found" }
```

### `GET /api/v1/stories/muslim-quarter`

```json
[
  {
    "id": "story-muslim-quarter",
    "locationId": "muslim-quarter",
    "title": "Muslim Quarter: a Jerusalem walk",
    "summary": "A walk through stone lanes, markets and Mamluk architecture...",
    "simplifiedStory": "The Muslim Quarter is a living part of Jerusalem’s Old City...",
    "audience": "general",
    "language": "en",
    "tone": "storytelling",
    "source": "content/ai-ready/muslim-quarter-summary.md",
    "isAiGenerated": false,
    "uncertaintyNotes": [],
    "status": "published"
  }
]
```

Only `published` stories are returned.

### `POST /api/v1/ai/generate-story`

```bash
curl -s -X POST localhost:3000/api/v1/ai/generate-story \
  -H 'Content-Type: application/json' \
  -d '{"locationId":"bab-al-amud","targetAudience":"student","language":"ar"}'
```

| Field | Required | Notes |
|---|---|---|
| `locationId` | yes* | Location slug |
| `historicalText` | yes* | Reviewed text, when it is not yet in the repository |
| `targetAudience` | no | `student` \| `tourist` \| `child` \| `short` \| `historian` \| `general` |
| `tone` | no | `neutral` \| `educational` \| `emotional` \| `storytelling` |
| `language` | no | `ar` \| `en` |
| `maxWords` | no | 40–600 |
| `persist` | no | `false` for a throwaway preview |

\* one of the two.

```json
{
  "title": "باب العامود: عتبة القدس الشمالية",
  "summary": "بوابة القدس الشمالية وساحتها الاجتماعية الحية.",
  "narrative": "ابدأ من درجات باب العامود ولاحظ الواجهة العثمانية والمدخل المنكسر...",
  "targetAudience": "student",
  "language": "ar",
  "tone": "storytelling",
  "wordCount": 307,
  "uncertaintyNotes": [
    "Gaps the AI must not fill: exact dimensions of the colonnaded street, ..."
  ],
  "warnings": [],
  "source": {
    "locationId": "bab-al-amud",
    "locationName": "Bab al-Amud",
    "contentFile": "content/ai-ready/bab-al-amud-summary.md",
    "summaryFile": "content/ai-ready/bab-al-amud-summary.md"
  },
  "generatedBy": "offline-extractive",
  "storyId": "1319827b-646b-4064-8b0e-ede9c34d6d1b"
}
```

- `uncertaintyNotes` — gaps the AI declined to fill. Safe to show the reader.
- `warnings` — fact-guard findings. For reviewers, not for the reader.
- `generatedBy` — `anthropic`, `offline-extractive`, or `backend-fallback`.
- `storyId` — the stored story, saved with status `pending_review`. **Generated stories
  are never published automatically**, so they do not appear in
  `GET /stories/:locationId` until an editor approves them.

### `POST /api/v1/contributions`

```bash
curl -s -X POST localhost:3000/api/v1/contributions \
  -H 'Content-Type: application/json' \
  -d '{
    "locationId": "bab-al-amud",
    "title": "ذكريات كعك القدس عند باب العامود",
    "content": "أتذكر رائحة السمسم في الصباح وبائع الكعك قرب الدرج...",
    "contributorName": "Test User"
  }'
```

`201 Created`:

```json
{
  "status": "pending_review",
  "message": "Thank you - your memory was received and is waiting for review before it is published. Keep the reference code below if you want to check on it later.",
  "referenceCode": "HK-7Q4M2X",
  "contribution": {
    "id": "0cbc5287-...",
    "locationId": "bab-al-amud",
    "title": "ذكريات كعك القدس عند باب العامود",
    "status": "pending_review",
    "submittedAt": "2026-08-02T10:00:00.000Z"
  }
}
```

No account is needed. Every submission lands as `pending_review` and is invisible to
`GET /contributions` until approved. `content` must be at least 20 characters; an
unknown `locationId` returns `404`.

The `referenceCode` is how an anonymous contributor finds their memory again:

```bash
curl -s localhost:3000/api/v1/contributions/status/HK-7Q4M2X
```

It returns the status, a plain-language explanation of what happens next, and the
reviewer's note once a decision has been made.

## Running Without PostgreSQL

At boot, `DatabaseService` probes `DATABASE_URL` once. If it is missing or unreachable,
it logs a warning and every repository falls back to an in-memory copy of
`database/seed.sql` ([`src/database/seed/seed-data.ts`](src/database/seed/seed-data.ts)).

```
WARN [DatabaseService] DATABASE_URL is not set - serving seeded in-memory data.
```

The endpoints behave identically; contributions submitted in this mode live only for
the lifetime of the process. This keeps `git clone && npm install && npm start` enough
to see the API working with real content, while the same code runs against PostgreSQL
the moment `DATABASE_URL` points at one.

The same idea covers the AI module: if the service in `ai/` is unreachable,
`/ai/generate-story` returns the stored location description and says so in
`uncertaintyNotes`, with `generatedBy: "backend-fallback"`.

## Project Structure

```
backend/src/
├── main.ts                     # bootstrap: /api/v1 prefix, CORS, global validation
├── app.module.ts               # root module
├── app.controller.ts           # GET /, GET /health
├── database/
│   ├── database.module.ts      # connects, then picks postgres or in-memory repositories
│   ├── database.service.ts     # pg pool wrapper + availability probe
│   ├── entities/               # Location, Story, Contribution
│   ├── repositories/           # one interface + two implementations each
│   └── seed/seed-data.ts       # mirror of database/seed.sql
├── locations/                  # GET /locations, /locations/:id
├── stories/                    # GET /stories/:locationId, /stories/detail/:id
├── contributions/              # POST + GET /contributions
└── ai/                         # POST /ai/generate-story, /ai/ask-guide
```

Services depend on repository *interfaces* through injection tokens, never on a
concrete implementation — which is why the same service code and the same tests cover
both data sources.

## Tests

```bash
npm test
```

40 unit tests over the in-memory repositories: seeded data is real and complete,
review status is enforced, unknown ids 404, the AI client handles success,
service failure and error payloads, the daily story rotation is stable for a
given date, before/after pairs only form from matching subjects, and contribution
reference codes are unique and case-insensitive to look up.

## Related

- [`database/README.md`](../database/README.md) — schema and seed
- [`ai/api-contract.md`](../ai/api-contract.md) — the JSON this backend exchanges with the AI module
- [`docs/integration-guide.md`](../docs/integration-guide.md) — the end-to-end flow
