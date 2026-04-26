import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from groq import Groq
from mysql.connector.pooling import MySQLConnectionPool

load_dotenv()

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
SCHEMA_HINT = """
Schema chinh:
- accounts(id, email, password, person_id, role_id, status, created_at, updated_at)
- account_clans(id, account_id, clan_id, person_id, status, created_at, updated_at)
- people(id, clan_id, display_name, first_name, middle_name, surname, gender, generation, branch, birth_date, death_date, is_living, phone, email, zalo, facebook, address, hometown, avatar_url, bio, note, created_at, pending_avatar_url, pending_bio, moderation_status, moderation_reason)
- clans(id, clan_name, history, hall_address, created_at)
- families(id, clan_id, father_id, mother_id, marriage_date)
- children(id, family_id, person_id, sort_order)
- events(id, clan_id, title, event_date, description)
- event_costs(id, event_id, item_name, amount, note, created_at)
- event_contributions(id, event_id, person_id, amount, contribution_date, method, note, created_at)
- posts(id, clan_id, author_id, content, image_url, created_at, status, rejection_reason)
- post_comments(id, post_id, person_id, parent_id, content, created_at)
- post_likes(id, post_id, person_id, created_at)
- manager_announcements(id, manager_account_id, title, content, priority, created_at)
- conversations(id, account_id, title, created_at)
- messages(id, conversation_id, sender_type, content, created_at)

Quy tac:
- Chi duoc tra ve 1 cau lenh SQL SELECT.
- "toi" la tai khoan accounts.id = {user_id}.
- Luon gioi han trong clan_id = {clan_id}.
- Uu tien cac bang people, families, children, clans de tra loi ve cay gia pha.
- Neu truy van bai viet thi uu tien posts.status = 'approved'.
- Khong duoc dung markdown hoac ```sql.
"""

GLOBAL_SCHEMA_HINT = """
Schema chinh:
- accounts(id, email, password, person_id, role_id, status, created_at, updated_at)
- account_clans(id, account_id, clan_id, person_id, status, created_at, updated_at)
- people(id, clan_id, display_name, first_name, middle_name, surname, gender, generation, branch, birth_date, death_date, is_living, phone, email, zalo, facebook, address, hometown, avatar_url, bio, note, created_at, pending_avatar_url, pending_bio, moderation_status, moderation_reason)
- clans(id, clan_name, history, hall_address, created_at)
- families(id, clan_id, father_id, mother_id, marriage_date)
- children(id, family_id, person_id, sort_order)
- events(id, clan_id, title, event_date, description)
- posts(id, clan_id, author_id, content, image_url, created_at, status, rejection_reason)
- conversations(id, account_id, title, created_at)
- messages(id, conversation_id, sender_type, content, created_at)

Quy tac:
- Chi duoc tra ve 1 cau lenh SQL SELECT.
- "toi" la tai khoan accounts.id = {user_id}.
- Day la pham vi admin/toan he thong, khong bat buoc loc theo clan_id.
- Neu truy van bai viet thi uu tien posts.status = 'approved'.
- Khong duoc dung markdown hoac ```sql.
"""

PUBLIC_SYSTEM_PROMPT = """
Ban la tro ly AI cua Gia Pha Viet tren trang chu cong khai.
Tra loi ngan gon bang tieng Viet, huong dan nguoi dung ve dang ky, dang nhap,
tao dong ho, quan ly cay gia pha, thanh vien, bai viet, su kien va thu vien.
Khong duoc noi rang ban da truy cap du lieu rieng tu neu nguoi dung chua dang nhap.
"""


def normalize_text(text: str) -> str:
    text = text.lower().strip()
    replace = {
        "cha me": "bo me",
        "ba me": "bo me",
        "bo me": "bo me",
        "ong ba": "ong ba",
        "ong noi": "ong ba",
        "ba noi": "ong ba",
        "ong ngoai": "ong ba",
        "ba ngoai": "ong ba",
        "vo": "vo",
        "chong": "chong",
        "anh chi em": "anh chi em",
        "gia toc": "gia pha",
        "dong toc": "gia pha",
        "nha tho": "tu duong",
    }
    for src, dst in replace.items():
        text = text.replace(src, dst)
    return text


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
        "Toi la tro ly AI cua Gia Pha Viet. Ban co the hoi ve cach dang ky, dang nhap, "
        "tao dong ho, quan ly cay gia pha, thanh vien, bai viet, su kien va thu vien."
    )
    if client is None:
        p = normalize_text(prompt)
        if "dang ky" in p:
            return "Ban co the dang ky tai khoan hoac dang ky dong ho moi tren trang chu, sau do cho quan tri vien xet duyet."
        if "dang nhap" in p:
            return "Ban dang nhap bang email va mat khau da duoc cap. He thong se dua ban vao trang phu hop voi vai tro."
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


def ai_sql(
    client: Groq | None,
    model: str,
    prompt: str,
    user_id: int | None,
    clan_id: int | None,
    global_scope: bool = False,
) -> str | None:
    if client is None:
        return None

    system_prompt = (
        GLOBAL_SCHEMA_HINT.format(user_id=user_id or 0)
        if global_scope
        else SCHEMA_HINT.format(user_id=user_id, clan_id=clan_id)
    )
    res = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
    )
    return extract_sql_candidate(res.choices[0].message.content or "")


