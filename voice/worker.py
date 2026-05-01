import os
import platform
import sys
import time
import traceback
from pathlib import Path

from dotenv import load_dotenv
import mysql.connector


REPO_ROOT = Path(__file__).resolve().parents[1]

load_dotenv(REPO_ROOT / "Backend" / ".env")
load_dotenv(REPO_ROOT / "AI-server" / ".env")
load_dotenv(REPO_ROOT / ".env")

STORAGE_ROOT = Path(os.getenv("VOICE_STORAGE_ROOT") or (REPO_ROOT / "Backend" / "storage")).resolve()
POLL_SECONDS = float(os.getenv("VOICE_WORKER_POLL_SECONDS", "5"))
MODEL_NAME = os.getenv("VOICE_WHISPER_MODEL", "base")
DEVICE = os.getenv("VOICE_WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("VOICE_WHISPER_COMPUTE_TYPE", "int8")
LANGUAGE = os.getenv("VOICE_WHISPER_LANGUAGE", "vi").strip() or None


def load_whisper_model_class():
    if platform.architecture()[0] != "64bit":
        raise RuntimeError(
            "faster-whisper can cai Python 64-bit. Ban dang dung "
            f"{platform.architecture()[0]}: {sys.executable}"
        )

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError(
            f"Thieu dependency Python: {exc}. Hay activate venv dung va chay: "
            "pip install -r AI-server/requirements.txt"
        ) from exc

    return WhisperModel


def db_config() -> dict:
    return {
        "host": os.getenv("DB_HOST"),
        "port": int(os.getenv("DB_PORT") or 3306),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME"),
        "connection_timeout": 10,
    }


def connect():
    return mysql.connector.connect(**db_config())


def ensure_schema():
    schema_sql = (REPO_ROOT / "voice" / "schema.sql").read_text(encoding="utf-8")
    conn = connect()
    cur = conn.cursor()
    try:
        cur.execute(schema_sql)
        conn.commit()
    finally:
        cur.close()
        conn.close()


def claim_recording():
    conn = connect()
    cur = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()
        cur.execute(
            """
            SELECT id, storage_path
            FROM recordings
            WHERE status = 'uploaded'
            ORDER BY created_at ASC, id ASC
            LIMIT 1
            FOR UPDATE
            """
        )
        row = cur.fetchone()
        if not row:
            conn.commit()
            return None

        cur.execute(
            """
            UPDATE recordings
            SET status = 'transcribing', error_message = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (row["id"],),
        )
        conn.commit()
        return row
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_recording(recording_id: int, status: str, transcript: str | None = None, error_message: str | None = None):
    conn = connect()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE recordings
            SET status = %s,
                transcript = CASE WHEN %s IS NULL THEN transcript ELSE %s END,
                error_message = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (status, transcript, transcript, error_message, recording_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def resolve_audio_path(storage_path: str) -> Path:
    candidate = Path(storage_path)
    if candidate.is_absolute():
        return candidate
    return (STORAGE_ROOT / candidate).resolve()


def transcribe(model, audio_path: Path) -> str:
    segments, _info = model.transcribe(
        str(audio_path),
        language=LANGUAGE,
        beam_size=5,
        vad_filter=True,
    )
    return " ".join(segment.text.strip() for segment in segments if segment.text).strip()


def main():
    print(
        f"Voice worker started: model={MODEL_NAME}, device={DEVICE}, "
        f"compute_type={COMPUTE_TYPE}, language={LANGUAGE or 'auto'}"
    )
    ensure_schema()
    WhisperModel = load_whisper_model_class()
    model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)

    while True:
        job = claim_recording()
        if not job:
            time.sleep(POLL_SECONDS)
            continue

        recording_id = int(job["id"])
        audio_path = resolve_audio_path(str(job["storage_path"]))
        print(f"Transcribing recording #{recording_id}: {audio_path}")

        try:
            if not audio_path.exists():
                raise FileNotFoundError(f"Audio file not found: {audio_path}")

            transcript = transcribe(model, audio_path)
            if not transcript:
                raise RuntimeError("Whisper returned an empty transcript.")

            update_recording(recording_id, "completed", transcript=transcript, error_message=None)
            print(f"Completed recording #{recording_id}")
        except Exception as exc:
            traceback.print_exc()
            update_recording(recording_id, "failed", error_message=str(exc)[:2000])
            print(f"Failed recording #{recording_id}: {exc}")


if __name__ == "__main__":
    main()
