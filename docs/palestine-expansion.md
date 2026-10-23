# Hikaya across Palestine

Hikaya now contains Jerusalem, Ramallah, Hebron and Gaza inside one application. The national home is `/`; the original Jerusalem home is `/jerusalem` and is also reused by `/governorates/jerusalem`. The website displays Hikaya without the hackathon or Q GUIDE labels.

## Experiences

- Each governorate has an exploration page, map, story creation entry point, memory constellation, progress tracker and private memory album.
- `/create-story` offers one, several or all governorates, the existing five interests and four duration choices, Arabic/English, six audiences and four tones.
- `/my-story` keeps one saved journey on the device. It combines the chapters into one narrative, provides narration, an interactive chapter map, a guide scoped to those chapters, source links, and links to each place's story, timeline, gallery, quiz and contribution form.
- Shared location detail components handle every governorate. Missing media, before/after pairs, timelines, oral accounts and artisan material have honest empty states.
- New journeys are cultural reading/listening experiences. They provide no invented road routes, travel times, transport or access claims. Jerusalem's existing route planner and approximate walking information remain available through their original routes.
- Official Hikaya logo assets and the warm-background blending from the rebrand remain in use.

## Preservation

The original eight Jerusalem records, slugs, coordinates, content, photographs, summaries, quiz data, timeline data and published stories were retained. Existing API URLs and browser storage/event keys remain valid. The legacy `/api/v1/locations` response remains the eight Jerusalem sites, and daily/random featured stories retain the existing collection.

`tests/jerusalem-baseline.json` records 23 original content/asset hashes and 56 pre-expansion API responses. `tools/check-jerusalem-preservation.py` verifies original heritage values and collection lengths; additional geographic metadata is allowed. The original in-memory story repository generates `createdAt`/`updatedAt` at every startup, so only those runtime seed timestamps are excluded when the health endpoint confirms in-memory mode. PostgreSQL timestamps remain exact comparisons. The database check runs the migration and additive seed twice in an isolated PostgreSQL-compatible PGlite instance and verifies every original row in seven tables.

## Modules and files

| Layer | Main changes |
| --- | --- |
| Shared content | `content/palestine/catalog.json`; six new `content/ai-ready/*-summary.md` files; `tools/generate-palestine-data.py` |
| Frontend | `src/data/heritage.ts`; national home, governorate, map, creation and saved-story pages; `services/journeys.ts`; routes, layout, API fallbacks and shared detail/progress/memory components |
| Backend | `src/governorates/`, `src/journeys/`, scoped locations/AI services, geographic entity fields, repositories and national in-memory seed |
| Python AI | `service/scope.py`, `service/journeys.py`, scoped requests, source references, bilingual new-record rendering, multi-location guide retrieval and both HTTP servers |
| PostgreSQL | `migrations/002-governorates.sql`, `seed-palestine.sql` |
| Verification | Frontend journey/rendering tests, backend journey and HTTP tests, Python scope tests, preservation/migration/local integration scripts |

## Database upgrade

For an **existing database**, run only these additive scripts from the repository root. Substitute your existing database name for `hikaya` if necessary.

```sh
psql -d hikaya -f database/migrations/002-governorates.sql
psql -d hikaya -f database/seed-palestine.sql
```

Both scripts are repeatable. They do not delete or replace existing heritage/user rows. Existing locations receive `governorate_id=jerusalem`; new records must declare a review status. The existing `schema.sql` is a fresh-install script that resets tables and must not be used to upgrade a populated database.

For a new, empty database, run `schema.sql`, `seed.sql` and `seed-generated.sql` first, followed by the two scripts above. PostgreSQL is optional locally: the backend's in-memory repositories serve the same four governorates and fourteen locations.

## API additions

| Request | Result |
| --- | --- |
| `GET /api/v1/governorates` | Governorate names, descriptions, map configuration and location counts |
| `GET /api/v1/governorates/:id` | Governorate configuration |
| `GET /api/v1/governorates/:id/locations` | Published locations in that governorate |
| `GET /api/v1/locations?scope=all` | All published locations |
| `GET /api/v1/locations?governorateId=hebron` | Scoped location list; no query preserves the Jerusalem collection |
| `POST /api/v1/journeys` | A single cultural journey with scoped chapters and resource/source links |
| `POST /generate-journey` on the AI service | Joined, fact-guarded narratives and provenance from the selected reviewed records |

Example backend journey body:

```json
{
  "governorateIds": ["jerusalem", "hebron"],
  "interests": ["history", "architecture"],
  "duration": "express",
  "language": "ar",
  "targetAudience": "student",
  "tone": "educational"
}
```

