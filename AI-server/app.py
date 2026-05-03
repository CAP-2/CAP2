import json
import os
import re
import time
import unicodedata
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from groq import Groq
from mysql.connector.pooling import MySQLConnectionPool

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

READ_ONLY_SQL = ("select",)
BLOCKED_SQL = (
    r"\binsert\b",
    r"\bupdate\b",
    r"\bdelete\b",
    r"\bdrop\b",
    r"\balter\b",
    r"\btruncate\b",
    r"\bcreate\b",
    r"\breplace\b",
)
MODEL_NAME = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
PUBLIC_SYSTEM_PROMPT = """
Bạn là trợ lý AI của Gia Phả Việt.
Trả lời ngắn gọn, tự nhiên bằng tiếng Việt có dấu.
Bạn có thể hướng dẫn người dùng về đăng ký, đăng nhập, tạo dòng họ,
quản lý cây gia phả, thành viên, bài viết, sự kiện và thư viện.
Không được nói rằng bạn đã truy cập dữ liệu riêng tư nếu người dùng chưa đăng nhập.
"""


def normalize_text(text: str) -> str:
    return normalize_vietnamese(text)


def phrase_pattern(phrase: str) -> str:
    escaped = re.escape(phrase.strip())
    escaped = escaped.replace(r"\ ", r"\s+")
    return rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"


def has_phrase(text: str, phrase: str) -> bool:
    return re.search(phrase_pattern(phrase), text) is not None


def has_any_phrase(text: str, phrases: tuple[str, ...] | list[str]) -> bool:
    return any(has_phrase(text, phrase) for phrase in phrases)


def has_token(text: str, token: str) -> bool:
    return has_phrase(text, token)


def parse_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def extract_sql_candidate(text: str) -> str:
    if not text:
        return ""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:sql)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    match = re.search(r"select\b[\s\S]*", cleaned, flags=re.IGNORECASE)
    if match:
        cleaned = match.group(0)
    return cleaned.split(";")[0].strip()


def safe_sql(sql: str) -> bool:
    candidate = extract_sql_candidate(sql).lower()
    if not candidate.startswith(READ_ONLY_SQL):
        return False
    return not any(re.search(pattern, candidate) for pattern in BLOCKED_SQL)


def enforce_clan(sql: str, clan_id: int) -> str:
    lowered = sql.lower()
    if "clan_id" in lowered:
        return sql

    table_match = re.search(
        r"\b(from|join)\s+(people|families|events|posts|clans)(?:\s+(?:as\s+)?([a-z_][a-z0-9_]*))?",
        lowered,
    )
    table = table_match.group(2) if table_match else None
    alias = table_match.group(3) if table_match else None
    if alias in {"where", "join", "left", "right", "inner", "outer", "on", "order", "group", "limit"}:
        alias = None

    qualifier = alias or table
    column = "id" if table == "clans" else "clan_id"
    clan_expr = f"{qualifier}.{column} = {clan_id}" if qualifier else f"clan_id = {clan_id}"

    if " where " in lowered:
        return f"{sql} AND {clan_expr}"
    return f"{sql} WHERE {clan_expr}"


def add_limit(sql: str, limit: int = 50) -> str:
    if "limit" in sql.lower():
        return sql
    return f"{sql} LIMIT {limit}"


def get_db() -> MySQLConnectionPool:
    return MySQLConnectionPool(
        pool_name="ai_pool",
        pool_size=5,
        host=os.getenv("DB_HOST"),
        port=parse_int(os.getenv("DB_PORT")) or 3306,
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
    )


def extract_member_name(prompt: str) -> str | None:
    patterns = [
        r"ten\s+['\"]?([^'\"]+?)['\"]?$",
        r"nguoi\s+ten\s+['\"]?([^'\"]+?)['\"]?$",
        r"thanh vien\s+ten\s+['\"]?([^'\"]+?)['\"]?$",
        r"ai la\s+['\"]?([^'\"]+?)['\"]?$",
        r"tim\s+['\"]?([^'\"]+?)['\"]?$",
    ]
    raw = prompt.strip()
    for pattern in patterns:
        match = re.search(pattern, raw, flags=re.IGNORECASE)
        if match:
            name = match.group(1).strip(" .,!?:;")
            if name:
                return name
    return None


def member_lookup_query(name: str, clan_id: int) -> str:
    escaped = name.replace("'", "''")
    return f"""
    SELECT id, display_name, gender, generation, branch, birth_date, death_date, is_living, hometown, bio
    FROM people
    WHERE clan_id = {clan_id}
      AND (
        display_name LIKE '%{escaped}%'
        OR CONCAT_WS(' ', surname, middle_name, first_name) LIKE '%{escaped}%'
      )
    ORDER BY
      CASE WHEN display_name = '{escaped}' THEN 0 ELSE 1 END,
      generation ASC,
      display_name ASC
    """


