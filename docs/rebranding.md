# Hikaya · حكاية rebranding

Completed on 9 October 2026.

## Updated files and components

| Area | Files and changes |
|---|---|
| App identity | `frontend/index.html`, `metadata.json`, `package.json`: browser title, descriptions, social metadata and browser app manifest links |
| Layout and pages | `AppLayout.tsx`, `HomePage.tsx`, `AboutPage.tsx`, `ContributePage.tsx`: header logo, accessible names, footer, headings and bilingual copy |
| UI components | `AboutPanel`, `ContributionWizard`, `DataSourceBanner`, `HeritageChat`, `InAppWalkingRouteModal`, `LocalArtisansSection`, `MyJerusalemStoryModal`, `PersonalizedTourModal`, `ProgressTracker`, `WalkingTour`: explanatory copy, badges, logos and downloadable story branding |
| Bundled content | `frontend/src/hooks/useVisitedLocations.ts`, `locationsData.ts`, `mocks/mockApiData.ts`, `backend/src/database/seed/seed-data.ts`, `database/seed.sql`: badge labels, editorial team name and default story descriptions |
| Services and exports | `backend/src/app.service.ts`, `ai/service/prompts.py`, `frontend/server.ts`: API display name, storyteller identity, generated README and ZIP filename; exported bundles now include public assets, originals, generation script and lockfile |
| Tests | `backend/src/app.controller.spec.ts`, `backend/test/app.e2e-spec.ts`: new API name; the outdated starter end-to-end test now checks the real API route and endpoints |
| Documentation | Root `README.md`, `HANDOFF.md`, frontend/content READMEs, AI contract/workflow, integration guide, improvements, sprint report and team roles; `docs/README.md` links this record |
| Presentation | `output/presentation/Hikaya_QGuide_2026.pptx`: renamed deck, updated text/notes/metadata, eight official logos and three refreshed app screenshots |

## Assets

Replaced `frontend/public/logo-icon.png`, `logo-horizontal.png` and
`logo-vertical.png` using the supplied official PNG originals. Existing canvas
dimensions are retained; artwork fits proportionally. The supplied white
backgrounds remain, with transparent padding where needed. Logo multiply blending
matches the original warm cream interface background (`#f5f5f0`). The keepsake icon
uses the same warm cream backing. This applies the requested beige alternative;
the original PNG artwork has not been redrawn or recolored.

Added ICO favicon frames (16–256 px), 16/32 px PNG favicons, the 180 px Apple icon,
192/512 px browser app icons, a 1200 × 630 social image, and `manifest.webmanifest`.
Full-size logos support the current UI at 2× and 3× densities.

Originals and dimension details: [`frontend/branding/README.md`](../frontend/branding/README.md).
Regeneration: `frontend/scripts/generate-brand-assets.py` with Pillow.

## Compatibility

Package identities, dependency versions, lockfiles, imports, API routes, external
URLs, schema definitions, location IDs, environment configuration, browser storage
keys and event names remain unchanged. Legacy internal names remain where needed
to keep saved progress, memories, language and narration preferences working.
The geographic subject of the guide remains Jerusalem.

Seed changes apply when seeding data; existing database rows and user-authored
contributions were not rewritten.

## Verification

- Frontend TypeScript check and production build passed.
- Backend build, 40 unit tests and one API end-to-end test passed.
- All 31 AI tests passed using Python's UTF-8 mode on Windows.
- Arabic/English browser checks passed; the 390 px mobile layout had no horizontal overflow.
- Logo dimensions, all six ICO frames, manifest references and production asset copies were checked.
- All 13 checked page/asset URLs returned HTTP 200; the downloaded ZIP included the new branding, public assets, originals, generator and lockfile.
- Presentation package checks passed: eight slides, unchanged layout/formatting attributes and relationships. The presentation renderer was unavailable, so the deck was not visually rendered in PowerPoint.
- Existing PDF reports contained no old brand names in their extracted text and were retained.
