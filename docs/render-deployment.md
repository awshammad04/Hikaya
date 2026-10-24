# Hikaya production deployment

Prepared on 9 October 2026. Local preparation is complete; **no Render deployment
or DNS change has been performed**. Live success requires the checks below.

## Deployment checklist and next action

1. In Render, connect GitHub and grant access to the private repository
   `awshammad04/Hikaya`.
2. Choose **New → Blueprint**, select this repository and branch
   `deployment/render-production`, and use the root `render.yaml`.
3. Review the paid resource estimate before clicking the create/deploy action.
   Supply provider keys in Render's secret fields. Never send keys in chat or
   put them in Git. You can leave both AI keys empty to use the existing reviewed
   extractive engine; a Gemini key is needed for model answers and natural narration.
4. Wait for Postgres and AI to become available. An uninitialized database
   deliberately prevents the backend's first deployment from becoming healthy.
5. Initialize the **new empty** database using the guarded process below.
   Then manually redeploy the backend and frontend if the initial deployment failed.
6. Test the frontend's actual assigned `https://<name>.onrender.com` URL.
7. Set the DNS records, verify the custom domain in Render, wait for HTTPS,
   and complete the live functional checklist at `https://hikayapalestine.tech`.

These account connection, plan purchase, secret entry, database selection,
DNS editing and live verification actions require the account owner. No passwords
or tokens are requested in repository files. The next action is step 1.

## Architecture and exact settings

Browser → frontend Express `/api/v1` → NestJS `/api/v1` → managed PostgreSQL.
NestJS → private Python AI → repository `content/ai-ready/`. Narration and video
continue to run through frontend Express's existing `/api/tts`, `/api/tts-stream`,
`/api/generate-video`, `/api/video-status`, and `/api/video-download` routes.

| Resource | Type / root | Build | Start | Health |
| --- | --- | --- | --- | --- |
| `hikaya-frontend` | Node web / `frontend` | `npm ci && npm run build` | `npm start` | `/health` |
| `hikaya-backend` | Node web / `backend` | `npm ci && npm run build` | `npm run start:prod` | `/api/v1/health` |
| `hikaya-ai` | Python private / repository root (leave root directory empty) | `pip install -r ai/requirements.txt` | `uvicorn service.app:app --app-dir ai --host 0.0.0.0 --port $PORT` | internal `/health` |
| `hikaya-postgres` | Managed PostgreSQL 17 | — | — | Render managed |

The Blueprint uses Frankfurt for all four resources, paid `0.5c-512mb` services,
and a `0.1c-256mb` database with 5 GB storage. Review availability and cost in your
account. It creates no paid resources until you approve creation in Render.
Keep one frontend instance for the current process-local request budgets.

Node is pinned to the locally tested `24.19.0`; Python is set to `3.13.12`.
Python code and HTTP tests were run locally on 3.14.5; the Render Linux/Python
3.13 build still needs verification. AI direct dependencies are pinned.

All servers bind `0.0.0.0`. Render assigns Node web-service `PORT`; the private
AI service explicitly uses `PORT=10000`. Production never changes to a different
port when its configured port is busy. The AI service must retain the full
repository, including the sibling `content` directory.

The Express server bundle lives in `frontend/runtime`, outside public `dist`.
Static assets are served from `dist`; React Router direct refreshes return the
existing SPA. Unknown `/api/*` paths return JSON 404, rather than the SPA.

## Environment variables

