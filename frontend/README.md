# Frontend Module

The Arabic-first Hikaya interface covers Jerusalem, Ramallah, Hebron and Gaza.
The original Jerusalem experience remains intact alongside national navigation,
governorate maps and a unified cultural story builder.

See [Palestine expansion](../docs/palestine-expansion.md) for routes, shared
components, fallback behavior, content limits and verification commands.

## Framework

- **React 19** with **TypeScript**
- **Vite 6** for the build
- **React Router 7** for routing
- **Tailwind CSS 4** for styling
- **Motion** (`motion/react`) for page transitions and reveals, honouring `prefers-reduced-motion`
- **lucide-react** for icons
- **Express** (`server.ts`) as the dev/production host and streaming natural-voice proxy

## Installation

```bash
cd frontend
npm install
cp .env.example .env
```

Nothing in `.env` is required. The browser uses the same-origin `/api/v1`
bridge; the frontend server forwards it to `http://127.0.0.1:3000/api/v1` by
default and falls back to bundled sample data if the backend is not running.
Override the server-side destination with `HIKAYA_API_BASE_URL` when needed.

## Run

```bash
npm run dev      # dev server with HMR, http://localhost:5173
npm run build    # production bundle into dist/
npm run start    # serve the production build
npm run lint     # tsc --noEmit
```

The dev server listens on **5173**, not 3000, so it does not collide with the
backend API. Override with `PORT` in `.env`.

If 5173 is already taken it steps up to the next free port and says so:

```
[Hikaya Server] Port 5173 is already in use - using 5175 instead.
[Hikaya Server] Running on http://localhost:5175
```

Always trust that line over the default. The check connects to both `127.0.0.1`
and `::1` rather than just trying to bind, because on macOS another dev server
holding `[::1]:5173` and this one binding the wildcard can coexist happily - and
then `localhost` resolves to `::1` first and quietly serves you the other
project.

For the full experience, run all three parts:

```bash
cd ai      && python3 -m service.server --port 8001   # AI module
cd backend && npm run start:dev                       # API on :3000
cd frontend&& npm run dev                             # UI on :5173
```

## Main Pages

| Route | Page | What it does |
|---|---|---|
| `/` | Home | Hero with an "Ask Hikaya" call to action, the story of the day, location cards with counts, exploration progress, and a walking-tour offer |
| `/plan-tour` | Smart planner | Language, duration and interests → an ordered Jerusalem walking route |
| `/map` | Interactive map | Zoom/pan, dynamic labels, route steps, filters, visited marks and live directions |
| `/locations/:id` | Location details | Story, Ask, Timeline, Gallery, Quiz, Memories, local artisans and related places |
| `/constellation` | Connections | The archive drawn as a web of shared themes and attached memories |
| `/contribute` | Contribution wizard | Four steps, a reference code, and a status lookup; `?location=<slug>` preselects a site |
| `/about` | About | Project background |
| `/explorer` | Compatibility URL | Redirects to the current Jerusalem map |

Route ids are the same Jerusalem slugs used by the API, database and reviewed
content (for example `muslim-quarter`, `silwan` and `bab-al-amud`).

## Integration Status

**Connected to the backend.** Every read on the MVP pages goes through
[`src/services/api.ts`](src/services/api.ts):

| Screen | Endpoint |
|---|---|
| Home, Map, Contribute | `GET /api/v1/locations` |
| Story of the day / Surprise me | `GET /api/v1/stories/featured`, `/stories/random` |
| Location details | `GET /api/v1/locations/:id` |
| Reviewed stories | `GET /api/v1/stories/:locationId` |
| Timeline tab | `GET /api/v1/locations/:id/timeline` |
| Gallery tab | `GET /api/v1/locations/:id/media`, `/before-after` |
| Quiz tab | `GET /api/v1/locations/:id/quiz` |
| Related places | `GET /api/v1/locations/:id/related` |
| Published memories | `GET /api/v1/contributions?locationId=` |
| Story wizard | `POST /api/v1/ai/generate-story` |
| Heritage guide | `POST /api/v1/ai/ask-guide` |
| Contribution wizard | `POST /api/v1/contributions` |
| Status lookup | `GET /api/v1/contributions/status/:code` |

### Mock data and how it is handled

Sprint 2 allows temporary mock data with the same final structure. This is
implemented, but with a rule attached: **mock data is never presented as live data.**

- [`src/mocks/mockApiData.ts`](src/mocks/mockApiData.ts) holds the same records as
  `database/seed.sql`, in the same shape as the API returns.
