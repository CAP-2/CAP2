import json
import os
import re
from typing import Any

import mysql.connector
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from groq import Groq
from mysql.connector.connection import MySQLConnection
from mysql.connector.pooling import MySQLConnectionPool


load_dotenv()


READ_ONLY_SQL = ("select", "show", "describe", "explain")
BLOCKED_SQL_PATTERNS = (
    r"\binsert\b",
    r"\bupdate\b",
    r"\bdelete\b",
    r"\bdrop\b",
    r"\balter\b",
    r"\btruncate\b",
    r"\bcreate\b",
    r"\bgrant\b",
    r"\brevoke\b",
)


def normalize_sql(sql: str) -> str:
    return re.sub(r"\s+", " ", sql.strip())


def is_safe_read_only_sql(sql: str) -> bool:
    normalized = normalize_sql(sql).lower().rstrip(";")
    if not normalized.startswith(READ_ONLY_SQL):
        return False
    return not any(re.search(pattern, normalized) for pattern in BLOCKED_SQL_PATTERNS)


def format_schema_rows(rows: list[dict[str, Any]]) -> str:
    grouped: dict[str, list[str]] = {}
    for row in rows:
        grouped.setdefault(row["TABLE_NAME"], []).append(
            f'- {row["COLUMN_NAME"]} ({row["COLUMN_TYPE"]})'
        )

    parts: list[str] = []
    for table_name, columns in grouped.items():
        parts.append(f"Table: {table_name}")
        parts.extend(columns)
        parts.append("")
    return "\n".join(parts).strip()


def get_db_pool() -> MySQLConnectionPool:
    return MySQLConnectionPool(
        pool_name=os.getenv("DB_POOL_NAME", "ai_server_pool"),
        pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
    )


def fetch_schema(conn: MySQLConnection) -> str:
    query = """
        SELECT
            TABLE_NAME,
            COLUMN_NAME,
            COLUMN_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s
        ORDER BY TABLE_NAME, ORDINAL_POSITION
    """
    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(query, (os.getenv("DB_NAME"),))
        return format_schema_rows(cursor.fetchall())


def generate_sql(client: Groq, model: str, schema_text: str, prompt: str) -> str:
    system_prompt = (
        "Ban la tro ly viet SQL cho he thong gia pha. "
        "Chi duoc tao truy van read-only phuc vu doc du lieu MySQL. "
        "Chi tra ve mot cau SQL duy nhat, khong markdown, khong giai thich, khong backticks. "
        "Neu khong the tra loi an toan bang truy van doc du lieu, tra ve: SELECT 'Khong the tra loi an toan' AS message"
    )
    user_prompt = (
        f"Schema database:\n{schema_text}\n\n"
        f"Yeu cau nguoi dung: {prompt}\n\n"
        "Hay tao truy van SQL toi uu va an toan de doc du lieu."
    )
    completion = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return completion.choices[0].message.content.strip()


def summarize_result(
    client: Groq,
    model: str,
    prompt: str,
    sql: str,
    rows: list[dict[str, Any]],
) -> str:
    payload = json.dumps(rows, ensure_ascii=False, default=str)
    system_prompt = (
        "Ban la tro ly phan tich du lieu gia pha. "
        "Hay tra loi bang tieng Viet, ngan gon, ro rang, dua dung vao ket qua SQL. "
        "Neu ket qua rong, noi ro la khong tim thay du lieu phu hop."
    )
    user_prompt = (
        f"Cau hoi: {prompt}\n"
        f"SQL da chay: {sql}\n"
        f"Ket qua JSON: {payload}"
    )
    completion = client.chat.completions.create(
        model=model,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return completion.choices[0].message.content.strip()


def create_app() -> Flask:
    app = Flask(__name__)

    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    if not groq_api_key:
        raise RuntimeError("GROQ_API_KEY is required.")

    groq_client = Groq(api_key=groq_api_key)
    db_pool = get_db_pool()

    @app.get("/health")
    def health() -> Any:
        return jsonify(
            {
                "status": "ok",
                "service": "groq-mysql-ai-server",
                "model": groq_model,
                "database": os.getenv("DB_NAME"),
            }
        )

    @app.post("/ask-db")
    def ask_db() -> Any:
        body = request.get_json(silent=True) or {}
        prompt = str(body.get("prompt") or "").strip()

        if not prompt:
            return jsonify({"success": False, "message": "prompt is required."}), 400

        conn = None
        try:
            conn = db_pool.get_connection()
            schema_text = fetch_schema(conn)
            sql = generate_sql(groq_client, groq_model, schema_text, prompt)
            sql = normalize_sql(sql)

            if not is_safe_read_only_sql(sql):
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": "Generated SQL was blocked because it is not read-only.",
                            "sql": sql,
                        }
                    ),
                    400,
                )

            with conn.cursor(dictionary=True) as cursor:
                cursor.execute(sql)
                rows = cursor.fetchall()

            answer = summarize_result(groq_client, groq_model, prompt, sql, rows)
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
        except mysql.connector.Error as exc:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Database error.",
                        "details": str(exc),
                    }
                ),
                500,
            )
        except Exception as exc:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Server error.",
                        "details": str(exc),
                    }
                ),
                500,
            )
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

    return app


app = create_app()


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    app.run(host=host, port=port, debug=debug)