| Service | Variable | Required / purpose |
| --- | --- | --- |
| Frontend | `NODE_ENV=production` | Required; activates security and serves the Vite build |
| Frontend | `APP_URL=https://hikayapalestine.tech` | Required canonical allowed write origin |
| Frontend | `HIKAYA_API_BASE_URL` | Full server-only backend URL ending `/api/v1`, if configured manually |
| Frontend | `HIKAYA_API_HOSTPORT` | Blueprint alternative; automatically converted to `http://host:port/api/v1`; BASE_URL takes priority |
| Frontend | `HIKAYA_INTERNAL_TOKEN` | Required shared backend credential, generated/referenced by Blueprint |
| Frontend | `GEMINI_API_KEY` | Server-only natural-narration credential; enter in Render |
| Frontend | `GEMINI_API_MODE` | Optional `developer` or `vertex`; empty tries the Developer API first, then Vertex Express (`AQ.` keys exist for both) |
| Frontend | `GEMINI_TTS_MODEL` / `GEMINI_TRANSCRIBE_MODEL` | Optional; defaults `gemini-3.8-flash-tts` and `gemini-3.5-transcribe` |
| Frontend | `API_PROXY_TIMEOUT_MS=180000` | Upstream deadline; includes cold-start allowance |
| Frontend | `AI_REQUESTS_PER_HOUR=200` | Optional global hourly AI/TTS request cap |
| Backend | `NODE_ENV=production` | Required; disables in-memory/failure fallbacks |
| Backend | `DATABASE_URL` | Required; Blueprint uses Postgres internal connection string |
| Backend | `AI_SERVICE_URL` | Full server-only AI URL for manual setup |
| Backend | `AI_SERVICE_HOSTPORT` | Blueprint alternative; converted to `http://host:port`; URL takes priority |
| Backend | `AI_SERVICE_TIMEOUT_MS=150000` | Numeric AI HTTP deadline |
| Backend | `HIKAYA_INTERNAL_TOKEN` | Required; Blueprint generates it |
| Backend | `AI_INTERNAL_TOKEN` | Required; referenced from AI service |
| Backend | `PG_POOL_MAX=10` | Optional pool limit; isolated WASM test uses 1 |
| AI | `NODE_ENV=production` | Required production startup/auth/failure checks |
| AI | `AI_INTERNAL_TOKEN` | Required; Blueprint generates it |
| AI | `GEMINI_API_KEY` | Optional server-only model credential for grounded guide answers and stories (needs billing for real traffic) |
| AI | `ANTHROPIC_API_KEY` | Optional alternative model credential |
| AI | `HIKAYA_AI_PROVIDER=auto` | `auto` uses Gemini when its key is set, else Anthropic; with neither key the extractive engine is used |
| AI | `HIKAYA_AI_MODEL=gemini-3.5-flash` | Model for the chosen provider; a model name for the other provider is ignored |
| AI | `HIKAYA_AI_FALLBACK_MODEL=gemini-3.5-flash-lite` | Gemini only; used when the main model is overloaded or out of daily quota |
| AI | `HIKAYA_AI_MAX_TOKENS=2800` | Optional output bound |
| Web services | `PORT` | Render supplies web ports; do not hardcode them manually |
| Node services | `NODE_VERSION=24.19.0` | Build/runtime version |
| AI | `PYTHON_VERSION=3.13.12` | Render runtime version |

Render supplies `RENDER_EXTERNAL_URL`; the frontend also accepts that exact origin
for writes. Browsers always use same-origin `/api/v1` in production, even if
`VITE_API_BASE_URL` was accidentally set. No server secret is a `VITE_` variable
or substituted into the browser bundle. Don't copy development localhost URLs
into production settings. Empty strings are not usable credentials.

If using manual services, copy each generated internal token securely into its
caller. Do not give visitors the token or place it in browser request headers.
The Blueprint wires tokens and internal `hostport` values automatically; it does
not attempt unsupported YAML variable interpolation. Remove stale explicit URLs
if you want the Blueprint's hostport references to take effect.

## Maps

No Google Maps key is needed. The maps are illustrated SVG drawn from the
records' coordinates, and walking directions open as ordinary google.com/maps
links.

## Safe one-time database initialization

Do not run `database/schema.sql`, `database/seed.sql` or `database/seed-generated.sql`
directly against production: they contain DROP/DELETE statements. Initialization
is **not** a build, start, auto-deploy, or initial-deploy hook.

From the complete local checkout, install backend dependencies with `npm ci`
inside `backend`. The initializer needs the sibling `database` directory, so do
not run it from Render's `rootDir=backend` shell.

In Render Postgres, temporarily allow **only your current public IP /32** for
external access. Copy the **external** database connection URL to a secure prompt.
Use TLS with certificate validation (`sslmode=verify-full`); do not disable
certificate verification. The backend itself uses the private internal URL.

PowerShell, from the repository root (the secret is not echoed or stored in history):

```powershell
$databaseInput = Read-Host 'External DATABASE_URL with TLS verification' -AsSecureString
$env:DATABASE_URL = [Net.NetworkCredential]::new('', $databaseInput).Password
try {
  node backend/scripts/database.mjs initialize
  if ($LASTEXITCODE -ne 0) { throw 'Initialization failed; do not deploy yet.' }
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $databaseInput.Dispose()
}
```

Remove the temporary external IP allowance afterward. The Blueprint's default
`ipAllowList: []` blocks public database access. A later Blueprint sync also
restores that setting.

The initializer takes an advisory lock, checks that the public schema is empty,
omits all legacy DROP/DELETE statements, and loads Jerusalem schema/data, the
governorate migration and existing Palestine seed in **one transaction**. An error
rolls back everything. It includes all 8 Jerusalem and 6 national locations and
their existing stories, gallery metadata, timelines, quizzes and seeded memories.
It refuses repeat initialization; it never overwrites a populated database.