def simple_answer(prompt: str, rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "Khong tim thay du lieu phu hop trong gia pha cho cau hoi nay."

    first = rows[0]
    if len(rows) == 1 and "father" in first and "mother" in first:
        father = first.get("father") or "chua co du lieu"
        mother = first.get("mother") or "chua co du lieu"
        return f"Bo: {father}. Me: {mother}."

    if len(rows) == 1 and "clan_name" in first and ("history" in first or "hall_address" in first):
        clan_name = first.get("clan_name") or "Dong ho hien tai"
        history = first.get("history")
        hall_address = first.get("hall_address")
        parts = [f"Thong tin cua {clan_name}."]
        if history:
            parts.append(f"Lich su: {history}")
        if hall_address:
            parts.append(f"Tu duong: {hall_address}")
        return " ".join(parts)

    if "generation" in first and "member_count" in first:
        parts = [f"Doi {row['generation']}: {row['member_count']} nguoi" for row in rows]
        return "Thong ke theo doi: " + "; ".join(parts) + "."

    if len(rows) == 1 and "member_count" in first:
        return f"Gia pha hien co {first.get('member_count') or 0} thanh vien."

    if "branch" in first and "member_count" in first:
        parts = [f"Chi {row['branch']}: {row['member_count']} nguoi" for row in rows]
        return "Thong ke theo chi: " + "; ".join(parts) + "."

    if "like_count" in first and "post_id" in first:
        parts = [f"Bai viet {row['post_id']}: {row['like_count']} luot thich" for row in rows[:10]]
        return "Thong ke luot thich: " + "; ".join(parts) + "."

    labels = []
    for row in rows[:10]:
        if row.get("display_name"):
            labels.append(str(row["display_name"]))
        elif row.get("grandparent_name"):
            labels.append(str(row["grandparent_name"]))
        elif row.get("father_name") or row.get("mother_name"):
            father_name = row.get("father_name") or "chua ro"
            mother_name = row.get("mother_name") or "chua ro"
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
        return f"Tim thay {len(rows)} ban ghi phu hop."
    if len(rows) <= 10:
        return f"Tim thay {len(rows)} ket qua: " + "; ".join(labels) + "."
    return f"Tim thay {len(rows)} ket qua. Mot vai muc dau: " + "; ".join(labels) + "."


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
                        "Ban la tro ly gia pha. Hay tom tat ket qua truy van thanh tieng Viet "
                        "ro rang, ngan gon, than thien. Khong duoc bịa them thong tin."
                    ),
                },
                {"role": "user", "content": f"Cau hoi: {prompt}\nDu lieu: {preview}"},
            ],
        )
        text = (res.choices[0].message.content or "").strip()
        return text or fallback
    except Exception:
        return fallback


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

    @app.post("/ask-db")
    def ask():
        body = request.get_json(silent=True) or {}

        prompt = str(body.get("prompt") or "").strip()
        user_id = parse_int(body.get("user_id"))
        clan_id = parse_int(body.get("clan_id"))
        scope = str(body.get("scope") or "").strip().lower()
        public_scope = scope == "public"
        global_scope = bool(body.get("global")) or scope in {"admin", "global"}

        if not prompt:
            return jsonify({"success": False, "message": "Thieu prompt"}), 400
        if public_scope or (user_id is None and clan_id is None):
            return jsonify(
                {
                    "success": True,
                    "prompt": prompt,
                    "scope": "public",
                    "row_count": 0,
                    "data": [],
                    "answer": public_answer(groq_client, MODEL_NAME, prompt),
                }
            )
        if user_id is None:
            return jsonify({"success": False, "message": "Thieu user_id hoac clan_id"}), 400
        if clan_id is None and not global_scope:
            return jsonify({"success": False, "message": "Thieu user_id hoac clan_id"}), 400

        conn = None
        cur = None

        try:
            conn = get_pool().get_connection()
            sql = semantic_query_global(prompt, user_id) if global_scope and clan_id is None else semantic_query(prompt, user_id, clan_id)
            if not sql:
                sql = ai_sql(groq_client, MODEL_NAME, prompt, user_id, clan_id, global_scope=global_scope and clan_id is None)

            sql = extract_sql_candidate(sql or "")
            if not sql:
                return jsonify({"success": False, "message": "Khong tao duoc truy van SQL"}), 400

            if clan_id is not None:
                sql = enforce_clan(sql, clan_id)
            sql = add_limit(sql)

            if not safe_sql(sql):
                return jsonify({"success": False, "message": "SQL khong an toan"}), 400

            cur = conn.cursor(dictionary=True)
            cur.execute(sql)
            rows = cur.fetchall()
            answer = summarize_rows(groq_client, MODEL_NAME, prompt, rows)

            return jsonify(
                {
                    "success": True,
                    "prompt": prompt,
                    "sql": sql,
                    "row_count": len(rows),
                    "data": rows,
                    "answer": answer,
                }
            )
        except Exception as exc:
            return jsonify({"success": False, "message": f"Khong ket noi hoac truy van duoc database: {exc}"}), 503
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
