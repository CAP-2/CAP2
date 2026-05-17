import calendar
from difflib import SequenceMatcher
import json
import os
import re
import unicodedata
from datetime import date, datetime, timedelta
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from groq import Groq

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MODEL_NAME = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

EVENT_FORM_SYSTEM_PROMPT = """
Bạn là AI chuyên sinh JSON cho form tạo sự kiện và công việc chuẩn bị của Gia Phả Việt.

Bạn không trả lời hội thoại tự do.
Không giải thích.
Không markdown.
Không dùng ```json.
Chỉ trả JSON hợp lệ.
Không thêm field ngoài schema.

Schema output bắt buộc:
{
  "status": "success",
  "mode": "event_create",
  "event": {
    "title": "",
    "event_date": null,
    "description": "",
    "clan_id": null
  },
  "manager_tasks": [
    {
      "event_id": null,
      "member_id": null,
      "title": "",
      "description": "",
      "due_date": null,
      "status": "assigned"
    }
  ]
}

Quy tắc bắt buộc:
0. status chỉ được là "success" hoặc "unsupported"; mode chỉ được là "event_create" hoặc "task_create".
1. Chỉ hỗ trợ yêu cầu liên quan sự kiện, nghi lễ, sinh hoạt, họp mặt, cưới hỏi, mừng thọ, giỗ chạp, tảo mộ, khuyến học, gây quỹ, họp họ, tu sửa, hoạt động gia đình hoặc dòng họ.
2. Nếu không liên quan, trả status = "unsupported", event rỗng như schema và manager_tasks = [].
3. mode phải lấy theo input: event_create hoặc task_create.
4. mode = event_create: tạo dữ liệu nháp event mới, manager_tasks[*].event_id luôn null.
5. mode = task_create: dựa vào current_event và existing_tasks để tạo thêm công việc mới, manager_tasks[*].event_id = current_event.id.
5a. AI chỉ sinh dữ liệu nháp để Manager kiểm tra/chỉnh sửa trước khi lưu; không tự ghi database.
6. clan_id lấy từ input clan_id hoặc current_event.clan_id.
7. member_id luôn null.
8. task.status luôn là "assigned".
9. Không tạo task trùng hoặc gần giống existing_tasks.
10. Task phải cụ thể, giao được cho một người thực hiện, bám sát chủ đề người dùng nhập.
11. Không dùng một template chung cho mọi sự kiện.
12. event.title tối đa 80 ký tự.
13. task.title tối đa 120 ký tự.
14. task.description tối đa 500 ký tự.
15. event_date và due_date chỉ được là YYYY-MM-DD hoặc null.
16. Nếu không chắc ngày thì để null, không bịa ngày cụ thể.
17. Nếu prompt chỉ có tháng, ví dụ "tháng 8", chọn ngày 01 của tháng đó theo năm trong today.
18. Nếu prompt có "đầu tháng N", chọn ngày 01; "giữa tháng N", chọn ngày 15; "cuối tháng N", chọn ngày cuối tháng.
19. Nếu prompt nói "cuối năm" nhưng không có tháng cụ thể, chọn 31/12 theo năm trong today.
20. Nếu có cả "cuối năm" và tháng cụ thể, ưu tiên tháng cụ thể.
21. Nếu có event_date thì mỗi task nên có due_date trước hoặc đúng event_date.
22. Nếu input có requested_task_count thì sinh đúng requested_task_count task, không ít hơn và không nhiều hơn.
"""

VALID_MODES = {"event_create", "task_create"}
VALID_STATUSES = {"success", "unsupported"}
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def strip_accents(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text or "")
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return without_marks.replace("đ", "d").replace("Đ", "D")


def normalize_vietnamese(text: str) -> str:
    normalized = strip_accents(text).lower().strip()
    return re.sub(r"\s+", " ", normalized)


