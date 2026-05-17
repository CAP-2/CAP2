import importlib.util
import os
import pathlib
import sys
import unittest
from unittest.mock import patch


APP_DIR = pathlib.Path(__file__).resolve().parents[1]
APP_FILE = APP_DIR / "app.py"

os.environ["AI_DISABLE_GROQ"] = "true"


def load_ai_app():
    sys.path.insert(0, str(APP_DIR))
    spec = importlib.util.spec_from_file_location("ai_app_for_tests", APP_FILE)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except ModuleNotFoundError as exc:
        raise unittest.SkipTest(f"Missing AI-server dependency: {exc.name}") from exc
    return module


ai_app = load_ai_app()


def event_create_payload(**overrides):
    payload = {
        "mode": "event_create",
        "prompt": "Tao su kien gio to thang 8 tai nha tho ho, khoang 50 nguoi tham du",
        "today": "2026-05-17",
        "clan_id": 1,
        "requested_task_count": 6,
    }
    payload.update(overrides)
    return payload


def task_create_payload(**overrides):
    payload = {
        "mode": "task_create",
        "prompt": "Sinh them 5 cong viec khac cho su kien nay",
        "today": "2026-05-17",
        "current_event": {
            "id": 10,
            "title": "Gap mat cuoi nam",
            "event_date": "2026-12-31",
            "description": "Gap mat cuoi nam tai nha bac Quan",
            "clan_id": 1,
        },
        "existing_tasks": [
            {"title": "Thong bao lich gap mat cuoi nam"},
            {"title": "Chot danh sach con chau tham du"},
        ],
        "requested_task_count": 5,
    }
    payload.update(overrides)
    return payload


class DateParsingTests(unittest.TestCase):
    def test_month_positions(self):
        self.assertEqual(ai_app.parse_iso_date_from_text("thang 8", "2026-05-17"), "2026-08-01")
        self.assertEqual(ai_app.parse_iso_date_from_text("dau thang 8", "2026-05-17"), "2026-08-01")
        self.assertEqual(ai_app.parse_iso_date_from_text("giua thang 8", "2026-05-17"), "2026-08-15")
        self.assertEqual(ai_app.parse_iso_date_from_text("cuoi thang 8", "2026-05-17"), "2026-08-31")
        self.assertEqual(ai_app.parse_iso_date_from_text("cuoi nam", "2026-05-17"), "2026-12-31")

    def test_numeric_dates(self):
        self.assertEqual(ai_app.parse_iso_date_from_text("02/08/2026", "2026-05-17"), "2026-08-02")
        self.assertEqual(ai_app.parse_iso_date_from_text("02-08-2026", "2026-05-17"), "2026-08-02")
        self.assertEqual(ai_app.parse_iso_date_from_text("02.08.2026", "2026-05-17"), "2026-08-02")
        self.assertEqual(ai_app.parse_iso_date_from_text("2026-08-02", "2026-05-17"), "2026-08-02")
        self.assertEqual(ai_app.parse_iso_date_from_text("02/08", "2026-05-17"), "2026-08-02")


class EventFormFallbackTests(unittest.TestCase):
    def test_event_create_contract(self):
        result = ai_app.fallback_event_form(event_create_payload())

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["mode"], "event_create")
        self.assertEqual(result["event"]["event_date"], "2026-08-01")
        self.assertEqual(len(result["manager_tasks"]), 6)
        self.assertTrue(all(task["event_id"] is None for task in result["manager_tasks"]))
        self.assertTrue(all(task["status"] == "assigned" for task in result["manager_tasks"]))

    def test_task_create_contract_and_purpose_dedupe(self):
        result = ai_app.fallback_event_form(task_create_payload())

        titles = " ".join(task["title"] for task in result["manager_tasks"])
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["mode"], "task_create")
        self.assertEqual(len(result["manager_tasks"]), 5)
        self.assertTrue(all(task["event_id"] == 10 for task in result["manager_tasks"]))
        self.assertNotIn("Thong bao lich gap mat cuoi nam", ai_app.normalize_vietnamese(titles))
        self.assertNotIn("Chot danh sach con chau tham du", ai_app.normalize_vietnamese(titles))

    def test_unsupported_prompt(self):
        result = ai_app.fallback_event_form(
            event_create_payload(prompt="Hom nay gia vang the nao?", requested_task_count=None)
        )

        self.assertEqual(result["status"], "unsupported")
        self.assertEqual(result["manager_tasks"], [])