If your database already holds data, take and verify a backup, then use
`node backend/scripts/database.mjs migrate` with the same secure environment
setup. This runs numbered migrations and the existing additive national seed,
tracked as `003-palestine-reviewed-seed`, without resetting user/heritage rows.
Checksums in `hikaya_migrations` prevent edited historical migrations from running.
For later changes add a new numbered SQL migration; don't modify applied files or
rerun destructive seeds. Run migrations once before deploying code that needs
them. This first release keeps migration execution explicit rather than automatic.

SQL checks, using a trusted database client (credentials entered separately):

```sql
SELECT governorate_id, COUNT(*) FROM locations GROUP BY governorate_id;
-- Jerusalem 8; Ramallah 2; Hebron 2; Gaza 2.
SELECT name, applied_at FROM hikaya_migrations ORDER BY name;
SELECT status, COUNT(*) FROM contributions GROUP BY status;
```

Production refuses startup without PostgreSQL, national schema columns, and at
least 14 published locations. Health queries the database on each check, so an
outage is not reported as a healthy in-memory service. No production data is
stored in process memory. Narration cache files are expendable and can be lost
on redeploy; contribution and story records remain in Postgres.

To verify persistence, submit a test memory via the site, retain its reference
code, confirm it is `pending_review` and absent from the public list, restart or
redeploy the backend and frontend, and check the same reference again. Confirm
the row still exists in PostgreSQL. Generated persisted stories remain pending
review too. Existing editorial moderation continues; there is no new public
approval endpoint. Approved public memories omit email, private reference codes,
and reviewer notes.

## GitHub and automatic deployments

The existing repository and history are retained. Work is on
`deployment/render-production`. If the branch has not been pushed:

```powershell
git push -u origin deployment/render-production
```

GitHub CLI had a separate invalid keyring token during preparation; ordinary
Git repository access worked. Reauthenticate your Git client only if pushing
fails. No force push or new repository initialization is needed.

The Blueprint follows the branch selected during creation and uses
`autoDeployTrigger: commit`. A frontend/backend change triggers that service via
its root directory; AI retains repository-root build context so content changes
are available. Review each service's deploy branch before later switching to
`main` after a normal reviewed merge. Database initialization never runs on
automatic deployment. Apply required migrations before the application update.

## Custom domain and DNS

The Blueprint adds `hikayapalestine.tech` to the **frontend web service**.
If configuring manually: frontend → Settings → Custom Domains → Add Custom
Domain → `hikayapalestine.tech`. Record the actual assigned frontend
`<frontend>.onrender.com` hostname. Render also configures `www` to redirect to
the apex. Don't attach the domain to NestJS or the AI service.

At the domain's authoritative DNS provider:

| Type | Name | Value |
| --- | --- | --- |
| ALIAS/ANAME (preferred if supported) | `@` | Actual frontend `<frontend>.onrender.com` |
| A (alternative to ALIAS/ANAME) | `@` | `216.24.57.1`, or the value currently shown by Render |
| CNAME | `www` | Actual frontend `<frontend>.onrender.com` |

Choose one apex method. Remove conflicting apex website/parking/forwarding A
records and AAAA records for the website, while preserving unrelated email/DNS
records. Cloudflare uses apex CNAME flattening instead of the A alternative;
follow Render's Cloudflare guide and start with DNS-only for verification.

Return to Render and click **Verify**. Wait for DNS propagation and Render's
managed TLS certificate. Test `https://hikayapalestine.tech` and `https://www.hikayapalestine.tech`.
Check restrictive CAA records if certificate issuance is blocked. Render handles
HTTPS termination; the app sends HSTS and does not need local certificate files.

```powershell
Resolve-DnsName hikayapalestine.tech
Resolve-DnsName www.hikayapalestine.tech
curl.exe -I https://hikayapalestine.tech
curl.exe https://hikayapalestine.tech/api/v1/health
curl.exe https://hikayapalestine.tech/api/v1/governorates
curl.exe -I https://hikayapalestine.tech/locations/muslim-quarter
curl.exe -I https://hikayapalestine.tech/api/download-zip
# Expect health: status ok, dataSource postgres; source download: 404.
```

## Abuse controls, timeouts and remaining limits

Production blocks source ZIP export and direct unauthenticated Nest/AI access
(health is public). Nest CORS is closed; public browser requests use Express.
Frontend writes reject foreign browser origins. Inputs are bounded (8 MB bodies,
12,000 narration characters, 4,000 video prompt characters). Public story
generation requires a stored reviewed location and rejects visitor-provided
historical text. Existing reviewed-only retrieval, fact guard, provenance,
localization and moderation remain intact.

Per frontend process: general API 300 requests/client/minute and 600 globally;
AI/TTS 20/client/hour and 200 globally; video generation 3/client/hour and 10
globally; contribution submission 10/client/hour and 100 globally. AI and video
groups each allow three concurrent HTTP requests. Limits return 429 and
Retry-After. They are in-memory, reset on process restart, and count requests,
not provider tokens. One national journey can create up to 14 model calls;
narration word alignment may call another model. Set provider account budgets,
quotas and alerts. Scaling beyond one frontend requires a shared limiter.
No public anonymous application can guarantee zero automated abuse.