def strip_json_block(text: str) -> str:
    raw = str(text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        return raw[start : end + 1]
    return raw


def valid_iso_date(value: Any) -> str | None:
    text = str(value or "").strip()
    if not ISO_DATE_RE.match(text):
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date().isoformat()
    except ValueError:
        return None


def base_year_from_today(today: str | None = None) -> int:
    parsed_today = valid_iso_date(today)
    if parsed_today:
        return datetime.strptime(parsed_today, "%Y-%m-%d").year
    return datetime.now().year


def base_date_from_today(today: str | None = None) -> date:
    parsed_today = valid_iso_date(today)
    if parsed_today:
        return datetime.strptime(parsed_today, "%Y-%m-%d").date()
    return datetime.now().date()


def parse_iso_date_from_text(text: str, today: str | None = None) -> str | None:
    raw = str(text or "")
    normalized = normalize_vietnamese(raw)
    base_date = base_date_from_today(today)
    base_year = base_date.year

    weekday_next_week = {
        "thu 2": 0,
        "thu hai": 0,
        "thu 3": 1,
        "thu ba": 1,
        "thu 4": 2,
        "thu tu": 2,
        "thu 5": 3,
        "thu nam": 3,
        "thu 6": 4,
        "thu sau": 4,
        "thu 7": 5,
        "thu bay": 5,
        "chu nhat": 6,
    }
    for keyword, weekday in weekday_next_week.items():
        if re.search(rf"\b{re.escape(keyword)}\s+tuan\s+sau\b", normalized):
            days_to_next_monday = 7 - base_date.weekday()
            return (base_date + timedelta(days=days_to_next_monday + weekday)).isoformat()

    if re.search(r"\btuan\s+sau\b", normalized):
        return (base_date + timedelta(days=7)).isoformat()

    if re.search(r"\bhom\s+nay\b", normalized):
        return base_date.isoformat()

    if re.search(r"\bngay\s+mai\b", normalized) or re.search(r"\bmai\b", raw.lower()):
        return (base_date + timedelta(days=1)).isoformat()

    raw_lower = raw.lower()
    if (
        re.search(r"\bngay\s+kia\b", normalized)
        or re.search(r"\bngay\s+mot\b", normalized)
        or re.search(r"\bmốt\b", raw_lower)
    ):
        return (base_date + timedelta(days=2)).isoformat()

    m = re.search(r"\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b", raw)
    if m:
        day, month, year = m.groups()
        try:
            return date(int(year), int(month), int(day)).isoformat()
        except ValueError:
            return None

    m = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", raw)
    if m:
        year, month, day = m.groups()
        try:
            return date(int(year), int(month), int(day)).isoformat()
        except ValueError:
            return None

    m = re.search(r"\b(\d{1,2})[\/\-.](\d{1,2})\b", raw)
    if m:
        day, month = m.groups()
        try:
            return date(base_year, int(month), int(day)).isoformat()
        except ValueError:
            return None

    m = re.search(r"\b(?:ngay\s+)?(?:mung\s+)?(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?\b", normalized)
    if m:
        day, month, year = m.groups()
        try:
            return date(int(year) if year else base_year, int(month), int(day)).isoformat()
        except ValueError:
            return None

    m = re.search(r"\b(dau|giua|cuoi)?\s*thang\s+(\d{1,2})\b", normalized)
    if m:
        position, month_text = m.groups()
        month = int(month_text)
        if 1 <= month <= 12:
            if position == "giua":
                day = 15
            elif position == "cuoi":
                day = calendar.monthrange(base_year, month)[1]
            else:
                day = 1
            return date(base_year, month, day).isoformat()

    if "cuoi nam" in normalized:
        return date(base_year, 12, 31).isoformat()

    return None


def date_add_days(iso_date: str | None, days: int) -> str | None:
    parsed = valid_iso_date(iso_date)
    if not parsed:
        return None
    value = datetime.strptime(parsed, "%Y-%m-%d").date()
    return (value + timedelta(days=days)).isoformat()


def clamp_due_date(due_date: str | None, event_date: str | None) -> str | None:
    due = valid_iso_date(due_date)
    event = valid_iso_date(event_date)
    if not due:
        return None
    if event and due > event:
        return event
    return due


def fill_missing_task_due_dates(tasks: list[dict[str, Any]], event_date: str | None) -> list[dict[str, Any]]:
    event = valid_iso_date(event_date)
    if not event:
        return tasks

    offsets = [-7, -5, -3, -1, 0]
    fixed: list[dict[str, Any]] = []
    total = len(tasks or [])

    for index, task in enumerate(tasks or []):
        if not isinstance(task, dict):
            continue

        item = dict(task)
        if not valid_iso_date(item.get("due_date")):
            if total > 1 and index == total - 1:
                offset = 0
            else:
                offset = offsets[index] if index < len(offsets) else 0
            item["due_date"] = date_add_days(event, offset)
        else:
            item["due_date"] = clamp_due_date(item.get("due_date"), event)
        fixed.append(item)

    return fixed


def sort_tasks_by_due_date(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        tasks or [],
        key=lambda task: (
            valid_iso_date(task.get("due_date")) is None,
            valid_iso_date(task.get("due_date")) or "",
        ),
    )


def make_task(event_id: int | None, title: str, description: str, due_date: str | None) -> dict[str, Any]:
    return {
        "event_id": event_id,
        "member_id": None,
        "title": title[:120].strip(),
        "description": description[:500].strip(),
        "due_date": valid_iso_date(due_date),
        "status": "assigned",
    }


def requested_task_count_from_body(body: dict[str, Any]) -> int | None:
    value = parse_int(body.get("requested_task_count"))
    if value is None:
        return None
    return max(1, min(value, 20))


def normalize_task_title_for_compare(task: dict[str, Any]) -> str:
    return normalize_vietnamese(str(task.get("title") or "")).strip()


TASK_PURPOSE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "notify": ("thong bao", "gui thong bao", "bao lich", "moi tham du", "thu moi", "thiep moi"),
    "guest_list": ("danh sach tham du", "xac nhan so luong", "chot danh sach", "khach moi", "nguoi tham gia"),
    "venue": ("dia diem", "don dep", "sap xep ban ghe", "kiem tra am thanh", "nha tho", "tu duong"),
    "offering": ("mam cung", "le vat", "huong hoa", "trai cay", "do le"),
    "food": ("mam com", "dat tiec", "nuoc uong", "thuc don", "do an"),
    "finance": ("chi phi", "dong gop", "du toan", "quy", "thu chi", "kinh phi"),
    "media": ("chup anh", "quay video", "luu niem", "tu lieu", "hinh anh"),
    "coordination": ("phan cong", "dieu phoi", "nguoi phu trach", "don tiep"),
    "summary": ("tong ket", "bao cao", "rut kinh nghiem", "cong khai"),
}