def semantic_query(prompt: str, user_id: int, clan_id: int) -> str | None:
    p = normalize_text(prompt)
    member_name = extract_member_name(prompt)

    if "toi la ai" in p or "thong tin cua toi" in p:
        return f"""
        SELECT p.id, p.display_name, p.gender, p.generation, p.birth_date, p.hometown, c.clan_name
        FROM accounts a
        JOIN people p ON p.id = a.person_id
        LEFT JOIN clans c ON c.id = p.clan_id
        WHERE a.id = {user_id} AND p.clan_id = {clan_id}
        """

    if "lich su dong ho" in p or "lich su gia pha" in p or "nguon goc dong ho" in p:
        return f"""
        SELECT id, clan_name, history, hall_address, created_at
        FROM clans
        WHERE id = {clan_id}
        LIMIT 1
        """

    if "tu duong" in p or "nha tho" in p or "dia chi nha tho" in p:
        return f"""
        SELECT clan_name, hall_address
        FROM clans
        WHERE id = {clan_id}
        LIMIT 1
        """

    if "bo me" in p:
        return f"""
        SELECT father.display_name AS father, mother.display_name AS mother
        FROM accounts a
        JOIN people me ON me.id = a.person_id
        JOIN children ch ON ch.person_id = me.id
        JOIN families fam ON fam.id = ch.family_id
        LEFT JOIN people father ON father.id = fam.father_id
        LEFT JOIN people mother ON mother.id = fam.mother_id
        WHERE a.id = {user_id} AND me.clan_id = {clan_id}
        LIMIT 1
        """

    if "cay gia pha" in p or "so do gia pha" in p:
        return f"""
        SELECT p.id, p.display_name, p.generation, p.branch, p.birth_date, p.death_date, p.is_living
        FROM people p
        WHERE p.clan_id = {clan_id}
        ORDER BY p.generation ASC, p.branch ASC, p.display_name ASC
        """

    if ("bao nhieu" in p or "so luong" in p or "tong cong" in p) and (
        "nguoi" in p or "thanh vien" in p or "gia pha" in p
    ):
        return f"""
        SELECT COUNT(*) AS member_count
        FROM people
        WHERE clan_id = {clan_id}
        """

    if "con toi" in p or "cac con" in p:
        return f"""
        SELECT child.id, child.display_name, child.gender, child.generation, child.birth_date
        FROM accounts a
        JOIN people me ON me.id = a.person_id
        JOIN families fam ON fam.father_id = me.id OR fam.mother_id = me.id
        JOIN children ch ON ch.family_id = fam.id
        JOIN people child ON child.id = ch.person_id
        WHERE a.id = {user_id} AND me.clan_id = {clan_id} AND child.clan_id = {clan_id}
        ORDER BY ch.sort_order, child.id
        """

    if "vo" in p or "chong" in p:
        return f"""
        SELECT spouse.id, spouse.display_name, spouse.gender, spouse.generation, spouse.birth_date
        FROM accounts a
        JOIN people me ON me.id = a.person_id
        JOIN families fam ON fam.father_id = me.id OR fam.mother_id = me.id
        JOIN people spouse
          ON (spouse.id = fam.father_id OR spouse.id = fam.mother_id)
         AND spouse.id <> me.id
        WHERE a.id = {user_id} AND me.clan_id = {clan_id} AND spouse.clan_id = {clan_id}
        LIMIT 1
        """

    if "anh chi em" in p or re.search(r"\banh\b|\bchi\b|\bem\b", p):
        return f"""
        SELECT sibling.id, sibling.display_name, sibling.gender, sibling.generation, sibling.birth_date
        FROM accounts a
        JOIN people me ON me.id = a.person_id
        JOIN children my_row ON my_row.person_id = me.id
        JOIN children sibling_row ON sibling_row.family_id = my_row.family_id
        JOIN people sibling ON sibling.id = sibling_row.person_id
        WHERE a.id = {user_id}
          AND me.clan_id = {clan_id}
          AND sibling.clan_id = {clan_id}
          AND sibling.id <> me.id
        ORDER BY sibling_row.sort_order, sibling.id
        """

    if "vo chong" in p or "hon nhan" in p:
        return f"""
        SELECT fam.id, fam.marriage_date, father.display_name AS father_name, mother.display_name AS mother_name
        FROM families fam
        LEFT JOIN people father ON father.id = fam.father_id
        LEFT JOIN people mother ON mother.id = fam.mother_id
        WHERE fam.clan_id = {clan_id}
        ORDER BY fam.marriage_date DESC, fam.id DESC
        """

    if "ong ba" in p:
        return f"""
        SELECT DISTINCT gp.display_name AS grandparent_name
        FROM accounts a
        JOIN people me ON me.id = a.person_id
        JOIN children my_row ON my_row.person_id = me.id
        JOIN families parent_fam ON parent_fam.id = my_row.family_id
        JOIN people parent_person ON parent_person.id IN (parent_fam.father_id, parent_fam.mother_id)
        JOIN children parent_row ON parent_row.person_id = parent_person.id
        JOIN families grand_fam ON grand_fam.id = parent_row.family_id
        JOIN people gp ON gp.id IN (grand_fam.father_id, grand_fam.mother_id)
        WHERE a.id = {user_id} AND me.clan_id = {clan_id} AND gp.clan_id = {clan_id}
        """

    if "doi" in p or "the he" in p:
        return f"""
        SELECT generation, COUNT(*) AS member_count
        FROM people
        WHERE clan_id = {clan_id}
        GROUP BY generation
        ORDER BY generation ASC
        """

    if "chi" in p and "bao nhieu" in p:
        return f"""
        SELECT branch, COUNT(*) AS member_count
        FROM people
        WHERE clan_id = {clan_id}
        GROUP BY branch
        ORDER BY branch ASC
        """

    if "truong ho" in p or "quan ly" in p or "thong bao" in p:
        return f"""
        SELECT ma.id, ma.title, ma.content, ma.priority, ma.created_at
        FROM manager_announcements ma
        JOIN accounts acc ON acc.id = ma.manager_account_id
        LEFT JOIN people p ON p.id = acc.person_id
        WHERE (p.clan_id = {clan_id} OR EXISTS (
            SELECT 1 FROM account_clans ac
            WHERE ac.account_id = acc.id AND ac.clan_id = {clan_id} AND ac.status = 'active'
        ))
        ORDER BY ma.created_at DESC, ma.id DESC
        """

    if "su kien" in p or "gio" in p or "nhac" in p:
        return f"""
        SELECT id, title, event_date, description
        FROM events
        WHERE clan_id = {clan_id}
        ORDER BY event_date DESC, id DESC
        """

    if "dong gop" in p or "ung ho" in p:
        return f"""
        SELECT ev.title, p.display_name, ec.amount, ec.contribution_date, ec.method
        FROM event_contributions ec
        JOIN events ev ON ev.id = ec.event_id
        JOIN people p ON p.id = ec.person_id
        WHERE ev.clan_id = {clan_id}
        ORDER BY ec.contribution_date DESC, ec.id DESC
        """

    if "chi phi su kien" in p or "kinh phi" in p or "chi tieu" in p:
        return f"""
        SELECT ev.title, c.item_name, c.amount, c.note, c.created_at
        FROM event_costs c
        JOIN events ev ON ev.id = c.event_id
        WHERE ev.clan_id = {clan_id}
        ORDER BY c.created_at DESC, c.id DESC
        """

    if "bai viet" in p or "bang tin" in p or "tin moi" in p:
        return f"""
        SELECT post.id, post.content, post.image_url, post.created_at, COALESCE(pe.display_name, a.email) AS author_name
        FROM posts post
        JOIN accounts a ON a.id = post.author_id
        LEFT JOIN people pe ON pe.id = a.person_id
        WHERE post.clan_id = {clan_id} AND post.status = 'approved'
        ORDER BY post.created_at DESC, post.id DESC
        """

    if "binh luan" in p or "comment" in p:
        return f"""
        SELECT pc.id, pc.content, pc.created_at, pe.display_name AS author_name, post.id AS post_id
        FROM post_comments pc
        JOIN people pe ON pe.id = pc.person_id
        JOIN posts post ON post.id = pc.post_id
        WHERE post.clan_id = {clan_id} AND post.status = 'approved'
        ORDER BY pc.created_at DESC, pc.id DESC
        """

    if "luot thich" in p or "like" in p:
        return f"""
        SELECT post.id AS post_id, COUNT(pl.id) AS like_count
        FROM posts post
        LEFT JOIN post_likes pl ON pl.post_id = post.id
        WHERE post.clan_id = {clan_id} AND post.status = 'approved'
        GROUP BY post.id
        ORDER BY like_count DESC, post.id DESC
        """

    if "thanh vien moi" in p or "nguoi moi" in p:
        return f"""
        SELECT id, display_name, generation, hometown, created_at
        FROM people
        WHERE clan_id = {clan_id}
        ORDER BY created_at DESC, id DESC
        """

    if "thanh vien da mat" in p or "qua doi" in p:
        return f"""
        SELECT id, display_name, generation, death_date, hometown
        FROM people
        WHERE clan_id = {clan_id} AND (is_living = 0 OR death_date IS NOT NULL)
        ORDER BY death_date DESC, generation ASC, display_name ASC
        """

    if "thanh vien con song" in p or "con song" in p:
        return f"""
        SELECT id, display_name, generation, birth_date, hometown
        FROM people
        WHERE clan_id = {clan_id} AND (is_living = 1 OR death_date IS NULL)
        ORDER BY generation ASC, display_name ASC
        """

    if member_name:
        return member_lookup_query(member_name, clan_id)

    if "thanh vien" in p or "gia pha" in p or "dong ho" in p:
        return f"""
        SELECT id, display_name, generation, branch, hometown, birth_date, is_living
        FROM people
        WHERE clan_id = {clan_id}
        ORDER BY generation ASC, branch ASC, display_name ASC
        """

    return None


def semantic_query_global(prompt: str, user_id: int | None) -> str | None:
    p = normalize_text(prompt)

    if "dong ho" in p or "danh sach clan" in p or "danh sach dong" in p or "cac dong" in p:
        return """
        SELECT c.id, c.clan_name, c.hall_address, COUNT(p.id) AS member_count
        FROM clans c
        LEFT JOIN people p ON p.clan_id = c.id
        GROUP BY c.id, c.clan_name, c.hall_address
        ORDER BY c.id ASC
        """

    if "tong quan" in p or "thong ke" in p or "dashboard" in p:
        return """
        SELECT
          (SELECT COUNT(*) FROM clans) AS clan_count,
          (SELECT COUNT(*) FROM people) AS member_count,
          (SELECT COUNT(*) FROM accounts) AS account_count,
          (SELECT COUNT(*) FROM posts WHERE status = 'pending') AS pending_post_count
        """

    if "tai khoan" in p or "account" in p or "nguoi dung" in p:
        return """
        SELECT a.id, a.email, a.role_id, a.status, p.display_name, p.clan_id
        FROM accounts a
        LEFT JOIN people p ON p.id = a.person_id
        ORDER BY a.created_at DESC, a.id DESC
        """

    if "bai viet" in p or "bang tin" in p or "tin moi" in p:
        return """
        SELECT post.id, post.clan_id, post.content, post.image_url, post.status, post.created_at,
               COALESCE(pe.display_name, a.email) AS author_name
        FROM posts post
        JOIN accounts a ON a.id = post.author_id
        LEFT JOIN people pe ON pe.id = a.person_id
        ORDER BY post.created_at DESC, post.id DESC
        """

    if "su kien" in p or "gio" in p or "nhac" in p:
        return """
        SELECT ev.id, ev.clan_id, c.clan_name, ev.title, ev.event_date, ev.description
        FROM events ev
        LEFT JOIN clans c ON c.id = ev.clan_id
        ORDER BY ev.event_date DESC, ev.id DESC
        """

    if "thanh vien" in p or "gia pha" in p or "people" in p:
        return """
        SELECT p.id, p.clan_id, c.clan_name, p.display_name, p.generation, p.branch, p.hometown, p.created_at
        FROM people p
        LEFT JOIN clans c ON c.id = p.clan_id
        ORDER BY p.created_at DESC, p.id DESC
        """

    return None