class NormalizationTests(unittest.TestCase):
    def test_invalid_task_create_without_event_id_is_unsupported(self):
        result = ai_app.normalize_event_form_result(
            {"status": "success", "mode": "task_create", "event": {}, "manager_tasks": [{"title": "A"}]},
            {"mode": "task_create", "prompt": "Sinh them viec", "current_event": {"id": None}},
        )
        self.assertEqual(result["status"], "unsupported")
        self.assertEqual(result["manager_tasks"], [])

    def test_schema_is_normalized(self):
        result = ai_app.normalize_event_form_result(
            {
                "status": "success",
                "mode": "event_create",
                "event": {
                    "title": "  Gio to  ",
                    "event_date": "2026-08-01",
                    "description": "  Gio to tai nha tho ho  ",
                    "clan_id": 1,
                    "extra": "ignored",
                },
                "manager_tasks": [
                    {
                        "event_id": 99,
                        "member_id": 12,
                        "title": "  Chuan bi le vat  ",
                        "description": "  Chuan bi huong hoa  ",
                        "due_date": "2026-08-03",
                        "status": "done",
                        "extra": "ignored",
                    },
                    {"description": "missing title"},
                ],
            },
            event_create_payload(requested_task_count=None),
        )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["event"], {
            "title": "Gio to",
            "event_date": "2026-08-01",
            "description": "Gio to tai nha tho ho",
            "clan_id": 1,
        })
        self.assertEqual(len(result["manager_tasks"]), 1)
        task = result["manager_tasks"][0]
        self.assertEqual(set(task.keys()), {"event_id", "member_id", "title", "description", "due_date", "status"})
        self.assertIsNone(task["event_id"])
        self.assertIsNone(task["member_id"])
        self.assertEqual(task["status"], "assigned")
        self.assertEqual(task["due_date"], "2026-08-01")

    def test_requested_task_count_is_enforced(self):
        result = ai_app.normalize_event_form_result(
            {
                "status": "success",
                "mode": "event_create",
                "event": {"title": "Gio to", "event_date": "2026-08-01", "description": "Gio to", "clan_id": 1},
                "manager_tasks": [{"title": "Chuan bi le vat"}],
            },
            event_create_payload(requested_task_count=4),
        )
        self.assertEqual(len(result["manager_tasks"]), 4)


class EndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = ai_app.app.test_client()

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {
            "success": True,
            "service": "ai-server",
            "groq_configured": False,
        })

    def test_event_create_endpoint_uses_fallback_when_groq_disabled(self):
        response = self.client.post("/event-form/generate", json=event_create_payload())
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(data["success"])
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["mode"], "event_create")
        self.assertEqual(data["event"]["event_date"], "2026-08-01")
        self.assertEqual(len(data["manager_tasks"]), 6)

    def test_task_create_endpoint(self):
        response = self.client.post("/event-form/generate", json=task_create_payload())
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["mode"], "task_create")
        self.assertEqual(len(data["manager_tasks"]), 5)
        self.assertEqual({task["event_id"] for task in data["manager_tasks"]}, {10})

    def test_unsupported_endpoint(self):
        response = self.client.post(
            "/event-form/generate",
            json=event_create_payload(prompt="Hom nay gia vang the nao?", requested_task_count=None),
        )
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(data["success"])
        self.assertEqual(data["status"], "unsupported")
        self.assertEqual(data["manager_tasks"], [])

    def test_empty_prompt_returns_400(self):
        response = self.client.post("/event-form/generate", json={"prompt": ""})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])

    def test_groq_error_falls_back(self):
        class BrokenGroq:
            def __init__(self, *args, **kwargs):
                self.chat = self
                self.completions = self

            def create(self, *args, **kwargs):
                raise RuntimeError("network unavailable")

        with patch.dict(os.environ, {"AI_DISABLE_GROQ": "false", "GROQ_API_KEY": "test-key"}):
            with patch.object(ai_app, "Groq", BrokenGroq):
                app = ai_app.create_app()

        response = app.test_client().post("/event-form/generate", json=event_create_payload())
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(data["success"])
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["event"]["event_date"], "2026-08-01")
        self.assertEqual(len(data["manager_tasks"]), 6)


if __name__ == "__main__":
    unittest.main()
