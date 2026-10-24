"""FastAPI application exposing the AI module over HTTP.

    pip install -r ai/requirements.txt
    uvicorn service.app:app --port 8001 --app-dir ai

Routes (see ``ai/api-contract.md``):

    GET  /health         service and content status
    GET  /modes          supported audience modes
    POST /generate-story reviewed content -> narrative
    POST /ask-guide      question -> answer drawn from reviewed content

If FastAPI is not installed, use the dependency-free equivalent instead:

    python3 -m service.server --port 8001

Both servers speak the same JSON, so the backend does not care which one runs.
"""

from typing import Any, Dict
import os
import secrets
from contextlib import asynccontextmanager

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
except ImportError as exc:  # pragma: no cover - exercised only without FastAPI
    raise ImportError(
        "FastAPI is not installed. Either run 'pip install -r ai/requirements.txt', "
        "or use the dependency-free server: python3 -m service.server"
    ) from exc

from . import audiences, content_loader, llm
from .generator import answer_question, generate_story
from .models import GuideRequest, StoryRequest, ValidationError

@asynccontextmanager
async def lifespan(_app):
    if os.environ.get("NODE_ENV") == "production":
        if not os.environ.get("AI_INTERNAL_TOKEN"):
            raise RuntimeError("AI_INTERNAL_TOKEN is required in production.")
        if len(content_loader.available_locations()) < 14:
            raise RuntimeError("Reviewed Jerusalem and Palestine content must be available.")
        if os.environ.get("HIKAYA_AI_PROVIDER", "auto") not in ("auto", "") and not llm.is_configured():
            raise RuntimeError("HIKAYA_AI_PROVIDER is set but its API key (or SDK) is missing.")
    yield


app = FastAPI(
    lifespan=lifespan,
    docs_url=None if os.environ.get("NODE_ENV") == "production" else "/docs",
    redoc_url=None if os.environ.get("NODE_ENV") == "production" else "/redoc",
    title="Hikaya AI Module",
    description="Narrative generation and heritage Q&A from reviewed Palestinian "
                "heritage content.",
    version="0.2.0",
)

# The NestJS backend is the only intended caller, but CORS is open in the MVP so
# the frontend can also hit the service directly during development.
if os.environ.get("NODE_ENV") != "production":
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.middleware("http")
async def internal_access(request, call_next):
    if os.environ.get("NODE_ENV") == "production" and request.url.path != "/health":
        expected = os.environ.get("AI_INTERNAL_TOKEN", "")
        supplied = request.headers.get("x-hikaya-ai-token", "")
        if not expected or not secrets.compare_digest(expected, supplied):
            return JSONResponse(status_code=401, content={"message": "Unauthorized"})
        length = request.headers.get("content-length", "0")
        if not length.isdigit() or int(length) > 262144:
            return JSONResponse(status_code=413, content={"message": "Request too large"})
    try:
        return await call_next(request)
    except llm.LLMUnavailable:
        return JSONResponse(status_code=503, content={"status": "error", "error": {
            "code": "provider_unavailable", "message": "The AI provider is temporarily unavailable."}})

# Contract error codes that mean "the caller asked for something impossible",
# as opposed to a server-side failure.
_CLIENT_ERRORS = {
    "invalid_scope",
    "missing_content",
    "content_not_reviewed",
    "unsupported_audience",
    "unsupported_language",
    "content_too_long",
}


def _status_code(payload):
    # type: (Dict[str, Any]) -> int
    error = payload.get("error")
    if not error:
        return 200
    code = error.get("code", "")
    if code == "unknown_location":
        return 404
    return 400 if code in _CLIENT_ERRORS else 500


@app.get("/health")
def health():
    # type: () -> Dict[str, Any]
    locations = content_loader.available_locations()
    if os.environ.get("NODE_ENV") == "production" and len(locations) < 14:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Reviewed content is unavailable."})
    return {
        "status": "ok",
        "version": app.version,
        "backend": llm.provider_name() if llm.is_configured() else "offline-extractive",
        "model": llm.model_name() if llm.is_configured() else "hikaya-extractive-v1",
        "reviewed_locations": [item["location_id"] for item in locations],
    }


@app.get("/modes")
def modes():
    # type: () -> Dict[str, Any]
    return {"audiences": audiences.describe(), "default": "general"}


@app.post("/generate-story")
def generate_story_endpoint(payload: Dict[str, Any]):
    try:
        request = StoryRequest.from_dict(payload)
    except (ValidationError, TypeError) as exc:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "error": {"code": "missing_content",
                                                  "message": str(exc)}},
        )
    response = generate_story(request).to_dict()
    return JSONResponse(status_code=_status_code(response), content=response)


@app.post("/ask-guide")
def ask_guide_endpoint(payload: Dict[str, Any]):
    try:
        request = GuideRequest.from_dict(payload)
    except (ValidationError, TypeError) as exc:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "error": {"code": "missing_content",
                                                  "message": str(exc)}},
        )
    response = answer_question(request).to_dict()
    return JSONResponse(status_code=_status_code(response), content=response)


@app.post("/generate-journey")
def generate_journey_endpoint(payload: Dict[str, Any]):
    from .journeys import generate_journey
    response = generate_journey(payload)
    return JSONResponse(status_code=_status_code(response), content=response)