def public_answer(client: Groq | None, model: str, prompt: str) -> str:
    fallback = (
        "Tôi là trợ lý AI của Gia Phả Việt. Bạn có thể hỏi về cách đăng ký, đăng nhập, "
        "tạo dòng họ, quản lý cây gia phả, thành viên, bài viết, sự kiện và thư viện."
    )
    if client is None:
        p = normalize_text(prompt)
        if "dang ky" in p:
            return "Bạn có thể đăng ký tài khoản hoặc đăng ký dòng họ mới trên trang chủ, sau đó chờ quản trị viên xét duyệt."
        if "dang nhap" in p:
            return "Bạn đăng nhập bằng email và mật khẩu đã được cấp. Hệ thống sẽ đưa bạn vào trang phù hợp với vai trò."
        return fallback

    try:
        res = client.chat.completions.create(
            model=model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": PUBLIC_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        return (res.choices[0].message.content or "").strip() or fallback
    except Exception:
        return fallback


def answer_general(client: Groq | None, model: str, prompt: str) -> str:
    fallback = (
        "Tôi là trợ lý AI của hệ thống Gia Phả Việt. "
        "Bạn có thể hỏi tôi về cách sử dụng hệ thống, quản lý thành viên, "
        "dòng họ, bài viết, sự kiện hoặc các thông tin gia phả nếu bạn có quyền truy cập."
    )

    if client is None:
        return fallback

    try:
        res = client.chat.completions.create(
            model=model,
            temperature=0.4,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Bạn là trợ lý AI của hệ thống Gia Phả Việt. "
                        "Trả lời tự nhiên bằng tiếng Việt có dấu, rõ ràng, dễ hiểu. "
                        "Bạn có thể hỗ trợ người dùng về cách sử dụng hệ thống, "
                        "quản lý gia phả, thành viên, dòng họ, bài viết, sự kiện, "
                        "và các câu hỏi thông thường. "
                        "Nếu câu hỏi cần dữ liệu riêng tư nhưng chưa có dữ liệu được cung cấp, "
                        "hãy nói rằng cần đăng nhập hoặc cần quyền truy cập. "
                        "Không bịa dữ liệu từ database."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )

        text = (res.choices[0].message.content or "").strip()
        return text or fallback
    except Exception:
        return fallback


def answer_with_database(client: Groq | None, model: str, prompt: str, data: dict[str, Any]) -> str:
    fallback = "Tôi đã lấy được dữ liệu, nhưng hiện chưa thể diễn giải bằng AI."

    if client is None:
        return fallback

    try:
        res = client.chat.completions.create(
            model=model,
            temperature=0.2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Bạn là trợ lý AI của hệ thống Gia Phả Việt. "
                        "Hãy trả lời bằng tiếng Việt có dấu, tự nhiên, dễ hiểu. "
                        "Chỉ được sử dụng dữ liệu được cung cấp trong DATABASE_CONTEXT. "
                        "Không được bịa thêm người, quan hệ, ngày tháng, sự kiện hoặc số liệu. "
                        "Nếu DATABASE_CONTEXT không có dữ liệu phù hợp, hãy nói rõ rằng "
                        "hệ thống chưa có dữ liệu phù hợp."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Câu hỏi của người dùng:\n{prompt}\n\n"
                        f"DATABASE_CONTEXT:\n{json.dumps(data, ensure_ascii=False, default=str)}"
                    ),
                },
            ],
        )

        text = (res.choices[0].message.content or "").strip()
        return text or fallback
    except Exception:
        return fallback


def simple_answer(prompt: str, rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "Không tìm thấy dữ liệu phù hợp trong gia phả cho câu hỏi này."

    first = rows[0]
    if len(rows) == 1 and "father" in first and "mother" in first:
        father = first.get("father") or "chưa có dữ liệu"
        mother = first.get("mother") or "chưa có dữ liệu"
        return f"Bố: {father}. Mẹ: {mother}."

    if len(rows) == 1 and "clan_name" in first and ("history" in first or "hall_address" in first):
        clan_name = first.get("clan_name") or "Dòng họ hiện tại"
        history = first.get("history")
        hall_address = first.get("hall_address")
        parts = [f"Thông tin của {clan_name}."]
        if history:
            parts.append(f"Lịch sử: {history}")
        if hall_address:
            parts.append(f"Từ đường: {hall_address}")
        return " ".join(parts)

    if "generation" in first and "member_count" in first:
        parts = [f"Đời {row['generation']}: {row['member_count']} người" for row in rows]
        return "Thống kê theo đời: " + "; ".join(parts) + "."

    if len(rows) == 1 and "member_count" in first:
        return f"Gia phả hiện có {first.get('member_count') or 0} thành viên."

    if "branch" in first and "member_count" in first:
        parts = [f"Chi {row['branch']}: {row['member_count']} người" for row in rows]
        return "Thống kê theo chi: " + "; ".join(parts) + "."

    if "like_count" in first and "post_id" in first:
        parts = [f"Bài viết {row['post_id']}: {row['like_count']} lượt thích" for row in rows[:10]]
        return "Thống kê lượt thích: " + "; ".join(parts) + "."

    labels = []
    for row in rows[:10]:
        if row.get("display_name"):
            labels.append(str(row["display_name"]))
        elif row.get("grandparent_name"):
            labels.append(str(row["grandparent_name"]))
        elif row.get("father_name") or row.get("mother_name"):
            father_name = row.get("father_name") or "chưa rõ"
            mother_name = row.get("mother_name") or "chưa rõ"
            marriage_date = row.get("marriage_date")
            suffix = f" ({marriage_date})" if marriage_date else ""
            labels.append(f"{father_name} - {mother_name}{suffix}")
        elif row.get("title"):
            labels.append(str(row["title"]))
        elif row.get("author_name") and row.get("content"):
            labels.append(f"{row['author_name']}: {str(row['content'])[:50]}")
        else:
            values = [str(v) for v in row.values() if v not in (None, "")]
            if values:
                labels.append(", ".join(values[:3]))

    if not labels:
        return f"Tìm thấy {len(rows)} bản ghi phù hợp."
    if len(rows) <= 10:
        return f"Tìm thấy {len(rows)} kết quả: " + "; ".join(labels) + "."
    return f"Tìm thấy {len(rows)} kết quả. Một vài mục đầu: " + "; ".join(labels) + "."


def summarize_rows(client: Groq | None, model: str, prompt: str, rows: list[dict[str, Any]]) -> str:
    fallback = simple_answer(prompt, rows)
    if client is None or not rows:
        return fallback

    try:
        preview = json.dumps(rows[:8], ensure_ascii=False, default=str)
        res = client.chat.completions.create(
            model=model,
            temperature=0.2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Bạn là trợ lý gia phả. Hãy tóm tắt kết quả truy vấn thành tiếng Việt "
                        "rõ ràng, ngắn gọn, thân thiện. Không được bịa thêm thông tin."
                    ),
                },
                {"role": "user", "content": f"Câu hỏi: {prompt}\nDữ liệu: {preview}"},
            ],
        )
        text = (res.choices[0].message.content or "").strip()
        return text or fallback
    except Exception:
        return fallback


ROLE_NAMES = {1: "admin", 2: "manager", 3: "member"}

GENERAL_INTENTS = {
    "GREETING",
    "HELP",
    "CAPABILITY",
    "HOW_TO_USE",
    "GENERAL_QUESTION",
    "PUBLIC",
    "UNKNOWN",
}

RELATION_INTENTS = {
    "PARENTS",
    "CHILDREN",
    "SPOUSE",
    "SIBLINGS",
    "GRANDPARENTS",
}

CLAN_INTENTS = {
    "PROFILE",
    "CLAN_INFO",
    "CLAN_OVERVIEW",
    "MEMBER_SEARCH",
    "TREE",
    "MEMBER_COUNT",
    "GENERATION_STATS",
    "BRANCH_STATS",
    "EVENTS",
    "POSTS",
    "ANNOUNCEMENTS",
    "NOTIFICATIONS",
    "CONTRIBUTIONS",
    "EVENT_COSTS",
    "LIVING_MEMBERS",
    "DECEASED_MEMBERS",
    "RECENT_MEMBERS",
}

MANAGER_INTENTS = CLAN_INTENTS | RELATION_INTENTS | {"CONTRIBUTIONS", "EVENT_COSTS"}
MEMBER_INTENTS = CLAN_INTENTS | RELATION_INTENTS
ADMIN_INTENTS = MANAGER_INTENTS | {
    "ADMIN_OVERVIEW",
    "ADMIN_CLANS",
    "ADMIN_ACCOUNTS",
    "ADMIN_POSTS",
    "ADMIN_EVENTS",
    "ADMIN_MEMBERS",
}