def task_purpose(task: dict[str, Any]) -> str | None:
    text = normalize_vietnamese(
        f"{task.get('title') or ''} {task.get('description') or ''}"
    )
    for purpose, keywords in TASK_PURPOSE_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return purpose
    return None


def task_duplicate_key(task: dict[str, Any]) -> str:
    return normalize_task_title_for_compare(task)


def task_titles_too_similar(title: str, existing_title: str) -> bool:
    current = normalize_vietnamese(title)
    existing = normalize_vietnamese(existing_title)
    if not current or not existing:
        return False
    if current == existing:
        return True
    return SequenceMatcher(None, current, existing).ratio() >= 0.9


def append_unique_task(
    target: list[dict[str, Any]],
    task: dict[str, Any],
    seen_keys: set[str],
) -> bool:
    if not isinstance(task, dict) or not str(task.get("title") or "").strip():
        return False

    key = task_duplicate_key(task)
    if any(task_titles_too_similar(key, seen_key) for seen_key in seen_keys):
        return False

    target.append(task)
    seen_keys.add(key)
    return True


def is_supported_event_prompt(body: dict[str, Any]) -> bool:
    mode = "task_create" if body.get("mode") == "task_create" else "event_create"
    if mode == "task_create":
        current_event = body.get("current_event") if isinstance(body.get("current_event"), dict) else {}
        return bool(parse_int(current_event.get("id")))

    text = normalize_vietnamese(str(body.get("prompt") or ""))
    keywords = (
        "su kien",
        "nghi le",
        "sinh hoat",
        "to chuc",
        "lap ke hoach",
        "chuan bi",
        "gia dinh",
        "dong ho",
        "buoi le",
        "buoi hop",
        "lien hoan",
        "gio",
        "gio to",
        "gio dau",
        "gio man tang",
        "gap mat",
        "hop mat",
        "hop ho",
        "cuoi nam",
        "cuoi hoi",
        "le cuoi",
        "dam cuoi",
        "dam hoi",
        "mung tho",
        "tao mo",
        "thanh minh",
        "khuyen hoc",
        "trao thuong",
        "gay quy",
        "quyen gop",
        "bau ban dai dien",
        "tu sua",
        "sua chua",
        "nha tho",
        "tu duong",
        "day thang",
        "thoi noi",
    )
    return any(keyword in text for keyword in keywords)


def default_event_title(prompt: str) -> str:
    p = normalize_vietnamese(prompt)

    if "gio dau" in p:
        return "Giỗ đầu"
    if "gio man tang" in p:
        return "Giỗ mãn tang"
    if "gio to" in p:
        return "Giỗ tổ"
    if "tao mo" in p or "thanh minh" in p:
        return "Tảo mộ Thanh minh"
    if "khuyen hoc" in p or "trao thuong" in p:
        return "Khuyến học dòng họ"
    if "gay quy" in p or "quyen gop" in p:
        return "Gây quỹ dòng họ"
    if "bau ban dai dien" in p or "hop ho" in p:
        return "Họp họ"
    if "cuoi hoi" in p or "le cuoi" in p or "dam cuoi" in p or "dam hoi" in p:
        return "Lễ cưới hỏi"
    if "day thang" in p:
        return "Lễ đầy tháng"
    if "thoi noi" in p:
        return "Lễ thôi nôi"
    if "gap mat cuoi nam" in p or ("gap mat" in p and "cuoi nam" in p):
        return "Gặp mặt cuối năm"
    if "gap mat" in p or "hop mat" in p or "tu hop" in p:
        return "Gặp mặt dòng họ"
    if "mung tho" in p:
        return "Mừng thọ"
    if "le to tien" in p or "cung to tien" in p:
        return "Lễ tưởng nhớ tổ tiên"
    if "tu sua" in p or "sua chua" in p or "nha tho ho" in p or "tu duong" in p or "nha tho to" in p:
        return "Tu sửa nhà thờ tổ"

    cleaned = str(prompt or "").strip()
    cleaned = re.sub(
        r"^(tạo|tao|thêm|them|lập|lap)\s+(một\s+|mot\s+)?(sự kiện|su kien)\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r",?\s*ngày\s+\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{4})?", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r",?\s*(đầu|giữa|cuối)?\s*tháng\s+\d{1,2}", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.split(r",|\.|\n", cleaned)[0].strip()

    return (cleaned[:80].strip() or "Sự kiện dòng họ")


