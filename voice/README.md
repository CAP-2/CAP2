# Voice MVP

Module nay them luong ghi am va speech-to-text local cho project Node/Express + Python hien tai.

## 1. Tao/cap nhat bang MySQL

Backend route va worker se tu chay `voice/schema.sql` khi khoi dong. Neu MySQL user khong co quyen `CREATE TABLE`/`ALTER TABLE`, hay chay SQL trong file nay thu cong.

Bang `recordings` can co them cac cot:

```sql
ALTER TABLE recordings
ADD COLUMN transcript_edited TINYINT(1) NOT NULL DEFAULT 0 AFTER transcript,
ADD COLUMN transcript_edited_at TIMESTAMP NULL AFTER transcript_edited,
ADD COLUMN transcribed_at TIMESTAMP NULL AFTER transcript_edited_at,
ADD COLUMN processing_started_at TIMESTAMP NULL AFTER status;
```

## 2. Cai Python dependency rieng cho voice

Voice worker KHONG dung chung venv voi `AI-server`. Khong chay worker bang:

```text
D:\cap2\AI-server\.venv\Scripts\python.exe
```

Worker phai dung:

```text
D:\cap2\.venv-whisper\Scripts\python.exe
```

`faster-whisper` can Python 64-bit. Nen dung Python 3.11 hoac 3.12 ban 64-bit tren Windows.

```powershell
cd D:\cap2
py -3.12 -m venv .venv-whisper
.\.venv-whisper\Scripts\python.exe -m pip install --upgrade pip
.\.venv-whisper\Scripts\python.exe -m pip install -r .\voice\requirements.txt
```

Kiem tra dung Python:

```powershell
D:\cap2\.venv-whisper\Scripts\python.exe -c "import platform, sys; print(platform.architecture()); print(sys.executable)"
```

Neu worker bao thieu dependency, chay lai:

```powershell
D:\cap2\.venv-whisper\Scripts\python.exe -m pip install -r D:\cap2\voice\requirements.txt
```

## 3. Cai ffmpeg

Worker khong transcribe truc tiep `.webm`. Flow hien tai:

```text
.webm upload -> ffmpeg convert sang .wav 16kHz mono -> faster-whisper transcribe .wav -> luu transcript vao MySQL
```

Can cai `ffmpeg` va dam bao lenh nay chay duoc trong PowerShell:

```powershell
ffmpeg -version
```

## 4. Cau hinh Whisper

Mac dinh khuyen nghi cho tieng Viet/local CPU:

```text
VOICE_WHISPER_MODEL=small
VOICE_WHISPER_DEVICE=cpu
VOICE_WHISPER_COMPUTE_TYPE=int8
VOICE_WHISPER_LANGUAGE=vi
VOICE_WORKER_POLL_SECONDS=3
```

Van co the override trong `Backend/.env` hoac `.env` o repo root.

## 5. Chay backend va worker

```powershell
cd D:\cap2\Backend
npm run dev
```

Mo terminal khac:

```powershell
cd D:\cap2
.\run_voice_worker.ps1
```

Hoac chay truc tiep:

```powershell
D:\cap2\.venv-whisper\Scripts\python.exe D:\cap2\voice\worker.py
```

Worker se tu chan neu bi chay nham bang `AI-server\.venv`.

## 6. API

- `POST /api/voice/recordings`
  - Auth bat buoc.
  - FormData field: `audio`.
  - Optional field: `duration_seconds`.
  - File goc duoc luu private tai `Backend/storage/recordings`.

- `GET /api/voice/recordings`
  - Tra danh sach ban ghi theo quyen nguoi dung.

- `GET /api/voice/recordings/:id`
  - Tra ve `status`, `transcript`, `error_message`.

- `GET /api/voice/recordings/:id/audio`
  - Stream file audio co kiem tra quyen.
  - Khong public static thu muc recordings.

- `PATCH /api/voice/recordings/:id/transcript`
  - Body: `{ "transcript": "Noi dung da sua" }`.
  - Gioi han 50.000 ky tu.

- `POST /api/voice/recordings/:id/retry`
  - Dua ban ghi loi ve hang doi `uploaded`.
  - Khong xoa transcript da sua.

Gioi han mac dinh:

```text
VOICE_MAX_DURATION_SECONDS=180
VOICE_MAX_FILE_MB=25
```
