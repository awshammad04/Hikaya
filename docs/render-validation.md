# Deployment audit and validation record

Date: 9 October 2026. Repository: `awshammad04/Hikaya`.
Scope: deployment configuration and production safeguards; existing visual
design, route names, Jerusalem content/assets and national expansion retained.

## Audit findings and implementation

| Area | Finding | Result |
| --- | --- | --- |
| Frontend build/start | Vite SPA plus bundled Express; server bundle was inside the static directory | `npm run build` emits browser assets to `dist`, server to non-public `runtime`; `npm start` uses server bundle |
| Proxy | Same-origin bridge had a six-second deadline | 180-second configurable deadline, internal backend token, upstream status/content-type/Retry-After retained |
| Ports/static routes | Development port hunting and SPA fallback | Production binds assigned port on 0.0.0.0, SPA refresh supported, unknown API routes are JSON 404 |
| Database | Missing/unreachable DB selected volatile repositories | Production startup requires reachable initialized Postgres; health probes live DB; development fallback retained |
| AI content | Loader resolves sibling content from repository root | Private AI root remains whole repository; startup checks all 14 reviewed summaries |
| Secrets | Gemini server key; browser Maps key | Only Maps key enters Vite build; Gemini supports Developer/Vertex Express modes; secrets generated/referenced or entered in Render |
| Source download | Public ZIP endpoint; static server source also exposed | Production ZIP 404; server and source map outside public assets |
| Paid services | Anonymous unbounded requests and scenic video fallbacks | Client/global request caps, concurrent-request bound, input limits, explicit production provider errors |
| Reviewed generation | Inline historical-text escape hatch was available publicly | Production generation requires a stored reviewed location; unreviewed inline text rejected |
| CORS/access | Nest and AI open CORS | Nest direct API token required, AI private plus separate token, production CORS closed, frontend write-origin check |
| Fallbacks | Browser sample data and backend outage simplifier hid dependency failures | Production throws visible errors; extractive mode is explicit when Anthropic is unset |
| Contributions | Legacy Express store was temporary and unmoderated | Production legacy route delegates to persistent Nest moderation; public approved list omits private email/reference/reviewer fields |
| Initialization | schema and multiple seeds contain DROP/DELETE | Guarded empty-schema initializer removes reset statements, loads all data atomically, refuses populated schema |
| Migrations | Existing national migration/seed could be rerun manually | Locked transaction and checksum ledger; additive national seed tracked as a data migration |

Localhost URLs remaining in the code are development-only defaults/test
fixtures. Browser production API calls use the frontend origin. The default
backend/AI URLs are overridden by Blueprint private-service references, and
startup requires production connection configuration.

## Completed checks

| Check | Result |
| --- | --- |
| Frontend `npm run lint` (TypeScript) | Passed |
| Frontend `npm run build` | Passed; existing approximately 784 KB JS chunk warning |
| Backend `npm run build` | Passed |
| Backend unit suite | 51 tests passed |
| Backend end-to-end suite | 4 tests passed |
| AI suite, including production authentication/provider-failure/startup tests | 42 tests passed |
| Original Jerusalem preservation script | 23 original asset/content files match baseline hashes |
| Safe SQL initializer and migration checks | Passed on isolated PostgreSQL WASM; 14 locations loaded; populated-schema initialization refused; repeat migrations preserve contributions |
| Full production HTTP chain | Passed with actual Express/Nest/FastAPI processes and PostgreSQL wire protocol |
| Contribution moderation/persistence | Pending record absent from public list; same reference survives database and API process restart |
| Data endpoints | 4 governorates, 14 places; galleries/timelines/quizzes retain existing collections and documented empty national collections |
| AI HTTP journeys | Arabic/English Jerusalem and national stories, four-governorate journey and source-bound Guide answered through the deployed-style proxy |
| Access/failure handling | Direct unauthenticated Nest/AI rejected; ZIP/server-source/API-missing routes blocked; foreign write origin rejected; paid-service failures 503; request budget 429 |
| Production SPA paths | Home, Jerusalem, national map, story creation, governorate, location and contribution routes return SPA on direct requests |
| Official Render Blueprint JSON schema | Passed using `https://render.com/schema/render.yaml.json` |
| Node dependency audits | Frontend and backend each reported zero known vulnerabilities |
| Changed backend files ESLint | Passed with zero errors/warnings |
| Git whitespace validation | Passed |

The full backend lint check found 2,333 formatting errors before changed-file
formatting. These are existing project-wide Prettier issues, concentrated in
generated and existing files. No broad unrelated reformat was performed. The
standard backend lint script uses `--fix`; read-only validation instead used
`npx eslint src test`. The current unchanged formatting issues remain.

Tests used Node 24.19.0, Python 3.14.5 and an isolated PGlite PostgreSQL engine.
PGlite runs one connection; the test uses `PG_POOL_MAX=1`. Production defaults
to a normal ten-connection pool. Test assets/dependencies/databases are ignored
under `.deployment-test`. No existing user database or paid API was contacted.

## Required live checks and limits

No browser is exposed by this environment, and the Windows computer-use helper
pipe is unavailable. Actual browser rendering, desktop/mobile responsiveness,
map interactions, media loading, narration playback/highlighting, and the
complete visual user journeys **were not verified**. HTTP/API and preservation
checks do not replace browser acceptance testing.

Gemini and Anthropic production credentials were not supplied. Successful
natural narration, Veo generation/status/download, and paid Anthropic generation
must be tested with the owner's credentials. Missing-key and mocked provider
failure behavior were tested without charges. The existing extractive engine
was used for real local AI integration checks.

The Render Linux build, Python 3.13 runtime, managed Postgres TLS/networking,
service secret references, custom domain, DNS, HTTPS, auto-deploy and live
restart persistence still require verification on Render. The Blueprint is
schema-valid; resources have not been created in an account.

**Hikaya is locally prepared and tested for deployment. No public deployment
success is claimed.** Follow [the deployment checklist](render-deployment.md).