DB_INTENTS = ADMIN_INTENTS | MANAGER_INTENTS | MEMBER_INTENTS | {
    "WHO_AM_I",
    "MY_PARENTS",
    "MY_CHILDREN",
    "MY_SPOUSE",
    "CLAN_MEMBERS_COUNT",
    "CLAN_HISTORY",
    "PERSON_INFO",
    "RECENT_POSTS",
    "UPCOMING_EVENTS",
}

SENSITIVE_PATTERNS = (
    "mat khau",
    "password",
    "pass",
    "hash",
    "token",
    "jwt",
    "secret",
    "otp",
    "reset",
    "database url",
    "connection string",
)


def strip_accents(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text or "")
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return without_marks.replace("đ", "d").replace("Đ", "D")


def normalize_vietnamese(text: str) -> str:
    normalized = strip_accents(text).lower().strip()
    normalized = re.sub(r"\s+", " ", normalized)
    replacements = (
        ("cha me", "bo me"),
        ("ba me", "bo me"),
        ("me cha", "bo me"),
        ("phu mau", "bo me"),
        ("ong noi", "ong ba"),
        ("ba noi", "ong ba"),
        ("ong ngoai", "ong ba"),
        ("ba ngoai", "ong ba"),
        ("nha tho", "tu duong"),
        ("gia toc", "gia pha"),
        ("dong toc", "dong ho"),
    )
    for src, dst in replacements:
        normalized = normalized.replace(src, dst)
    return normalized


def normalize_role(role: Any, role_id: Any = None) -> str:
    raw = str(role or "").strip().lower()
    if raw in {"admin", "manager", "member"}:
        return raw
    parsed_role_id = parse_int(role_id)
    return ROLE_NAMES.get(parsed_role_id or 3, "member")


def build_request_context(body: dict[str, Any]) -> dict[str, Any]:
    role = normalize_role(body.get("role") or body.get("role_name"), body.get("role_id"))
    account_id = parse_int(body.get("account_id")) or parse_int(body.get("user_id"))
    return {
        "account_id": account_id,
        "person_id": parse_int(body.get("person_id")),
        "clan_id": parse_int(body.get("clan_id")),
        "role": role,
        "display_name": str(body.get("display_name") or "").strip() or None,
    }


def context_user_payload(ctx: dict[str, Any]) -> dict[str, Any]:
    return {
        "account_id": ctx.get("account_id"),
        "person_id": ctx.get("person_id"),
        "clan_id": ctx.get("clan_id"),
        "role": ctx.get("role"),
        "display_name": ctx.get("display_name"),
    }


def extract_member_name_vn(prompt: str) -> str | None:
    raw = str(prompt or "").strip()
    patterns = (
        r"^(?:tim|tìm)\s+(?:nguoi|người|thanh vien|thành viên)?\s*(?:ten|tên)?\s+(.+)$",
        r"(?:nguoi|người|thanh vien|thành viên)\s+(?:ten|tên)\s+(.+)$",
        r"(?:ai la|ai là)\s+(.+)$",
    )
    for pattern in patterns:
        match = re.search(pattern, raw, flags=re.IGNORECASE)
        if match:
            name = match.group(1).strip(" .,!?:;\"'")
            if name:
                return name
    return extract_member_name(strip_accents(raw))


def detect_intent(prompt: str) -> tuple[str, float, dict[str, Any]]:
    p = normalize_vietnamese(prompt)
    slots: dict[str, Any] = {}

    member_name = extract_member_name_vn(prompt)
    if member_name and (has_token(p, "tim") or has_token(p, "ten") or has_any_phrase(p, ("ai la",))):
        slots["name"] = member_name
        return "MEMBER_SEARCH", 0.92, slots

    if has_any_phrase(p, ("mat khau", "password", "token", "secret")):
        return "SENSITIVE_DATA", 0.99, slots

    if p in {"xin chao", "chao", "hello", "hi"} or has_phrase(p, "xin chao"):
        return "GREETING", 0.95, slots
    if has_any_phrase(p, ("ban la ai", "ban co the lam gi", "ban lam duoc gi", "chuc nang cua ban", "tro ly ai")):
        return "CAPABILITY", 0.95, slots
    if has_any_phrase(
        p,
        (
            "huong dan",
            "cach su dung",
            "lam sao",
            "lam the nao",
            "bat dau",
            "them thanh vien",
            "tao gia pha",
            "tao dong ho",
        ),
    ):
        return "HOW_TO_USE", 0.8, slots
    if has_any_phrase(p, ("ngay le", "le lon")) or (
        has_any_phrase(p, ("thang toi", "thang sau")) and not has_phrase(p, "su kien")
    ):
        return "GENERAL_QUESTION", 0.75, slots

    # Specific database intents must be checked before broad intents.
    if has_any_phrase(p, ("chi phi su kien", "kinh phi su kien", "chi tieu su kien", "chi phi")):
        return "EVENT_COSTS", 0.9, slots
    if has_any_phrase(p, ("dong gop su kien", "dong gop", "ung ho su kien", "ung ho")):
        return "CONTRIBUTIONS", 0.9, slots
    if has_any_phrase(p, ("thong bao quan ly", "thong bao truong ho", "thong bao tu quan ly", "truong ho")):
        return "ANNOUNCEMENTS", 0.9, slots
    if has_any_phrase(p, ("thong bao cua toi", "thong bao cho toi", "thong bao ca nhan", "notification cua toi")):
        return "NOTIFICATIONS", 0.9, slots
    if has_phrase(p, "thong bao"):
        return "NOTIFICATIONS", 0.82, slots
    if has_any_phrase(p, ("nguoi con song", "thanh vien con song", "con song trong dong ho", "con song")):
        return "LIVING_MEMBERS", 0.88, slots
    if has_any_phrase(p, ("nguoi da mat", "thanh vien da mat", "nhung nguoi da mat", "da mat", "qua doi")):
        return "DECEASED_MEMBERS", 0.88, slots
    if has_any_phrase(p, ("bo me", "bo toi", "me toi", "cha toi", "cha me toi", "con cua ai")):
        return "PARENTS", 0.95, slots
    if (
        has_any_phrase(p, ("con toi", "cac con cua toi", "con cua toi", "toi co may nguoi con", "toi co may con"))
        or re.search(r"(?<![a-z0-9])bao nhieu\s+con(?![a-z0-9])", p)
        or re.search(r"(?<![a-z0-9])may\s+nguoi\s+con(?![a-z0-9])", p)
    ):
        return "CHILDREN", 0.92, slots
    if has_any_phrase(p, ("vo toi", "chong toi", "vo cua toi", "chong cua toi", "vo chong cua toi")):
        return "SPOUSE", 0.9, slots
    if has_any_phrase(p, ("anh chi em", "anh em toi", "chi em toi", "anh chi em toi")):
        return "SIBLINGS", 0.9, slots
    if has_any_phrase(p, ("ong ba", "ong noi", "ba noi", "ong ngoai", "ba ngoai")):
        return "GRANDPARENTS", 0.9, slots
    if has_any_phrase(p, ("su kien sap toi", "lich su kien sap toi")) or (
        has_phrase(p, "su kien") and has_any_phrase(p, ("sap toi", "gan toi", "toi day"))
    ):
        slots["time"] = "upcoming"
        return "EVENTS", 0.86, slots
    if has_phrase(p, "su kien") or has_token(p, "gio") or has_token(p, "nhac"):
        return "EVENTS", 0.82, slots
    if has_any_phrase(p, ("bai viet moi nhat", "bai viet", "bang tin", "tin moi")):
        return "POSTS", 0.82, slots
    if has_any_phrase(p, ("tai khoan cua toi", "thong tin tai khoan", "toi la ai", "thong tin cua toi")):
        return "PROFILE", 0.95, slots
    if has_any_phrase(p, ("lich su dong ho", "lich su gia pha", "nguon goc dong ho", "tu duong", "tong quan dong ho")):
        return "CLAN_OVERVIEW", 0.9, slots
    if has_token(p, "tong quan") or has_token(p, "dashboard") or (has_token(p, "thong ke") and has_token(p, "he thong")):
        return "ADMIN_OVERVIEW", 0.88, slots
    if has_any_phrase(p, ("danh sach clan", "cac dong ho", "tat ca dong ho")):
        return "ADMIN_CLANS", 0.9, slots
    if has_token(p, "tai khoan") or has_token(p, "account") or has_any_phrase(p, ("nguoi dung",)):
        return "ADMIN_ACCOUNTS", 0.85, slots
    if has_phrase(p, "bai viet toan he thong"):
        return "ADMIN_POSTS", 0.85, slots
    if has_phrase(p, "su kien toan he thong"):
        return "ADMIN_EVENTS", 0.85, slots
    if has_phrase(p, "thanh vien toan he thong"):
        return "ADMIN_MEMBERS", 0.85, slots
    if has_any_phrase(p, ("cay gia pha", "so do gia pha")):
        return "TREE", 0.86, slots
    if (has_any_phrase(p, ("bao nhieu", "so luong", "tong cong"))) and (
        has_token(p, "nguoi") or has_phrase(p, "thanh vien") or has_phrase(p, "gia pha")
    ):
        return "MEMBER_COUNT", 0.88, slots
    if has_phrase(p, "the he") or has_token(p, "doi"):
        return "GENERATION_STATS", 0.82, slots
    if has_token(p, "chi") and has_any_phrase(p, ("bao nhieu", "thong ke")):
        return "BRANCH_STATS", 0.82, slots
    if has_any_phrase(p, ("thanh vien moi", "nguoi moi")):
        return "RECENT_MEMBERS", 0.82, slots
    if has_phrase(p, "dong ho") or has_phrase(p, "gia pha"):
        return "CLAN_OVERVIEW", 0.65, slots
    if has_phrase(p, "thanh vien"):
        return "TREE", 0.65, slots
    return "UNKNOWN", 0.0, slots


