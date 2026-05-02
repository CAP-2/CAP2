import importlib.util
import pathlib
import sys
import unittest


APP_DIR = pathlib.Path(__file__).resolve().parents[1]
APP_FILE = APP_DIR / "app.py"


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


MEMBER_CTX = {
    "account_id": 20,
    "person_id": 18,
    "clan_id": 8,
    "role": "member",
    "display_name": "Demo User",
}


class DetectIntentTests(unittest.TestCase):
    def assert_intent(self, prompt, expected):
        intent, confidence, slots = ai_app.detect_intent(prompt)
        self.assertEqual(intent, expected, prompt)
        self.assertGreaterEqual(confidence, 0.65, prompt)
        self.assertIsInstance(slots, dict)

    def test_required_demo_prompts(self):
        cases = {
            "Tôi là ai?": "PROFILE",
            "Bố mẹ tôi là ai?": "PARENTS",
            "Cha mẹ tôi là ai?": "PARENTS",
            "Con tôi là ai?": "CHILDREN",
            "Tôi có mấy người con?": "CHILDREN",
            "Vợ tôi là ai?": "SPOUSE",
            "Chồng tôi là ai?": "SPOUSE",
            "Anh chị em tôi là ai?": "SIBLINGS",
            "Ông bà tôi là ai?": "GRANDPARENTS",
            "Người còn sống trong dòng họ": "LIVING_MEMBERS",
            "Những người đã mất trong dòng họ": "DECEASED_MEMBERS",
            "Bài viết mới nhất": "POSTS",
            "Sự kiện sắp tới": "EVENTS",
            "Đóng góp sự kiện": "CONTRIBUTIONS",
            "Chi phí sự kiện": "EVENT_COSTS",
            "Thông báo quản lý": "ANNOUNCEMENTS",
            "Thông báo của tôi": "NOTIFICATIONS",
            "Dòng họ có bao nhiêu thành viên?": "MEMBER_COUNT",
            "Lịch sử dòng họ là gì?": "CLAN_OVERVIEW",
        }
        for prompt, expected in cases.items():
            with self.subTest(prompt=prompt):
                self.assert_intent(prompt, expected)

    def test_regression_ambiguous_vietnamese(self):
        self.assert_intent("thông báo quản lý", "ANNOUNCEMENTS")
        self.assert_intent("người còn sống", "LIVING_MEMBERS")
        self.assert_intent("đóng góp sự kiện", "CONTRIBUTIONS")
        self.assert_intent("chi phí sự kiện", "EVENT_COSTS")


class FixedQueryAndPermissionTests(unittest.TestCase):
    def test_member_queries_are_scoped(self):
        prompts = [
            "Tôi là ai?",
            "Bố mẹ tôi là ai?",
            "Con tôi là ai?",
            "Vợ tôi là ai?",
            "Anh chị em tôi là ai?",
            "Ông bà tôi là ai?",
            "Người còn sống trong dòng họ",
            "Những người đã mất trong dòng họ",
            "Bài viết mới nhất",
            "Sự kiện sắp tới",
            "Đóng góp sự kiện",
            "Chi phí sự kiện",
            "Thông báo của tôi",
            "Thông báo quản lý",
            "Dòng họ có bao nhiêu thành viên?",
            "Lịch sử dòng họ là gì?",
        ]
        for prompt in prompts:
            with self.subTest(prompt=prompt):
                intent, _, slots = ai_app.detect_intent(prompt)
                denial = ai_app.permission_denial(intent, MEMBER_CTX, prompt)
                self.assertIsNone(denial)
                query = ai_app.fixed_query(intent, MEMBER_CTX, slots)
                self.assertIsNotNone(query)
                sql, params = query
                self.assertTrue(ai_app.safe_sql(sql), prompt)
                self.assertIn(MEMBER_CTX["clan_id"], params, prompt)

    def test_member_cannot_access_admin_overview(self):
        denial = ai_app.permission_denial("ADMIN_OVERVIEW", MEMBER_CTX, "thống kê hệ thống")
        self.assertIsNotNone(denial)

    def test_missing_context_is_denied_clearly(self):
        no_clan = {**MEMBER_CTX, "clan_id": None}
        self.assertIsNotNone(ai_app.permission_denial("POSTS", no_clan, "bài viết mới nhất"))
        no_person = {**MEMBER_CTX, "person_id": None}
        self.assertIsNotNone(ai_app.permission_denial("PARENTS", no_person, "bố mẹ tôi là ai"))

    def test_empty_rows_do_not_fabricate(self):
        answer = ai_app.deterministic_answer("CHILDREN", [], [], "Con tôi là ai?")
        normalized = ai_app.normalize_vietnamese(answer)
        self.assertIn("khong tim thay", normalized)


if __name__ == "__main__":
    unittest.main()