The browser waits 190 seconds, Express 180, Nest AI 150, provider SDKs 120.
Anthropic automatic retries are disabled. This accommodates normal provider
latency and a cold service; it does not guarantee arbitrarily long generation.
Do not retry paid jobs blindly after a timeout. The recommended Blueprint uses
paid always-on services. Free backend services cannot receive private-network
traffic, private services have no Free plan, and Free databases expire after
30 days. A Free experiment requires explicit public URLs and internal tokens,
not simply replacing every plan with `free`.

With no AI key the service deliberately uses the labelled `offline-extractive`
engine. When a configured provider fails in production (after retries and the
fallback model), the response is 503,
rather than silently replacing the result. Frontend sample-data fallback and
Nest local outage fallback are development-only. The existing reviewed Arabic
adaptation of successful extractive Jerusalem responses is preserved. Natural
narration's existing device speech fallback is identified in the UI.

## Verification and troubleshooting

```powershell
cd frontend
npm ci
npm run lint
npm run build
cd ../backend
npm ci
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx eslint src test --format json --output-file ../lint-results.json
cd ..
py -m unittest discover -s ai/tests
py tools/check-jerusalem-preservation.py
```

Full backend lint has pre-existing formatting violations; this preparation
does not reformat unrelated heritage/generated code. Changed backend files pass
lint. Vite reports the existing large bundle warning. See the separate
[validation record](render-validation.md) for exact results and test limits.

Optional isolated database and production integration checks (Windows):

```powershell
npm install --prefix .deployment-test/sql --no-save @electric-sql/pglite @electric-sql/pglite-socket
py -m venv .deployment-test/venv
py -m pip --python .deployment-test/venv/Scripts/python.exe install -r ai/requirements.txt httpx
node tools/check-production-database.mjs
node tools/check-production-stack.mjs
```

These create disposable databases under ignored `.deployment-test`, use fixed
local test ports, and never connect to your existing database or call paid AI.
If a port is occupied, free the test process or change the test script's ports.
WASM integration uses a one-client pool because it is not a full multi-user
PostgreSQL server. Managed PostgreSQL behavior must also be verified live.

| Symptom | Check |
| --- | --- |
| Backend first deploy fails | Initialize the new empty DB, verify all 14 records, redeploy |
| Frontend 502 | Backend healthy? Remove stale localhost BASE_URL; verify private hostport and same region |
| 401 from frontend's proxied API | Shared backend token must match; redeploy caller after changing secrets |
| AI 503 | Content root present? Token match? Model entitlement/provider quota? Inspect private AI health/logs |
| Maps provider error | Build-time browser key, exact referrer restrictions, enabled API, billing; rebuild |
| Narration/video 503 | Correct Gemini key/mode and model access; verify provider quota |
| 429 | Wait Retry-After; inspect configured request cap and provider budget |
| DNS/TLS pending | Correct authoritative DNS, remove website AAAA/conflicts, verify in Render, check CAA |
| Contributions disappear | Health must say postgres; check the same DB URL and row before/after redeploy |

## Live acceptance checklist

- Homepage and Jerusalem routes, Palestine homepage and four governorates.
- All 14 location pages; direct URL refresh and navigation back/forward.
- Existing Jerusalem maps, Google Maps if enabled, marker interactions and images.
- Personalized stories in Arabic and English; single/multi/all governorate journeys.
- Heritage Guide questions and follow-ups; source-bound refusals and provider failures.
- Natural narration start/pause/resume/end and word highlighting in both languages.
- Video generation, status polling and download with the production Gemini key.
- Galleries, before/after where existing pairs exist, timelines and quizzes.
- Pending contributions, reference lookup, public moderation filtering and persistence.
- Mobile and desktop layouts, no unintended scrolling or obstructed controls.
- HTTPS and www redirect, 404 ZIP export, direct backend/AI authentication.

National records already have documented gallery/timeline gaps. Empty collections
for those records are retained rather than populated with invented content.
No successful public deployment is claimed until these checks use the actual URLs.

## Official setup references

Checked against Render's current documentation on 9 October 2026:
[Blueprint fields and service references](https://render.com/docs/blueprint-spec),
[private networking](https://render.com/docs/private-network),
[custom domains](https://render.com/docs/custom-domains),
[DNS records](https://render.com/docs/configure-other-dns),
[Cloudflare DNS](https://render.com/docs/configure-cloudflare-dns),
[Free instance limitations](https://render.com/docs/free),
[Blueprint JSON schema](https://render.com/schema/render.yaml.json).
