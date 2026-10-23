# Database Module

## Production initialization

For Render, follow [the production guide](../docs/render-deployment.md).
From a complete checkout with `backend` dependencies installed, securely set
`DATABASE_URL` and run `node backend/scripts/database.mjs initialize` only for a
new empty database. It refuses a populated public schema and commits all data
atomically. Later use `node backend/scripts/database.mjs migrate`.

The manual development setup below resets data. **Both `schema.sql` and
`seed.sql`/`seed-generated.sql` contain destructive statements. Do not run them
directly against production.** In-memory repositories are development-only;
production refuses startup without a reachable, initialized PostgreSQL database.

PostgreSQL implementation of the Hikaya data model.

## Files

| File | Purpose |
|---|---|
| `schema.sql` | The PostgreSQL implementation — tables, keys, constraints, indexes, triggers. Run this first. |
| `migrations/002-governorates.sql` | Non-destructive governorate upgrade for existing databases. |
| `migrations/004-accounts.sql` | Optional visitor accounts: sessions, synced progress, private journey photos and saved stories. Additive. |
| `seed-palestine.sql` | Additive national configuration and six source-checked location records. |
| `seed.sql` | Hand-written seed: users, categories, locations, stories, contributions. Run this second. |
| `seed-generated.sql` | **Generated** seed: timeline, media and quiz rows. Run this third. Produced by `python3 ai/scripts/export_seed_data.py` from the content files — do not edit it. |
| `schema-draft.md` | The Sprint 1 design draft that `schema.sql` implements. Kept for reference. |
| `HikayaSchema.png` | ER diagram of the draft. |

## Requirements

PostgreSQL **13 or newer** — `schema.sql` uses the built-in `gen_random_uuid()`.

## Setup

```bash
createdb hikaya
psql -d hikaya -f database/schema.sql
psql -d hikaya -f database/seed.sql
psql -d hikaya -f database/seed-generated.sql
psql -d hikaya -f database/migrations/002-governorates.sql
psql -d hikaya -f database/seed-palestine.sql
psql -d hikaya -f database/migrations/004-accounts.sql
```

Then point the backend at it in `backend/.env`:

```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/hikaya
```

All three scripts are re-runnable. `schema.sql` drops and recreates the MVP tables, so
running it again resets everything — do not run it against a database holding real
user contributions.

Upgrade an existing database with **only** `migrations/002-governorates.sql`,
`seed-palestine.sql` and `migrations/004-accounts.sql`; these preserve existing heritage and user rows and may be
repeated safely. See [upgrade and validation details](../docs/palestine-expansion.md).

Verify the seed:

```bash
psql -d hikaya -c "SELECT id, name, city FROM locations ORDER BY id;"
```

## Tables

| Table | Holds |
|---|---|
| `users` | Platform accounts. Only editors/admins sign in during the MVP. |
| `locations` | The heritage sites shown on the map. |
| `categories` | Content categories (historical, religious, archaeological, cultural). |
| `location_categories` | Many-to-many join between locations and categories. |
| `stories` | Narratives for a location — editor-written or AI-generated. |
| `media` | Media *metadata* with credit, licence and era. No media files are stored in this repository. |
| `timeline_events` | The historical timeline shown per location, with tradition-based entries flagged. |
| `quiz_questions` | Comprehension questions, each carrying the source its answer comes from. |
| `contributions` | User-submitted memories, awaiting review, each with a reference code. |

### Relationships

```
users ──< stories >── locations ──< media
  │                       │
  └──< contributions >────┘
                          │
locations >──< location_categories >──< categories
                          │
              contributions >── categories
```

- One user can author many stories and submit many contributions.
- One location can have many stories, many media items, and many contributions.
- A location can belong to several categories, and a category can hold several locations.

### Slug primary keys on `locations`

`locations.id` is a human-readable Jerusalem place slug — such as `muslim-quarter`,
`sheikh-jarrah`, or `bab-al-amud` — not a UUID. The same slug is used in three other places:

- the API path: `GET /api/v1/locations/muslim-quarter`
- the AI-ready content frontmatter: `location_id: muslim-quarter` in
  `content/ai-ready/muslim-quarter-summary.md`
- the frontend route: `/locations/muslim-quarter`

One identifier across all layers is what lets the backend find the right content file
for a location when it calls the AI service, with no lookup table in between. Every
other table uses generated ids (`gen_random_uuid()::text`), except the seeded rows,
which use readable ids so the seed file is easy to follow.

### Review status is enforced in the schema

- `stories.status` — `draft` | `pending_review` | `published` | `rejected`.
  The public API only serves `published`.
- `contributions.status` — `pending_review` | `approved` | `rejected`, defaulting to
  `pending_review`. Nothing a visitor submits becomes public without an editor.
- `stories.uncertainty_notes` is a `TEXT[]` holding the gaps the AI flagged rather than
  filling. It is stored with the story so a reviewer can see what the model refused to
  guess at.

## Seed Contents

- **8 Jerusalem locations** — the four historic quarters plus Sheikh Jarrah, Silwan,
  At-Tur / the Mount of Olives, and Bab al-Amud, each with bilingual names,
  coordinates, description, verified cover image and reviewed summary.
- **4 categories** and their location links.
- Published Jerusalem stories written from the reviewed summaries.
- **64 verified photographs** of the actual Jerusalem sites from Wikimedia Commons,
  eight per location, each with bilingual subject and caption, credit, licence,
  capture date and source page. Historical items include Matson Collection and
  other public-domain archival views.
- **48 timeline events** generated from the AI-ready summaries, with entries that
  rest on tradition rather than documented history flagged.
- **40 quiz questions**, five per location, each naming where in the reviewed content
  its answer comes from.
- **2 approved sample contributions** so the memories view is not empty on a fresh install.
- **2 editor users** with `password_hash` left NULL — no credentials are committed.

All seeded facts come from `content/` and `content/ai-ready/`.

## Running Without PostgreSQL

The backend does not require a database to start. If `DATABASE_URL` is unset or the
server is unreachable, it logs a warning and falls back to an in-memory repository
seeded with the same data as `seed.sql` (`backend/src/database/seed/seed-data.ts`), so
every endpoint still returns real seeded content. See
[`backend/README.md`](../backend/README.md).

Keep `seed-data.ts` and `seed.sql` in step when either changes. The timeline,
media and quiz seeds need no such care: one script regenerates the PostgreSQL,
backend and frontend copies together from the content files.

```bash
python3 ai/scripts/export_seed_data.py
```

It also validates what it generates — a photograph dated before 1990 cannot be
marked "modern", a before/after pair must show the same subject, and every image
must carry a credit and a licence.