def default_tasks_for_event(
    title: str,
    event_date: str | None,
    event_id: int | None,
    existing_tasks: list[dict[str, Any]] | None = None,
    description: str = "",
) -> list[dict[str, Any]]:
    text = normalize_vietnamese(f"{title} {description}")
    before_14 = date_add_days(event_date, -14)
    before_10 = date_add_days(event_date, -10)
    before_7 = date_add_days(event_date, -7)
    before_5 = date_add_days(event_date, -5)
    before_3 = date_add_days(event_date, -3)
    before_1 = date_add_days(event_date, -1)
    same_day = valid_iso_date(event_date)

    if "gio dau" in text or "gio man tang" in text:
        rows = [
            ("Thông báo ngày giỗ cho con cháu", "Gửi thông báo thời gian, địa điểm và nội dung ngày giỗ cho các nhánh gia đình.", before_7),
            ("Chuẩn bị lễ vật và mâm cúng", "Chuẩn bị hương hoa, trái cây, lễ vật và mâm cúng phù hợp với nghi lễ.", before_3),
            ("Dọn dẹp khu vực thờ cúng", "Vệ sinh bàn thờ, khu vực tiếp khách và lối đi trước ngày giỗ.", before_1),
            ("Phân công tiếp khách", "Bố trí người đón tiếp, hướng dẫn chỗ ngồi và hỗ trợ người lớn tuổi.", same_day),
            ("Chuẩn bị mâm cơm thân mật", "Dự trù số mâm, thực đơn, nước uống và người phụ trách hậu cần.", before_1),
            ("Ghi nhận chi phí và đóng góp", "Tổng hợp khoản đóng góp, khoản chi và lưu lại để báo cáo sau ngày giỗ.", same_day),
        ]
    elif "gio to" in text:
        rows = [
            ("Lập danh sách con cháu tham dự", "Tổng hợp số lượng thành viên tham dự để chuẩn bị lễ và tiếp đón.", before_7),
            ("Thông báo thời gian giỗ tổ", "Gửi thông báo ngày giờ, địa điểm và nội dung buổi giỗ tổ cho các nhánh trong dòng họ.", before_7),
            ("Chuẩn bị mâm cúng tổ tiên", "Chuẩn bị lễ vật, hương hoa, trái cây, xôi chè và các vật phẩm thờ cúng.", before_3),
            ("Dọn dẹp nhà thờ tổ", "Vệ sinh bàn thờ, sân nhà thờ tổ, khu vực tiếp khách và lối đi.", before_1),
            ("Phân công đón tiếp con cháu", "Sắp xếp người đón khách, hướng dẫn chỗ ngồi và hỗ trợ người lớn tuổi.", same_day),
            ("Ghi nhận đóng góp và chi phí", "Tổng hợp khoản đóng góp, khoản chi và lưu lại để báo cáo sau sự kiện.", same_day),
        ]
    elif "cuoi hoi" in text or "le cuoi" in text or "dam cuoi" in text or "dam hoi" in text:
        rows = [
            ("Chốt danh sách khách mời hai bên", "Tổng hợp khách mời của hai gia đình để chuẩn bị thiệp, bàn tiệc và đón tiếp.", before_14),
            ("Chuẩn bị thiệp mời hoặc thông báo", "Soạn nội dung, kiểm tra thông tin ngày giờ địa điểm và gửi đến khách mời.", before_10),
            ("Sắp xếp địa điểm tổ chức", "Kiểm tra không gian, bàn ghế, âm thanh, khu vực đón khách và lối đi.", before_7),
            ("Chuẩn bị lễ vật cưới hỏi", "Lập danh sách lễ vật cần có và phân công người chuẩn bị đúng nghi thức.", before_5),
            ("Phân công đón tiếp khách", "Bố trí người đón khách, hướng dẫn chỗ ngồi và hỗ trợ hai bên gia đình.", same_day),
            ("Ghi nhận chi phí tổ chức", "Theo dõi các khoản chi chính, khoản phát sinh và tổng hợp sau lễ.", same_day),
        ]
    elif "tao mo" in text or "thanh minh" in text:
        rows = [
            ("Chốt danh sách người tham gia tảo mộ", "Xác nhận số lượng người tham dự để chuẩn bị phương tiện và dụng cụ.", before_7),
            ("Thông báo thời gian tập trung", "Gửi lịch tập trung, địa điểm gặp và lịch trình di chuyển cho các thành viên.", before_5),
            ("Chuẩn bị hương hoa và dụng cụ vệ sinh mộ", "Chuẩn bị hương, hoa, khăn lau, chổi, bao rác và dụng cụ cần thiết.", before_3),
            ("Phân công nhóm dọn dẹp từng khu mộ", "Chia người phụ trách từng khu để việc vệ sinh diễn ra gọn và đầy đủ.", before_1),
            ("Chuẩn bị phương tiện di chuyển", "Sắp xếp xe, điểm đón và người phụ trách điều phối di chuyển.", before_1),
            ("Tổng kết chi phí và lưu hình ảnh", "Ghi lại chi phí, chụp ảnh tư liệu và lưu vào hồ sơ dòng họ.", same_day),
        ]
    elif "khuyen hoc" in text or "trao thuong" in text:
        rows = [
            ("Lập danh sách học sinh sinh viên được khen thưởng", "Tổng hợp người được đề xuất khen thưởng theo từng nhánh gia đình.", before_14),
            ("Xác minh thành tích", "Kiểm tra giấy khen, điểm số hoặc thông tin thành tích trước khi công bố.", before_10),
            ("Chuẩn bị phần thưởng và giấy khen", "Dự trù ngân sách, mua phần thưởng và chuẩn bị giấy khen.", before_5),
            ("Thông báo lịch trao thưởng", "Gửi thông báo thời gian, địa điểm và danh sách người được khen thưởng.", before_3),
            ("Phân công người dẫn chương trình", "Chuẩn bị kịch bản ngắn, thứ tự trao thưởng và người điều phối.", before_1),
            ("Chụp ảnh và lưu tư liệu", "Ghi lại hình ảnh trao thưởng để lưu trong thư viện dòng họ.", same_day),
        ]
    elif "gay quy" in text or "quyen gop" in text:
        rows = [
            ("Lập mục tiêu gây quỹ", "Xác định mục đích, số tiền cần vận động và thời hạn đóng góp.", before_14),
            ("Thông báo kế hoạch đóng góp", "Gửi kế hoạch gây quỹ, cách chuyển khoản hoặc nộp trực tiếp cho thành viên.", before_10),
            ("Tạo danh sách người phụ trách thu quỹ", "Phân công người tiếp nhận, kiểm tra và cập nhật đóng góp.", before_7),
            ("Theo dõi khoản đóng góp", "Cập nhật từng khoản đóng góp, người đóng và ghi chú liên quan.", before_3),
            ("Công khai thu chi", "Tổng hợp số tiền nhận được, khoản chi và công khai minh bạch cho dòng họ.", same_day),
            ("Tổng kết kết quả gây quỹ", "Báo cáo kết quả so với mục tiêu và đề xuất bước tiếp theo.", same_day),
        ]
    elif "hop ho" in text or "bau ban dai dien" in text:
        rows = [
            ("Chuẩn bị nội dung cuộc họp", "Lập danh sách vấn đề cần trao đổi, tài liệu kèm theo và thứ tự thảo luận.", before_7),
            ("Thông báo thời gian và địa điểm họp", "Gửi lịch họp, địa điểm và nội dung chính đến các thành viên liên quan.", before_7),
            ("Lập danh sách người tham dự", "Xác nhận đại diện các nhánh tham gia để chuẩn bị chỗ ngồi và tài liệu.", before_5),
            ("Chuẩn bị biên bản họp", "Chuẩn bị mẫu biên bản, danh sách ký tên và người ghi chép.", before_3),
            ("Điều phối phần thảo luận bầu chọn", "Sắp xếp thứ tự phát biểu, phương án biểu quyết và người kiểm phiếu nếu có.", same_day),
            ("Tổng hợp kết quả cuộc họp", "Hoàn thiện biên bản, kết luận và gửi lại cho các thành viên sau họp.", same_day),
        ]
    elif "day thang" in text or "thoi noi" in text:
        rows = [
            ("Chốt danh sách khách mời", "Xác nhận số lượng khách gia đình và họ hàng tham dự để chuẩn bị chu đáo.", before_7),
            ("Chuẩn bị lễ cúng", "Chuẩn bị lễ vật, mâm cúng, hương hoa và đồ dùng cần thiết.", before_3),
            ("Chuẩn bị địa điểm tổ chức", "Sắp xếp không gian, bàn ghế, khu vực đón khách và khu vực làm lễ.", before_1),
            ("Đặt tiệc hoặc chuẩn bị đồ ăn", "Dự trù thực đơn, số phần ăn, nước uống và người phụ trách hậu cần.", before_1),
            ("Phân công chụp ảnh lưu niệm", "Chọn người ghi lại hình ảnh buổi lễ để lưu làm kỷ niệm.", same_day),
            ("Tổng kết chi phí", "Ghi nhận các khoản chi và khoản hỗ trợ sau buổi lễ.", same_day),
        ]
    elif "gap mat" in text or "hop mat" in text or "tu hop" in text or "cuoi nam" in text:
        rows = [
            ("Chốt danh sách con cháu tham dự", "Liên hệ các nhánh gia đình để xác nhận số lượng người tham gia buổi gặp mặt.", before_7),
            ("Thông báo lịch gặp mặt cuối năm", "Gửi thông báo về thời gian, địa điểm và nội dung chương trình.", before_7),
            ("Chuẩn bị nhà thờ tổ hoặc địa điểm gặp mặt", "Dọn dẹp, sắp xếp bàn ghế, kiểm tra điện nước và khu vực sinh hoạt chung.", before_3),
            ("Xây dựng chương trình gặp mặt", "Lên thứ tự hoạt động: chào hỏi, báo cáo dòng họ, dùng bữa, chụp ảnh lưu niệm.", before_3),
            ("Chuẩn bị mâm cơm thân mật", "Dự trù thực đơn, số mâm, nước uống và phân công người phụ trách hậu cần.", before_1),
            ("Phân công đón tiếp và hướng dẫn", "Bố trí người đón con cháu, hướng dẫn để xe, chỗ ngồi và hỗ trợ người lớn tuổi.", same_day),
            ("Ghi hình và chụp ảnh lưu niệm", "Phân công người chụp ảnh, quay video và lưu lại tư liệu cho dòng họ.", same_day),
            ("Tổng kết đóng góp sau sự kiện", "Ghi nhận đóng góp, chi phí tổ chức và báo cáo lại cho manager.", same_day),
        ]
    elif "mung tho" in text:
        rows = [
            ("Xác nhận danh sách khách mừng thọ", "Tổng hợp con cháu, họ hàng và khách mời tham dự lễ mừng thọ.", before_7),
            ("Chuẩn bị quà và lời chúc", "Chuẩn bị quà mừng thọ, thiệp chúc và đại diện phát biểu.", before_3),
            ("Trang trí khu vực tổ chức", "Sắp xếp phông nền, bàn ghế, hoa và khu vực chụp ảnh.", before_1),
            ("Chuẩn bị tiệc mừng thọ", "Dự trù số mâm, thực đơn, nước uống và người phụ trách hậu cần.", before_1),
            ("Chụp ảnh và lưu niệm", "Ghi lại hình ảnh buổi lễ để lưu trữ trong dòng họ.", same_day),
            ("Ghi nhận chi phí mừng thọ", "Tổng hợp khoản chi và khoản đóng góp liên quan đến buổi lễ.", same_day),
        ]
    elif "tu sua" in text or "sua chua" in text or "nha tho to" in text or "nha tho ho" in text or "tu duong" in text:
        rows = [
            ("Khảo sát hiện trạng nhà thờ tổ", "Kiểm tra mái, tường, sân, bàn thờ, hệ thống điện nước và các hạng mục cần sửa.", before_7),
            ("Lập danh sách hạng mục tu sửa", "Ghi rõ từng hạng mục, mức độ ưu tiên và người phụ trách theo dõi.", before_7),
            ("Lập dự toán kinh phí", "Tổng hợp vật tư, nhân công, chi phí phát sinh và dự toán tổng ngân sách.", before_3),
            ("Liên hệ đội thợ sửa chữa", "Tìm thợ phù hợp, thống nhất thời gian, chi phí và phạm vi công việc.", before_3),
            ("Thông báo kế hoạch đóng góp", "Gửi kế hoạch tu sửa và kêu gọi đóng góp minh bạch từ các thành viên.", before_1),
            ("Theo dõi nghiệm thu công việc", "Kiểm tra tiến độ, chất lượng thi công và xác nhận hoàn thành từng hạng mục.", same_day),
        ]
    else:
        rows = [
            ("Làm rõ nội dung sự kiện", "Xác định mục đích, thời gian, địa điểm và số lượng người dự kiến tham gia.", before_7),
            ("Lập danh sách người tham dự", "Tổng hợp danh sách thành viên, khách mời và các nhánh gia đình liên quan.", before_7),
            ("Thông báo sự kiện cho dòng họ", "Gửi thông báo chính thức về thời gian, địa điểm và nội dung sự kiện.", before_3),
            ("Chuẩn bị địa điểm tổ chức", "Sắp xếp không gian, bàn ghế, âm thanh, nước uống và khu vực tiếp đón.", before_1),
            ("Phân công hậu cần", "Chia nhiệm vụ chuẩn bị đồ dùng, tiếp khách, vệ sinh và hỗ trợ trong ngày diễn ra.", before_1),
            ("Tổng kết sau sự kiện", "Ghi nhận kết quả, chi phí, đóng góp và các việc cần rút kinh nghiệm.", same_day),
        ]

    seen_keys = {
        task_duplicate_key(item)
        for item in (existing_tasks or [])
        if isinstance(item, dict) and normalize_task_title_for_compare(item)
    }
    tasks: list[dict[str, Any]] = []
    for task_title, desc, due in rows:
        append_unique_task(tasks, make_task(event_id, task_title, desc, due), seen_keys)
    return tasks


