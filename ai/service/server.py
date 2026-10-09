"""Dependency-free HTTP server for the AI module.

    python3 -m service.server --port 8001      # run from the ai/ folder

Speaks exactly the same JSON as the FastAPI app in :mod:`service.app`, using
only the standard library. It exists so the backend integration can be run and
demonstrated on a machine with nothing installed - no pip, no virtualenv.

Use the FastAPI app when the dependencies are available; it is the one intended
for deployment.
"""

import argparse
import json
import sys
from typing import Any, Dict

try:  # allow both "python3 -m service.server" and "python3 service/server.py"
    from . import audiences, content_loader, llm
    from .generator import answer_question, generate_story
    from .models import GuideRequest, StoryRequest, ValidationError
except ImportError:  # pragma: no cover
    import os

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from service import audiences, content_loader, llm
    from service.generator import answer_question, generate_story
    from service.models import GuideRequest, StoryRequest, ValidationError

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

_CLIENT_ERRORS = {
    "invalid_scope",
    "missing_content",
    "content_not_reviewed",
    "unsupported_audience",
    "unsupported_language",
    "content_too_long",
}

VERSION = "0.2.0"


def status_code_for(payload):
    # type: (Dict[str, Any]) -> int
    error = payload.get("error")
    if not error:
        return 200
    code = error.get("code", "")
    if code == "unknown_location":
        return 404
    return 400 if code in _CLIENT_ERRORS else 500


def health_payload():
    # type: () -> Dict[str, Any]
    configured = llm.is_configured()
    return {
        "status": "ok",
        "version": VERSION,
        "server": "stdlib",
        "backend": llm.PROVIDER_NAME if configured else "offline-extractive",
        "model": llm.DEFAULT_MODEL if configured else "hikaya-extractive-v1",
        "reviewed_locations": [
            item["location_id"] for item in content_loader.available_locations()
        ],
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "HikayaAI/" + VERSION

    # -- plumbing -----------------------------------------------------------

    def _send(self, status, payload):
        # type: (int, Dict[str, Any]) -> None
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        # type: () -> Dict[str, Any]
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def log_message(self, fmt, *args):  # quieter default logging
        sys.stderr.write("[hikaya-ai] %s\n" % (fmt % args))

    # -- routes -------------------------------------------------------------

    def do_OPTIONS(self):  # noqa: N802 - required name
        self._send(204, {})

    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path in ("/health", "/"):
            self._send(200, health_payload())
        elif path == "/modes":
            self._send(200, {"audiences": audiences.describe(), "default": "general"})
        else:
            self._send(404, {"status": "error",
                             "error": {"code": "not_found", "message": "Unknown path."}})

    def do_POST(self):  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/")
        try:
            payload = self._read_json()
        except ValueError:
            self._send(400, {"status": "error",
                             "error": {"code": "missing_content",
                                       "message": "Request body is not valid JSON."}})
            return

        if path == '/generate-journey':
            from .journeys import generate_journey
            response = generate_journey(payload)
            self._send(status_code_for(response), response)
            return
        if path == "/generate-story":
            builder, runner = StoryRequest, generate_story
        elif path == "/ask-guide":
            builder, runner = GuideRequest, answer_question
        else:
            self._send(404, {"status": "error",
                             "error": {"code": "not_found", "message": "Unknown path."}})
            return

        try:
            request = builder.from_dict(payload)
        except (ValidationError, TypeError) as exc:
            self._send(400, {"status": "error",
                             "error": {"code": "missing_content", "message": str(exc)}})
            return

        response = runner(request).to_dict()
        self._send(status_code_for(response), response)


def main(argv=None):
    # type: (Any) -> int
    parser = argparse.ArgumentParser(description="Hikaya AI module HTTP server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args(argv)

    info = health_payload()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    sys.stderr.write(
        "[hikaya-ai] listening on http://%s:%d  backend=%s  locations=%s\n"
        % (args.host, args.port, info["backend"], ", ".join(info["reviewed_locations"]))
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("\n[hikaya-ai] stopped\n")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
