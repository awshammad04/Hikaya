"""Production safeguards; no paid provider calls or credentials required."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from fastapi.testclient import TestClient
    from service.app import app
    from service import llm
except ImportError:
    TestClient = None


@unittest.skipIf(TestClient is None, "Install AI HTTP dependencies to test production guards")
class ProductionTests(unittest.TestCase):
    def test_rejects_direct_generation_and_reports_content(self):
        with patch.dict(os.environ, {"NODE_ENV": "production", "AI_INTERNAL_TOKEN": "test-only-token"}):
            with TestClient(app) as client:
                self.assertEqual(client.post('/generate-story', json={}).status_code, 401)
                health = client.get('/health')
                self.assertEqual(health.status_code, 200)
                self.assertEqual(len(health.json()['reviewed_locations']), 14)
                response = client.post('/generate-story', json={"location_id": "muslim-quarter"},
                                       headers={"x-hikaya-ai-token": "test-only-token"})
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json()['narrative'])

    def test_provider_failure_is_visible(self):
        with patch.dict(os.environ, {"NODE_ENV": "production", "AI_INTERNAL_TOKEN": "test-only-token"}):
            with TestClient(app) as client:
                with patch('service.llm.is_configured', return_value=True), patch('service.llm.complete', side_effect=llm.LLMUnavailable('test failure')):
                    response = client.post('/generate-story', json={"location_id": "muslim-quarter"},
                                           headers={"x-hikaya-ai-token": "test-only-token"})
                    self.assertEqual(response.status_code, 503)
                    self.assertEqual(response.json()['error']['code'], 'provider_unavailable')

    def test_startup_requires_internal_token(self):
        with patch.dict(os.environ, {"NODE_ENV": "production", "AI_INTERNAL_TOKEN": ""}):
            with self.assertRaises(RuntimeError):
                with TestClient(app):
                    pass