def fallback_event_form(body: dict[str, Any]) -> dict[str, Any]:
    mode = "task_create" if body.get("mode") == "task_create" else "event_create"
    prompt = str(body.get("prompt") or "").strip()
    today = str(body.get("today") or "")

    if not is_supported_event_prompt(body):
        return {
            "status": "unsupported",
            "mode": mode,
            "event": {"title": "", "event_date": None, "description": "", "clan_id": None},
            "manager_tasks": [],
        }

    current_event = body.get("current_event") if isinstance(body.get("current_event"), dict) else {}
    existing_tasks = body.get("existing_tasks") if isinstance(body.get("existing_tasks"), list) else []

    if mode == "task_create":
        event_id = parse_int(current_event.get("id"))
        event_date = valid_iso_date(current_event.get("event_date")) or parse_iso_date_from_text(
            str(current_event.get("event_date") or ""), today
        )
        title = str(current_event.get("title") or "Sự kiện dòng họ").strip()[:80]
        description = str(current_event.get("description") or prompt).strip()
        event = {
            "title": title,
            "event_date": event_date,
            "description": description,
            "clan_id": current_event.get("clan_id") or body.get("clan_id"),
        }
        tasks = default_tasks_for_event(title, event_date, event_id, existing_tasks, f"{description} {prompt}")
    else:
        event_date = parse_iso_date_from_text(prompt, today)
        title = default_event_title(prompt)
        event = {
            "title": title,
            "event_date": event_date,
            "description": prompt,
            "clan_id": body.get("clan_id"),
        }
        tasks = default_tasks_for_event(title, event_date, None, existing_tasks, prompt)

    tasks = fill_missing_task_due_dates(tasks, event.get("event_date"))
    tasks = enforce_requested_task_count(tasks, body, mode, event)
    tasks = sort_tasks_by_due_date(tasks)

    return {
        "status": "success",
        "mode": mode,
        "event": event,
        "manager_tasks": tasks,
    }


