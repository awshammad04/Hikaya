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

app = FastAPI(
    title="Hikaya AI Module",
    description="Narrative generation and heritage Q&A from reviewed Palestinian "
                "heritage content.",
    version="0.2.0",
)

# The NestJS backend is the only intended caller, but CORS is open in the MVP so
# the frontend can also hit the service directly during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    return {
        "status": "ok",
        "version": app.version,
        "backend": llm.PROVIDER_NAME if llm.is_configured() else "offline-extractive",
        "model": llm.DEFAULT_MODEL if llm.is_configured() else "hikaya-extractive-v1",
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