Backend story requests accept `governorateId`; guide requests accept `governorateIds` and `locationIds`. The Python equivalents use snake_case. Cross-governorate IDs are rejected. Scoped inline text cannot replace the reviewed record. Source-review failures cannot become local generated stories. Generated narratives remain unapproved; persisted location narratives use the existing `pending_review` queue. Guide responses include each source's governorate and references.

## Sources and review limits

The six new records are deliberately bounded factual extracts, checked against these primary sources on 21 October 2026. The Yasser Arafat Museum record includes its official architectural description, preserved headquarters area, archive and public facilities. `source_checked` describes the factual record; it does not approve an AI-generated narrative.

| Governorate | Place | Primary source |
| --- | --- | --- |
| Ramallah | Palestinian Museum, Birzeit | [Museum questions and answers](https://palmuseum.org/en/node/3720), [official location map](https://palmuseum.org/en/visits/how-to-find-us) |
| Ramallah | Yasser Arafat Museum | [Official introduction](https://www.yam.ps/), [museum mission and design](https://www.yam.ps/page-1-ar.html), [Resource Centre](https://www.yam.ps/page-12184-ar.html), [Forum Hall](https://www.yam.ps/page-12185-ar.html), [Exhibition Hall](https://www.yam.ps/page-12186-ar.html) |
| Hebron | Old Town | [UNESCO property 1565](https://whc.unesco.org/en/list/1565/) |
| Hebron | Ibrahimi Mosque | [Hebron Rehabilitation Committee](https://www.hebronrc.ps/xindex.php/en/node/275) |
| Gaza | Great Omari Mosque | [UNESCO tentative-list entry 6955](https://whc.unesco.org/en/tentativelists/6955/) |
| Gaza | Saint Porphyrius Church | [UNESCO tentative-list entry 6955](https://whc.unesco.org/en/tentativelists/6955/) |

Religious attribution is identified as tradition. The Gaza tentative-list reference is not presented as World Heritage inscription. Timelines contain only documented dated events; quizzes ask about facts in these records and link their evidence.

No reviewed new photographs, before/after pairs, oral histories or artisan records were added. Exact mapped coordinates are still pending for Yasser Arafat Museum and Ibrahimi Mosque; both remain selectable in the site list without fabricated markers. Other coordinates are reference points, not entrances or permission to visit. Current site condition and access are not asserted.

National journeys support Arabic/English. The original Jerusalem planner retains Arabic/English/French. This local run has no provider API keys: the AI uses its fact-guarded extractive mode; narration uses the existing device-voice fallback. Contributions still need a real backend and never fabricate submission receipts.

## Adding a governorate or reviewed content

Add its configuration and bilingual records to `content/palestine/catalog.json`, then run:

```sh
python tools/generate-palestine-data.py
```

The exporter updates matching frontend/backend JSON, AI-ready summaries and the additive SQL seed. Map bounds and navigation derive from the catalogue. New material must set `reviewed: false` and a pending review status until its claims and references are checked; it is excluded from published fallback locations and AI retrieval. Apply the additive seed to the database after the migration. Existing rows are not overwritten by regeneration or reseeding; edits to published database content need the normal editorial update process.

## Checks and local run

```sh
cd frontend
npm run lint
npm run build
node node_modules/tsx/dist/cli.mjs tests/journeys.test.ts
node node_modules/tsx/dist/cli.mjs tests/render-pages.test.tsx
cd ../backend
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
cd ../ai
python -m unittest discover -s tests -v
cd ..
python tools/check-jerusalem-preservation.py --api http://localhost:3000/api/v1
python tools/check-palestine-local.py
```

On this Windows machine `py -X utf8` can replace `python`. The isolated migration check is `node tools/check-migration.mjs <path-to-pglite-dist/index.js>`; its test-only dependency was installed in a temporary directory, with no project dependency/lockfile changes.

Frontend type check/build and selection/offline/rendering tests passed. Backend build, 51 unit tests and four HTTP tests passed; Python's 39 tests passed. The migration preserved the seven original tables' rows on two runs. The live integration script checks bilingual single/multi/all journeys, scoped guide provenance/refusals, every new location's resources and missing-media states, the legacy AI path and SPA route responses. Static rendering verifies bilingual navigation, scoped wizard/album copy, regional marker counts and preserved Jerusalem map defaults; browser interaction and responsive visual review were unavailable in this session.

The services run locally at `http://localhost:5173` (web), `http://localhost:3000/api/v1` (backend), and `http://localhost:8001` (AI). Service logs and process IDs are in the Windows temporary directory `hikaya-local-20261009`. Vite reports its existing large-bundle advisory; it does not block the build.