def normalize_mode(value: Any, body: dict[str, Any]) -> str:
    if value in VALID_MODES:
        return str(value)
    body_mode = body.get("mode")
    return str(body_mode) if body_mode in VALID_MODES else "event_create"


def unsupported_result(mode: str) -> dict[str, Any]:
    return {
        "status": "unsupported",
        "mode": mode,
        "event": {"title": "", "event_date": None, "description": "", "clan_id": None},
        "manager_tasks": [],
    }


def normalize_task(
    task: dict[str, Any],
    mode: str,
    event_id: int | None,
    event_date: str | None,
) -> dict[str, Any] | None:
    title = str(task.get("title") or "").strip()[:120]
    if not title:
        return None

    return {
        "event_id": None if mode == "event_create" else event_id,
        "member_id": None,
        "title": title,
        "description": str(task.get("description") or "").strip()[:500],
        "due_date": clamp_due_date(task.get("due_date"), event_date),
        "status": "assigned",
    }


def enforce_requested_task_count(
    tasks: list[dict[str, Any]],
    body: dict[str, Any],
    mode: str,
    event: dict[str, Any],
) -> list[dict[str, Any]]:
    target = requested_task_count_from_body(body)

    current_event = body.get("current_event") if isinstance(body.get("current_event"), dict) else {}
    event_id = parse_int(current_event.get("id")) if mode == "task_create" else None
    event_title = str(event.get("title") or current_event.get("title") or "Sự kiện dòng họ").strip()
    event_date = valid_iso_date(event.get("event_date")) or valid_iso_date(current_event.get("event_date"))
    event_description = str(
        event.get("description") or current_event.get("description") or body.get("prompt") or ""
    ).strip()

    existing_tasks = body.get("existing_tasks") if isinstance(body.get("existing_tasks"), list) else []
    seen_keys = {
        task_duplicate_key(item)
        for item in existing_tasks
        if isinstance(item, dict) and normalize_task_title_for_compare(item)
    }

    cleaned: list[dict[str, Any]] = []
    for task in tasks or []:
        if append_unique_task(cleaned, task, seen_keys) and target and len(cleaned) >= target:
            break

    if target is None:
        return fill_missing_task_due_dates(cleaned, event_date)

    if len(cleaned) < target:
        fallback_candidates = default_tasks_for_event(
            event_title,
            event_date,
            None if mode == "event_create" else event_id,
            existing_tasks + cleaned,
            event_description,
        )
        for candidate in fallback_candidates:
            if append_unique_task(cleaned, candidate, seen_keys) and len(cleaned) >= target:
                break

    while len(cleaned) < target:
        index = len(cleaned) + 1
        due_date = date_add_days(event_date, -max(target - index, 0)) or event_date
        append_unique_task(
            cleaned,
            make_task(
                None if mode == "event_create" else event_id,
                f"Chuẩn bị bổ sung {index}",
                "Rà soát và hoàn thiện một đầu việc cần thiết để sự kiện diễn ra suôn sẻ.",
                due_date,
            ),
            seen_keys,
        )
        if len(cleaned) < index:
            cleaned.append(
                make_task(
                    None if mode == "event_create" else event_id,
                    f"Công việc bổ sung {index}",
                    "Hoàn thiện đầu việc bổ sung theo yêu cầu của người quản lý.",
                    due_date,
                )
            )

    return fill_missing_task_due_dates(cleaned[:target], event_date)