def permission_denial(intent: str, ctx: dict[str, Any], prompt: str) -> str | None:
    p = normalize_vietnamese(prompt)
    role = ctx.get("role") or "member"

    if intent in GENERAL_INTENTS or intent == "UNKNOWN":
        return None

    if intent == "SENSITIVE_DATA" or any(has_phrase(p, pattern) for pattern in SENSITIVE_PATTERNS):
        return "Tôi không thể cung cấp mật khẩu, token, khóa bí mật hoặc dữ liệu nhạy cảm."

    allowed = ADMIN_INTENTS if role == "admin" else MANAGER_INTENTS if role == "manager" else MEMBER_INTENTS
    if intent not in allowed:
        if role == "admin" and intent == "UNKNOWN":
            return None
        return "Bạn không có quyền hỏi loại dữ liệu này hoặc câu hỏi chưa nằm trong danh sách intent được hỗ trợ."

    if role != "admin" and not ctx.get("clan_id"):
        return "Tài khoản của bạn chưa được gắn với dòng họ nên chưa thể tra cứu dữ liệu gia phả."

    if intent in RELATION_INTENTS and not ctx.get("person_id"):
        return "Tài khoản của bạn chưa được liên kết với hồ sơ thành viên nên chưa thể tra cứu quan hệ gia đình."

    return None


