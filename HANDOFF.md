# Hikaya — Team Handoff

This archive contains the full editable project source: React frontend, NestJS backend, Python AI service, reviewed Jerusalem content, database seeds, documentation, public media and the official Hikaya logo assets.

## What is intentionally not included

- `node_modules/` and generated `dist/` folders — recreate them from the included lockfiles.
- Private `.env` files and API keys — create local copies from the included `.env.example` files and use your own credentials.
- Python cache files and OS metadata.

## Quick start

Open three terminals from the project root.

```bash
# Frontend
cd frontend
cp .env.example .env
npm ci
npm run dev
```

```bash
# Backend
cd backend
cp .env.example .env
npm ci
npm run start:dev
```

```bash
# AI service (standard library only; the backend expects port 8001)
cd ai
cp .env.example .env   # optional: add GEMINI_API_KEY for model answers
python3 -m service.server --port 8001
```

The frontend has an offline/mock fallback, so it still runs if the backend or AI service is unavailable. See the `README.md` files within each directory for environment variables and further commands.

## Verification

```bash
cd frontend
npm run lint
npm run build
```