- Every read returns `{ data, source }` where `source` is `"backend"` or `"mock"`.
- When it is `"mock"`, the page shows a visitor-friendly offline-mode banner.
- A `404` from a working backend is a real answer, not a reason to fall back.
- **Writes never fall back.** If a contribution cannot be submitted, the form says so
  and warns you to copy your text. Showing a fake receipt for something that was never
  saved would be worse than an error. The status lookup does not fall back either.
- The offline guide answers only the topics covered by the bundled reviewed place
  record. Questions outside it receive an explicit refusal rather than a guess.

So switching between mock and live changes nothing on screen except that banner.

## Project Structure

```
frontend/src/
├── App.tsx                     # routes
├── components/
│   ├── AppLayout.tsx           # header, nav, footer
│   ├── motion.tsx              # PageTransition, Reveal, Stagger - all reduced-motion aware
│   ├── Skeleton.tsx            # loading placeholders shaped like their content
│   ├── MvpLocationMap.tsx      # map driven by API data, with filters and legend
│   ├── LocationCard.tsx        # with story/photo/timeline/memory counts
│   ├── FeaturedStoryCard.tsx   # story of the day
│   ├── CoverImage.tsx          # hides itself if the photo fails to load
│   ├── Tabs.tsx                # roving-tabindex tab bar
│   ├── HistoricalTimeline.tsx  # flags tradition-based entries
│   ├── Gallery.tsx             # lightbox, keyboard control, per-image credit
│   ├── BeforeAfterSlider.tsx   # only where a real pair exists
│   ├── StoryWizard.tsx         # Audience -> Style -> Generate
│   ├── NarrativeReader.tsx     # timestamp-synced text + read-aloud controls
│   ├── StoryNarrator.tsx       # story-facing synchronized reader adapter
│   ├── TransparencyPanel.tsx   # public bibliography, generator and documented gaps
│   ├── HeritageChat.tsx        # per-location guide, with the "we don't know" invitation
│   ├── HeritageQuiz.tsx        # questions that cite their sources
│   ├── ContributionWizard.tsx  # four steps, reference code
│   ├── ContributionStatusLookup.tsx
│   ├── ProgressTracker.tsx     # visited locations and badges
│   ├── WalkingTour.tsx         # geolocation, computed in the browser
│   ├── MemoryConstellation.tsx
│   ├── LocalArtisansSection.tsx
│   ├── MyJerusalemStoryModal.tsx
│   └── DataSourceBanner.tsx    # offline-mode notice
├── pages/
│   ├── HomePage.tsx
│   ├── MapPage.tsx
│   ├── LocationDetailsPage.tsx
│   ├── ContributePage.tsx
│   ├── ConstellationPage.tsx
│   ├── AboutPage.tsx
├── services/api.ts             # API client, fallback, error handling
├── hooks/
│   ├── useLocations.ts
│   ├── useVisitedLocations.ts  # localStorage tracker + badges
│   └── useNarration.ts         # streaming natural voice + offline device voice
├── mocks/
│   ├── mockApiData.ts
│   └── generatedMockData.ts    # GENERATED from content/ - do not edit
├── types.ts                    # API shapes
└── locationsData.ts            # Jerusalem profiles and local-economy highlights
```

## Design Notes

The interface uses olive and amber on warm off-white, the local Thmanyah font family,
careful RTL rhythm, generous whitespace and reduced-motion support.

Two things are always shown alongside an AI-generated story, because the content
workflow depends on them:

- **human-readable public citations** for the reviewed records, and
- **the uncertainty notes** — what the records do not cover and the AI therefore
  refused to guess at.

Fact-guard warnings, if any, are shown in a separate red block marked for review, never
mixed into the story text.

Motion is decoration: every animation checks `prefers-reduced-motion` and collapses to a
plain fade or nothing at all. Skeletons mirror the shape of the content they stand in
for, so the page does not jump when data lands.

`src/mocks/generatedMockData.ts` is generated from the content files by
`ai/scripts/export_seed_data.py` — the same script that produces the database and
backend seeds, so the offline timeline, gallery and quiz cannot drift from the real
ones.

## Related

- [`backend/README.md`](../backend/README.md) — the API this app consumes
- [`ai/README.md`](../ai/README.md) — how the stories are generated
- [`docs/integration-guide.md`](../docs/integration-guide.md) — the end-to-end flow
- [`docs/improvements.md`](../docs/improvements.md) — what each feature does and why