def fixed_query(intent: str, ctx: dict[str, Any], slots: dict[str, Any]) -> tuple[str, list[Any]] | None:
    account_id = ctx.get("account_id")
    person_id = ctx.get("person_id")
    clan_id = ctx.get("clan_id")
    role = ctx.get("role")

    if role == "admin" and not clan_id:
        if intent == "MEMBER_SEARCH":
            name = str(slots.get("name") or "").strip()
            like_name = f"%{name}%"
            return (
                """
                SELECT p.id, p.clan_id, c.clan_name, p.display_name, p.gender, p.generation,
                       p.branch, p.birth_date, p.death_date, p.is_living, p.hometown, p.bio
                FROM people p
                LEFT JOIN clans c ON c.id = p.clan_id
                WHERE p.display_name LIKE %s
                   OR CONCAT_WS(' ', p.surname, p.middle_name, p.first_name) LIKE %s
                ORDER BY
                  CASE WHEN p.display_name = %s THEN 0 ELSE 1 END,
                  p.clan_id ASC,
                  p.generation ASC,
                  p.display_name ASC
                """,
                [like_name, like_name, name],
            )
        if intent == "TREE":
            return (
                """
                SELECT p.id, p.clan_id, c.clan_name, p.display_name, p.generation, p.branch, p.hometown, p.created_at
                FROM people p
                LEFT JOIN clans c ON c.id = p.clan_id
                ORDER BY p.created_at DESC, p.id DESC
                """,
                [],
            )
        if intent == "MEMBER_COUNT":
            return ("SELECT COUNT(*) AS member_count FROM people", [])
        if intent == "GENERATION_STATS":
            return (
                """
                SELECT generation, COUNT(*) AS member_count
                FROM people
                GROUP BY generation
                ORDER BY generation ASC
                """,
                [],
            )
        if intent == "BRANCH_STATS":
            return (
                """
                SELECT branch, COUNT(*) AS member_count
                FROM people
                GROUP BY branch
                ORDER BY branch ASC
                """,
                [],
            )
        if intent == "EVENTS":
            if slots.get("time") == "upcoming":
                return (
                    """
                    SELECT ev.id, ev.clan_id, c.clan_name, ev.title, ev.event_date, ev.description
                    FROM events ev
                    LEFT JOIN clans c ON c.id = ev.clan_id
                    WHERE ev.event_date >= CURDATE()
                    ORDER BY ev.event_date ASC, ev.id ASC
                    """,
                    [],
                )
            return (
                """
                SELECT ev.id, ev.clan_id, c.clan_name, ev.title, ev.event_date, ev.description
                FROM events ev
                LEFT JOIN clans c ON c.id = ev.clan_id
                ORDER BY ev.event_date DESC, ev.id DESC
                """,
                [],
            )
        if intent == "POSTS":
            return (
                """
                SELECT post.id, post.clan_id, post.content, post.image_url, post.status, post.created_at,
                       COALESCE(pe.display_name, a.email) AS author_name
                FROM posts post
                JOIN accounts a ON a.id = post.author_id
                LEFT JOIN people pe ON pe.id = a.person_id
                ORDER BY post.created_at DESC, post.id DESC
                """,
                [],
            )
        if intent == "LIVING_MEMBERS":
            return (
                """
                SELECT p.id, p.clan_id, c.clan_name, p.display_name, p.generation, p.birth_date, p.hometown
                FROM people p
                LEFT JOIN clans c ON c.id = p.clan_id
                WHERE p.is_living = 1 OR p.death_date IS NULL
                ORDER BY p.clan_id ASC, p.generation ASC, p.display_name ASC
                """,
                [],
            )
        if intent == "DECEASED_MEMBERS":
            return (
                """
                SELECT p.id, p.clan_id, c.clan_name, p.display_name, p.generation, p.death_date, p.hometown
                FROM people p
                LEFT JOIN clans c ON c.id = p.clan_id
                WHERE p.is_living = 0 OR p.death_date IS NOT NULL
                ORDER BY p.death_date DESC, p.clan_id ASC, p.display_name ASC
                """,
                [],
            )
        if intent == "CONTRIBUTIONS":
            return (
                """
                SELECT ev.clan_id, c.clan_name, ev.title, p.display_name, ec.amount,
                       ec.contribution_date, ec.method, ec.note
                FROM event_contributions ec
                JOIN events ev ON ev.id = ec.event_id
                LEFT JOIN clans c ON c.id = ev.clan_id
                JOIN people p ON p.id = ec.person_id AND p.clan_id = ev.clan_id
                ORDER BY ec.contribution_date DESC, ec.id DESC
                """,
                [],
            )
        if intent == "EVENT_COSTS":
            return (
                """
                SELECT ev.clan_id, c.clan_name, ev.title, cost.item_name, cost.amount, cost.note, cost.created_at
                FROM event_costs cost
                JOIN events ev ON ev.id = cost.event_id
                LEFT JOIN clans c ON c.id = ev.clan_id
                ORDER BY cost.created_at DESC, cost.id DESC
                """,
                [],
            )
        if intent == "ANNOUNCEMENTS":
            return (
                """
                SELECT ma.id, ma.title, ma.content, ma.priority, ma.created_at,
                       ma.manager_account_id, acc.email AS manager_email
                FROM manager_announcements ma
                JOIN accounts acc ON acc.id = ma.manager_account_id
                ORDER BY ma.created_at DESC, ma.id DESC
                """,
                [],
            )
        if intent == "NOTIFICATIONS":
            return (
                """
                SELECT n.id, n.receiver_account_id, n.receiver_person_id,
                       related.clan_id, c.clan_name, n.type, n.title, n.message,
                       n.is_read, n.link_url, n.created_at,
                       a.email AS receiver_email, related.display_name AS related_person_name
                FROM notifications n
                LEFT JOIN accounts a ON a.id = n.receiver_account_id
                LEFT JOIN people related ON related.id = n.receiver_person_id
                LEFT JOIN clans c ON c.id = related.clan_id
                ORDER BY n.created_at DESC, n.id DESC
                """,
                [],
            )

    if intent == "PROFILE":
        if role == "admin":
            return (
                """
                SELECT a.id AS account_id, a.email, a.role_id, a.status, p.id AS person_id,
                       p.display_name, p.gender, p.generation, p.birth_date, p.hometown,
                       c.id AS clan_id, c.clan_name
                FROM accounts a
                LEFT JOIN people p ON p.id = a.person_id
                LEFT JOIN clans c ON c.id = p.clan_id
                WHERE a.id = %s
                LIMIT 1
                """,
                [account_id],
            )
        return (
            """
            SELECT a.id AS account_id, a.email, a.role_id, a.status, p.id AS person_id,
                   p.display_name, p.gender, p.generation, p.birth_date, p.hometown,
                   COALESCE(p.clan_id, ac.clan_id) AS clan_id, c.clan_name
            FROM accounts a
            LEFT JOIN account_clans ac
              ON ac.account_id = a.id
             AND ac.status = 'active'
             AND (%s IS NULL OR ac.clan_id = %s)
            LEFT JOIN people p ON p.id = COALESCE(a.person_id, ac.person_id)
            LEFT JOIN clans c ON c.id = COALESCE(p.clan_id, ac.clan_id)
            WHERE a.id = %s AND COALESCE(p.clan_id, ac.clan_id) = %s
            LIMIT 1
            """,
            [clan_id, clan_id, account_id, clan_id],
        )

    if intent == "PARENTS":
        return (
            """
            SELECT father.display_name AS father, mother.display_name AS mother
            FROM people me
            JOIN children ch ON ch.person_id = me.id
            JOIN families fam ON fam.id = ch.family_id AND fam.clan_id = %s
            LEFT JOIN people father ON father.id = fam.father_id
            LEFT JOIN people mother ON mother.id = fam.mother_id
            WHERE me.id = %s AND me.clan_id = %s
            LIMIT 1
            """,
            [clan_id, person_id, clan_id],
        )

    if intent == "CHILDREN":
        return (
            """
            SELECT child.id, child.display_name, child.gender, child.generation, child.birth_date
            FROM people me
            JOIN families fam ON (fam.father_id = me.id OR fam.mother_id = me.id) AND fam.clan_id = %s
            JOIN children ch ON ch.family_id = fam.id
            JOIN people child ON child.id = ch.person_id
            WHERE me.id = %s AND me.clan_id = %s AND child.clan_id = %s
            ORDER BY ch.sort_order, child.id
            """,
            [clan_id, person_id, clan_id, clan_id],
        )

    if intent == "SPOUSE":
        return (
            """
            SELECT spouse.id, spouse.display_name, spouse.gender, spouse.generation, spouse.birth_date
            FROM people me
            JOIN families fam ON (fam.father_id = me.id OR fam.mother_id = me.id) AND fam.clan_id = %s
            JOIN people spouse
              ON (spouse.id = fam.father_id OR spouse.id = fam.mother_id)
             AND spouse.id <> me.id
            WHERE me.id = %s AND me.clan_id = %s AND spouse.clan_id = %s
            LIMIT 1
            """,
            [clan_id, person_id, clan_id, clan_id],
        )

    if intent == "SIBLINGS":
        return (
            """
            SELECT sibling.id, sibling.display_name, sibling.gender, sibling.generation, sibling.birth_date
            FROM people me
            JOIN children my_row ON my_row.person_id = me.id
            JOIN children sibling_row ON sibling_row.family_id = my_row.family_id
            JOIN people sibling ON sibling.id = sibling_row.person_id
            WHERE me.id = %s
              AND me.clan_id = %s
              AND sibling.clan_id = %s
              AND sibling.id <> me.id
            ORDER BY sibling_row.sort_order, sibling.id
            """,
            [person_id, clan_id, clan_id],
        )

    if intent == "GRANDPARENTS":
        return (
            """
            SELECT DISTINCT gp.display_name AS grandparent_name
            FROM people me
            JOIN children my_row ON my_row.person_id = me.id
            JOIN families parent_fam ON parent_fam.id = my_row.family_id AND parent_fam.clan_id = %s
            JOIN people parent_person ON parent_person.id IN (parent_fam.father_id, parent_fam.mother_id)
            JOIN children parent_row ON parent_row.person_id = parent_person.id
            JOIN families grand_fam ON grand_fam.id = parent_row.family_id AND grand_fam.clan_id = %s
            JOIN people gp ON gp.id IN (grand_fam.father_id, grand_fam.mother_id)
            WHERE me.id = %s AND me.clan_id = %s AND gp.clan_id = %s
            """,
            [clan_id, clan_id, person_id, clan_id, clan_id],
        )

    if intent in {"CLAN_INFO", "CLAN_OVERVIEW"}:
        return (
            """
            SELECT id, clan_name, history, hall_address, created_at
            FROM clans
            WHERE id = %s
            LIMIT 1
            """,
            [clan_id],
        )

    if intent == "MEMBER_SEARCH":
        name = str(slots.get("name") or "").strip()
        like_name = f"%{name}%"
        return (
            """
            SELECT id, display_name, gender, generation, branch, birth_date, death_date, is_living, hometown, bio
            FROM people
            WHERE clan_id = %s
              AND (
                display_name LIKE %s
                OR CONCAT_WS(' ', surname, middle_name, first_name) LIKE %s
              )
            ORDER BY
              CASE WHEN display_name = %s THEN 0 ELSE 1 END,
              generation ASC,
              display_name ASC
            """,
            [clan_id, like_name, like_name, name],
        )

    if intent == "TREE":
        return (
            """
            SELECT id, display_name, gender, generation, branch, birth_date, death_date, is_living, hometown
            FROM people
            WHERE clan_id = %s
            ORDER BY generation ASC, branch ASC, display_name ASC
            """,
            [clan_id],
        )

    if intent == "MEMBER_COUNT":
        return ("SELECT COUNT(*) AS member_count FROM people WHERE clan_id = %s", [clan_id])

    if intent == "GENERATION_STATS":
        return (
            """
            SELECT generation, COUNT(*) AS member_count
            FROM people
            WHERE clan_id = %s
            GROUP BY generation
            ORDER BY generation ASC
            """,
            [clan_id],
        )

    if intent == "BRANCH_STATS":
        return (
            """
            SELECT branch, COUNT(*) AS member_count
            FROM people
            WHERE clan_id = %s
            GROUP BY branch
            ORDER BY branch ASC
            """,
            [clan_id],
        )

    if intent == "ANNOUNCEMENTS":
        return (
            """
            SELECT ma.id, ma.title, ma.content, ma.priority, ma.created_at
            FROM manager_announcements ma
            JOIN accounts acc ON acc.id = ma.manager_account_id
            LEFT JOIN people p ON p.id = acc.person_id
            WHERE (p.clan_id = %s OR EXISTS (
                SELECT 1 FROM account_clans ac
                WHERE ac.account_id = acc.id AND ac.clan_id = %s AND ac.status = 'active'
            ))
            ORDER BY ma.created_at DESC, ma.id DESC
            """,
            [clan_id, clan_id],
        )

    if intent == "NOTIFICATIONS":
        return (
            """
            SELECT n.id, n.type, n.title, n.message, n.is_read, n.link_url, n.created_at,
                   n.receiver_account_id, n.receiver_person_id,
                   related.display_name AS related_person_name
            FROM notifications n
            LEFT JOIN people related ON related.id = n.receiver_person_id
            WHERE n.receiver_account_id = %s
               OR (
                    n.receiver_account_id IS NULL
                    AND n.receiver_person_id = %s
                    AND related.clan_id = %s
                  )
            ORDER BY n.created_at DESC, n.id DESC
            """,
            [account_id, person_id, clan_id],
        )

    if intent == "EVENTS":
        if slots.get("time") == "upcoming":
            return (
                """
                SELECT id, title, event_date, description
                FROM events
                WHERE clan_id = %s AND event_date >= CURDATE()
                ORDER BY event_date ASC, id ASC
                """,
                [clan_id],
            )
        return (
            """
            SELECT id, title, event_date, description
            FROM events
            WHERE clan_id = %s
            ORDER BY event_date DESC, id DESC
            """,
            [clan_id],
        )

    if intent == "CONTRIBUTIONS":
        return (
            """
            SELECT ev.title, p.display_name, ec.amount, ec.contribution_date, ec.method
            FROM event_contributions ec
            JOIN events ev ON ev.id = ec.event_id
            JOIN people p ON p.id = ec.person_id AND p.clan_id = ev.clan_id
            WHERE ev.clan_id = %s
            ORDER BY ec.contribution_date DESC, ec.id DESC
            """,
            [clan_id],
        )

    if intent == "EVENT_COSTS":
        return (
            """
            SELECT ev.title, c.item_name, c.amount, c.note, c.created_at
            FROM event_costs c
            JOIN events ev ON ev.id = c.event_id
            WHERE ev.clan_id = %s
            ORDER BY c.created_at DESC, c.id DESC
            """,
            [clan_id],
        )

    if intent == "POSTS":
        return (
            """
            SELECT post.id, post.content, post.image_url, post.created_at,
                   COALESCE(pe.display_name, a.email) AS author_name
            FROM posts post
            JOIN accounts a ON a.id = post.author_id
            LEFT JOIN people pe ON pe.id = a.person_id
            WHERE post.clan_id = %s AND post.status = 'approved'
            ORDER BY post.created_at DESC, post.id DESC
            """,
            [clan_id],
        )

    if intent == "RECENT_MEMBERS":
        return (
            """
            SELECT id, display_name, generation, hometown, created_at
            FROM people
            WHERE clan_id = %s
            ORDER BY created_at DESC, id DESC
            """,
            [clan_id],
        )

    if intent == "DECEASED_MEMBERS":
        return (
            """
            SELECT id, display_name, generation, death_date, hometown
            FROM people
            WHERE clan_id = %s AND (is_living = 0 OR death_date IS NOT NULL)
            ORDER BY death_date DESC, generation ASC, display_name ASC
            """,
            [clan_id],
        )

    if intent == "LIVING_MEMBERS":
        return (
            """
            SELECT id, display_name, generation, birth_date, hometown
            FROM people
            WHERE clan_id = %s AND (is_living = 1 OR death_date IS NULL)
            ORDER BY generation ASC, display_name ASC
            """,
            [clan_id],
        )

    if intent == "ADMIN_OVERVIEW":
        return (
            """
            SELECT
              (SELECT COUNT(*) FROM clans) AS clan_count,
              (SELECT COUNT(*) FROM people) AS member_count,
              (SELECT COUNT(*) FROM accounts) AS account_count,
              (SELECT COUNT(*) FROM posts WHERE status = 'pending') AS pending_post_count
            """,
            [],
        )

    if intent == "ADMIN_CLANS":
        return (
            """
            SELECT c.id, c.clan_name, c.hall_address, COUNT(p.id) AS member_count
            FROM clans c
            LEFT JOIN people p ON p.clan_id = c.id
            GROUP BY c.id, c.clan_name, c.hall_address
            ORDER BY c.id ASC
            """,
            [],
        )

    if intent == "ADMIN_ACCOUNTS":
        return (
            """
            SELECT a.id, a.email, a.role_id, a.status, p.display_name, p.clan_id
            FROM accounts a
            LEFT JOIN people p ON p.id = a.person_id
            ORDER BY a.created_at DESC, a.id DESC
            """,
            [],
        )

    if intent == "ADMIN_POSTS":
        return (
            """
            SELECT post.id, post.clan_id, post.content, post.image_url, post.status, post.created_at,
                   COALESCE(pe.display_name, a.email) AS author_name
            FROM posts post
            JOIN accounts a ON a.id = post.author_id
            LEFT JOIN people pe ON pe.id = a.person_id
            ORDER BY post.created_at DESC, post.id DESC
            """,
            [],
        )

    if intent == "ADMIN_EVENTS":
        return (
            """
            SELECT ev.id, ev.clan_id, c.clan_name, ev.title, ev.event_date, ev.description
            FROM events ev
            LEFT JOIN clans c ON c.id = ev.clan_id
            ORDER BY ev.event_date DESC, ev.id DESC
            """,
            [],
        )

    if intent == "ADMIN_MEMBERS":
        return (
            """
            SELECT p.id, p.clan_id, c.clan_name, p.display_name, p.generation, p.branch, p.hometown, p.created_at
            FROM people p
            LEFT JOIN clans c ON c.id = p.clan_id
            ORDER BY p.created_at DESC, p.id DESC
            """,
            [],
        )

    return None