def normalize_event_form_result(result: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    mode = normalize_mode(result.get("mode"), body)
    fallback = fallback_event_form(body)

    status = str(result.get("status") or "").strip()
    if status == "unsupported":
        return unsupported_result(mode)
    raw_event = result.get("event") if isinstance(result.get("event"), dict) else {}
    raw_tasks = result.get("manager_tasks") if isinstance(result.get("manager_tasks"), list) else []
    has_valid_event = bool(
        str(raw_event.get("title") or "").strip()
        or valid_iso_date(raw_event.get("event_date"))
        or str(raw_event.get("description") or "").strip()
    )
    has_valid_tasks = any(
        isinstance(task, dict) and bool(str(task.get("title") or "").strip())
        for task in raw_tasks
    )
    if status != "success" and not (has_valid_event or has_valid_tasks):
        return unsupported_result(mode)

    current_event = body.get("current_event") if isinstance(body.get("current_event"), dict) else {}
    event_id = parse_int(current_event.get("id")) if mode == "task_create" else None
    if mode == "task_create" and not event_id:
        return unsupported_result(mode)

    event = raw_event
    fallback_event = fallback.get("event") if isinstance(fallback.get("event"), dict) else {}

    event_date = (
        valid_iso_date(event.get("event_date"))
        or valid_iso_date(current_event.get("event_date"))
        or parse_iso_date_from_text(str(body.get("prompt") or ""), str(body.get("today") or ""))
        or fallback_event.get("event_date")
    )
    title = str(event.get("title") or current_event.get("title") or fallback_event.get("title") or "").strip()[:80]
    description = str(
        event.get("description") or current_event.get("description") or fallback_event.get("description") or ""
    ).strip()

    normalized_event = {
        "title": title,
        "event_date": valid_iso_date(event_date),
        "description": description,
        "clan_id": event.get("clan_id") or current_event.get("clan_id") or body.get("clan_id"),
    }

    normalized_tasks: list[dict[str, Any]] = []
    for task in raw_tasks:
        if not isinstance(task, dict):
            continue
        normalized = normalize_task(task, mode, event_id, normalized_event.get("event_date"))
        if normalized:
            normalized_tasks.append(normalized)

    normalized_tasks = fill_missing_task_due_dates(normalized_tasks, normalized_event.get("event_date"))

    if not normalized_tasks and fallback.get("status") == "success":
        normalized_tasks = fallback.get("manager_tasks") or []

    normalized_tasks = enforce_requested_task_count(normalized_tasks, body, mode, normalized_event)
    normalized_tasks = sort_tasks_by_due_date(normalized_tasks)

    return {
        "status": "success",
        "mode": mode,
        "event": normalized_event,
        "manager_tasks": normalized_tasks,
    }


def create_app() -> Flask:
    app = Flask(__name__)
    groq_key = os.getenv("GROQ_API_KEY")
    groq_disabled = str(os.getenv("AI_DISABLE_GROQ", "false")).strip().lower() in {"1", "true", "yes", "on"}
    try:
        groq_timeout = float(os.getenv("GROQ_TIMEOUT_SECONDS", "8"))
    except ValueError:
        groq_timeout = 8.0
    groq_client = Groq(api_key=groq_key, timeout=groq_timeout) if groq_key and not groq_disabled else None
    debug_enabled = str(os.getenv("DEBUG", "false")).strip().lower() in {"1", "true", "yes", "on"}

    @app.get("/health")
    def health():
        return jsonify(
            {
                "success": True,
                "service": "ai-server",
                "groq_configured": bool(groq_key and not groq_disabled),
            }
        )

    @app.post("/event-form/generate")
    def event_form_generate():
        body = request.get_json(silent=True) or {}
        prompt = str(body.get("prompt") or "").strip()

        if not prompt:
            return jsonify({"success": False, "message": "Prompt không được để trống"}), 400

        fallback = fallback_event_form(body)
        if groq_client is None or fallback.get("status") == "unsupported":
            return jsonify({"success": True, **fallback})

        user_payload = {
            "mode": body.get("mode") or "event_create",
            "prompt": prompt,
            "today": body.get("today") or datetime.now().date().isoformat(),
            "clan_id": body.get("clan_id"),
            "current_event": body.get("current_event"),
            "existing_tasks": body.get("existing_tasks") or [],
            "requested_task_count": requested_task_count_from_body(body),
        }

        try:
            res = groq_client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": EVENT_FORM_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
                ],
                temperature=0.2,
                max_tokens=1800,
            )
            content = res.choices[0].message.content or "{}"
            if debug_enabled:
                app.logger.debug("EVENT_FORM_AI_RAW=%s", content[:4000])

            parsed = json.loads(strip_json_block(content))
            normalized = normalize_event_form_result(parsed, body)
            return jsonify({"success": True, **normalized})
        except Exception as exc:
            if debug_enabled:
                app.logger.exception("AI event form generation failed: %s", exc)
            return jsonify({"success": True, **fallback})

    return app


app = create_app()

if __name__ == "__main__":
    debug = str(os.getenv("DEBUG", "false")).strip().lower() in {"1", "true", "yes", "on"}
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=parse_int(os.getenv("PORT")) or 8001,
        debug=debug,
        use_reloader=debug,
    )
