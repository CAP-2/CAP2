# Voice MVP

Module nay them luong ghi am va speech-to-text local cho project Node/Express + Python hien tai.

## 1. Tao bang MySQL

Backend route va worker se tu chay `voice/schema.sql` khi khoi dong. Neu MySQL user khong co quyen `CREATE TABLE`, hay chay SQL nay thu cong trong phpMyAdmin.

## 2. Cai Python dependency

`faster-whisper` can Python 64-bit. Nen dung Python 3.11 hoac 3.12 ban 64-bit tren Windows. Python 3.13 32-bit se khong cai duoc dependency `ctranslate2`.

```bash
cd AI-server
pip install -r requirements.txt
```

Neu worker bao thieu dependency nhu `requests`, hay dam bao dang activate dung `.venv-whisper` roi chay lai lenh `pip install -r requirements.txt`.

Neu may dang dung Python 32-bit, cai Python 3.12 x64 roi tao lai venv:

```bash
cd D:\cap2
py -3.12 -m venv .venv-whisper
.\.venv-whisper\Scripts\Activate.ps1
python -m pip install --upgrade pip
cd AI-server
pip install -r requirements.txt
```

Neu da co venv cu tai `AI-server\.venv` duoc tao bang Python 32-bit, khong dung venv do cho worker. Prompt dung nen la `(.venv-whisper)`, khong phai `(.venv)`.

`faster-whisper` se tai model lan dau khi worker chay. Mac dinh dang dung:

```text
VOICE_WHISPER_MODEL=base
VOICE_WHISPER_DEVICE=cpu
VOICE_WHISPER_COMPUTE_TYPE=int8
VOICE_WHISPER_LANGUAGE=vi
```

Co the doi sang `small` neu may chiu duoc.

## 3. Chay backend va worker

```bash
cd Backend
npm run dev
```

Mo terminal khac:

```bash
cd D:\cap2
.\.venv-whisper\Scripts\Activate.ps1
python -c "import platform, sys; print(platform.architecture()); print(sys.executable)"
python voice/worker.py
```

## 4. API

- `POST /api/voice/recordings`
  - Auth bat buoc.
  - FormData field: `audio`
  - Optional field: `duration_seconds`
  - File duoc luu private tai `Backend/storage/recordings`.

- `GET /api/voice/recordings/:id`
  - Tra ve `status`, `transcript`, `error_message`.

Gioi han mac dinh:

```text
VOICE_MAX_DURATION_SECONDS=180
VOICE_MAX_FILE_MB=25
```