def json_safe(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    return value


def shape_data(intent: str, rows: list[dict[str, Any]]) -> Any:
    safe_rows = json_safe(rows)
    first = safe_rows[0] if safe_rows else {}
    if intent == "PARENTS":
        return {"father": first.get("father"), "mother": first.get("mother")}
    if intent in {"PROFILE", "CLAN_INFO", "CLAN_OVERVIEW", "MEMBER_COUNT", "ADMIN_OVERVIEW"}:
        return first or {}
    return safe_rows


def missing_data_answer(intent: str) -> str:
    messages = {
        "PARENTS": (
            "Không tìm thấy dữ liệu bố mẹ của bạn trong gia phả hiện tại. "
            "Nguyên nhân có thể là bạn chưa được gán vào bảng children hoặc gia đình chưa có father_id/mother_id."
        ),
        "CHILDREN": "Không tìm thấy dữ liệu con của bạn trong gia phả hiện tại.",
        "SPOUSE": "Không tìm thấy dữ liệu vợ/chồng của bạn trong gia phả hiện tại.",
        "SIBLINGS": "Không tìm thấy dữ liệu anh chị em của bạn trong gia phả hiện tại.",
        "GRANDPARENTS": "Không tìm thấy dữ liệu ông bà của bạn trong gia phả hiện tại.",
        "PROFILE": "Không tìm thấy hồ sơ thành viên liên kết với tài khoản của bạn.",
        "CLAN_INFO": "Không tìm thấy thông tin dòng họ hiện tại.",
    }
    return messages.get(intent, "Không tìm thấy dữ liệu phù hợp trong phạm vi bạn được phép truy cập.")


def deterministic_answer(intent: str, data: Any, rows: list[dict[str, Any]], prompt: str) -> str:
    if not rows:
        return missing_data_answer(intent)

    if intent == "PARENTS":
        father = data.get("father")
        mother = data.get("mother")
        if not father and not mother:
            return missing_data_answer(intent)
        parts = []
        parts.append(f"Bố của bạn là {father}." if father else "Chưa có dữ liệu bố của bạn.")
        parts.append(f"Mẹ của bạn là {mother}." if mother else "Chưa có dữ liệu mẹ của bạn.")
        return " ".join(parts)

    if intent == "PROFILE":
        name = data.get("display_name") or "chưa có tên"
        clan = data.get("clan_name") or "chưa gắn dòng họ"
        generation = data.get("generation")
        suffix = f", đời {generation}" if generation else ""
        return f"Bạn là {name}, thuộc dòng họ {clan}{suffix}."

    if intent in {"CLAN_INFO", "CLAN_OVERVIEW"}:
        clan_name = data.get("clan_name") or "dòng họ hiện tại"
        history = data.get("history")
        hall = data.get("hall_address")
        parts = [f"Thông tin {clan_name}."]
        if history:
            parts.append(f"Lịch sử: {history}")
        if hall:
            parts.append(f"Từ đường/nhà thờ: {hall}")
        if len(parts) == 1:
            parts.append("Hiện chưa có lịch sử hoặc địa chỉ từ đường trong dữ liệu.")
        return " ".join(parts)

    if intent == "MEMBER_COUNT":
        return f"Dòng họ hiện có {data.get('member_count') or 0} thành viên."

    if intent == "SPOUSE":
        first = rows[0]
        return f"Vợ/chồng của bạn là {first.get('display_name')}." if first.get("display_name") else missing_data_answer(intent)

    if intent in {"CHILDREN", "SIBLINGS", "GRANDPARENTS", "MEMBER_SEARCH", "TREE", "LIVING_MEMBERS", "DECEASED_MEMBERS", "RECENT_MEMBERS"}:
        key = "grandparent_name" if intent == "GRANDPARENTS" else "display_name"
        names = [str(row.get(key)) for row in rows[:10] if row.get(key)]
        if names:
            prefix = {
                "CHILDREN": "Các con của bạn",
                "SIBLINGS": "Anh chị em của bạn",
                "GRANDPARENTS": "Ông bà của bạn",
                "MEMBER_SEARCH": "Kết quả tìm thành viên",
                "TREE": "Một số thành viên trong gia phả",
                "LIVING_MEMBERS": "Thành viên còn sống",
                "DECEASED_MEMBERS": "Thành viên đã mất",
                "RECENT_MEMBERS": "Thành viên mới",
            }[intent]
            more = "" if len(rows) <= 10 else f" và {len(rows) - 10} người khác"
            return f"{prefix}: {', '.join(names)}{more}."

    if intent in {"POSTS", "EVENTS", "CONTRIBUTIONS", "EVENT_COSTS", "ANNOUNCEMENTS", "NOTIFICATIONS"}:
        labels = []
        for row in rows[:10]:
            if row.get("title") and row.get("display_name") and row.get("amount") is not None:
                labels.append(f"{row.get('title')} - {row.get('display_name')}: {row.get('amount')}")
            elif row.get("title") and row.get("item_name"):
                labels.append(f"{row.get('title')} - {row.get('item_name')}: {row.get('amount')}")
            elif row.get("title"):
                labels.append(str(row.get("title")))
            elif row.get("message"):
                labels.append(str(row.get("message"))[:80])
        if labels:
            more = "" if len(rows) <= 10 else f" va {len(rows) - 10} muc khac"
            return f"Tim thay {len(rows)} ket qua: " + "; ".join(labels) + more + "."

    return simple_answer(prompt, rows)


AI_AUDIT_DDL = """
CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_id INT NULL,
  person_id INT NULL,
  clan_id INT NULL,
  role VARCHAR(50) NULL,
  prompt TEXT NOT NULL,
  intent VARCHAR(80) NULL,
  confidence DECIMAL(5,4) NULL,
  row_count INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  error TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ai_audit_account (account_id),
  KEY idx_ai_audit_clan (clan_id),
  KEY idx_ai_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""


def write_ai_audit(
    get_pool,
    ctx: dict[str, Any],
    prompt: str,
    intent: str,
    confidence: float,
    row_count: int,
    duration_ms: int,
    error: str | None = None,
) -> None:
    conn = None
    cur = None
    try:
        conn = get_pool().get_connection()
        cur = conn.cursor()
        cur.execute(AI_AUDIT_DDL)
        cur.execute(
            """
            INSERT INTO ai_audit_logs
              (account_id, person_id, clan_id, role, prompt, intent, confidence, row_count, duration_ms, error)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                ctx.get("account_id"),
                ctx.get("person_id"),
                ctx.get("clan_id"),
                ctx.get("role"),
                prompt[:5000],
                intent,
                confidence,
                row_count,
                duration_ms,
                (error or "")[:4000] or None,
            ],
        )
        conn.commit()
    except Exception:
        # Audit must never break the user-facing AI flow.
        pass
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


def create_app() -> Flask:
    app = Flask(__name__)

    groq_key = os.getenv("GROQ_API_KEY")
    groq_client = Groq(api_key=groq_key) if groq_key else None
    db_pool = None

    def get_pool():
        nonlocal db_pool
        if db_pool is None:
            db_pool = get_db()
        return db_pool

    @app.get("/health")
    def health():
        return jsonify(
            {
                "success": True,
                "service": "ai-server",
                "groq_configured": bool(groq_key),
                "db_configured": bool(os.getenv("DB_HOST") and os.getenv("DB_USER") and os.getenv("DB_NAME")),
            }
        )

    @app.post("/public/chat")
    def public_chat():
        body = request.get_json(silent=True) or {}
        prompt = str(body.get("prompt") or "").strip()

        if not prompt:
            return jsonify({"success": False, "message": "Prompt không được để trống."}), 400

        intent, confidence, _slots = detect_intent(prompt)
        private_intents = DB_INTENTS | {"SENSITIVE_DATA"}
        if intent in private_intents:
            answer = "Bạn cần đăng nhập để tôi có thể tra cứu dữ liệu dòng họ và trả lời chính xác."
            return jsonify(
                {
                    "success": True,
                    "scope": "public",
                    "intent": intent,
                    "confidence": confidence,
                    "prompt": prompt,
                    "row_count": 0,
                    "data": {},
                    "answer": answer,
                }
            )

        answer = public_answer(groq_client, MODEL_NAME, prompt)
        return jsonify(
            {
                "success": True,
                "scope": "public",
                "intent": intent if intent != "UNKNOWN" else "PUBLIC",
                "confidence": confidence,
                "prompt": prompt,
                "row_count": 0,
                "data": {},
                "answer": answer,
            }
        )

    @app.post("/ask-db")
    def ask():
        started_at = time.perf_counter()
        body = request.get_json(silent=True) or {}

        prompt = str(body.get("prompt") or "").strip()
        ctx = build_request_context(body)
        scope = str(body.get("scope") or "").strip().lower()
        public_scope = scope == "public"

        if not prompt:
            return jsonify({"success": False, "message": "Prompt không được để trống."}), 400

        intent, confidence, slots = detect_intent(prompt)
        user_payload = context_user_payload(ctx)

        if public_scope or intent in GENERAL_INTENTS or intent == "UNKNOWN":
            if public_scope and intent in (DB_INTENTS | {"SENSITIVE_DATA"}):
                answer = "Bạn cần đăng nhập để tôi có thể tra cứu dữ liệu dòng họ và trả lời chính xác."
            else:
                answer = public_answer(groq_client, MODEL_NAME, prompt) if public_scope else answer_general(groq_client, MODEL_NAME, prompt)
            write_ai_audit(
                get_pool,
                ctx,
                prompt,
                "PUBLIC" if public_scope else intent,
                1 if public_scope else confidence,
                0,
                int((time.perf_counter() - started_at) * 1000),
            )
            return jsonify(
                {
                    "success": True,
                    "intent": "PUBLIC" if public_scope else intent,
                    "confidence": 1 if public_scope else confidence,
                    "prompt": prompt,
                    "scope": "public" if public_scope else scope or None,
                    "row_count": 0,
                    "user": None if public_scope else user_payload,
                    "data": {},
                    "answer": answer,
                }
            )

        if ctx.get("account_id") is None:
            return jsonify({"success": False, "message": "Thiếu account_id."}), 400

        denial = permission_denial(intent, ctx, prompt)
        if denial:
            write_ai_audit(
                get_pool,
                ctx,
                prompt,
                intent,
                confidence,
                0,
                int((time.perf_counter() - started_at) * 1000),
                denial,
            )
            return jsonify(
                {
                    "success": False,
                    "intent": intent,
                    "confidence": confidence,
                    "prompt": prompt,
                    "user": user_payload,
                    "row_count": 0,
                    "data": {},
                    "answer": denial,
                    "message": denial,
                }
            ), 403

        query = fixed_query(intent, ctx, slots)
        if not query:
            answer = answer_general(groq_client, MODEL_NAME, prompt)
            write_ai_audit(
                get_pool,
                ctx,
                prompt,
                intent,
                confidence,
                0,
                int((time.perf_counter() - started_at) * 1000),
            )
            return jsonify(
                {
                    "success": True,
                    "intent": intent,
                    "confidence": confidence,
                    "prompt": prompt,
                    "user": user_payload,
                    "row_count": 0,
                    "data": {},
                    "answer": answer,
                }
            )

        conn = None
        cur = None

        try:
            conn = get_pool().get_connection()
            sql, params = query
            sql = add_limit(sql)

            if not safe_sql(sql):
                return jsonify({"success": False, "message": "SQL khong an toan"}), 400

            cur = conn.cursor(dictionary=True)
            cur.execute(sql, params)
            rows = cur.fetchall()
            shaped_data = shape_data(intent, rows)
            data = {
                "intent": intent,
                "rows": json_safe(rows),
                "row_count": len(rows),
            }
            direct_answer_intents = RELATION_INTENTS | {
                "PROFILE",
                "CLAN_INFO",
                "CLAN_OVERVIEW",
                "MEMBER_COUNT",
                "LIVING_MEMBERS",
                "DECEASED_MEMBERS",
                "POSTS",
                "EVENTS",
                "CONTRIBUTIONS",
                "EVENT_COSTS",
                "ANNOUNCEMENTS",
                "NOTIFICATIONS",
            }
            if not rows or intent in direct_answer_intents:
                answer = deterministic_answer(intent, shaped_data, rows, prompt)
            else:
                answer = answer_with_database(groq_client, MODEL_NAME, prompt, data)
            write_ai_audit(
                get_pool,
                ctx,
                prompt,
                intent,
                confidence,
                len(rows),
                int((time.perf_counter() - started_at) * 1000),
            )

            if not answer or answer == "Tôi đã lấy được dữ liệu, nhưng hiện chưa thể diễn giải bằng AI.":
                answer = deterministic_answer(intent, shaped_data, rows, prompt)

            return jsonify(
                {
                    "success": True,
                    "intent": intent,
                    "confidence": confidence,
                    "prompt": prompt,
                    "user": user_payload,
                    "row_count": len(rows),
                    "data": data,
                    "answer": answer,
                }
            )
        except Exception as exc:
            app.logger.exception("AI database query failed")
            write_ai_audit(
                get_pool,
                ctx,
                prompt,
                intent,
                confidence,
                0,
                int((time.perf_counter() - started_at) * 1000),
                str(exc),
            )
            return jsonify(
                {
                    "success": False,
                    "intent": intent,
                    "confidence": confidence,
                    "user": user_payload,
                    "data": {},
                    "answer": "Khong the truy van du lieu AI luc nay. Vui long thu lai sau.",
                    "message": "Khong the truy van du lieu AI luc nay. Vui long thu lai sau.",
                }
            ), 503
        finally:
            if cur is not None:
                cur.close()
            if conn is not None:
                conn.close()

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
