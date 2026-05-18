# AI-server

AI-server la Flask service dung rieng cho cac tinh nang AI tao du lieu nhap cua Gia Pha Viet.

Service nay khong truy van du lieu rieng, khong tao su kien/cong viec/thanh vien that, va khong tu ghi database. Backend hoac frontend goi cac endpoint AI rieng theo tung man hinh, sau do hien thi du lieu nhap de nguoi dung hoac manager kiem tra.

## API

### `GET /health`

Response:

```json
{
  "success": true,
  "service": "ai-server",
  "groq_configured": true
}
```

### `POST /event-form/generate`

Request:

```json
{
  "mode": "event_create",
  "prompt": "Tao su kien gio to thang 8 tai nha tho ho, khoang 50 nguoi tham du",
  "today": "2026-05-17",
  "clan_id": 1,
  "requested_task_count": 6
}
```

Response:

```json
{
  "success": true,
  "status": "success",
  "mode": "event_create",
  "event": {
    "title": "Gio to",
    "event_date": "2026-08-01",
    "description": "Tao su kien gio to thang 8 tai nha tho ho, khoang 50 nguoi tham du",
    "clan_id": 1
  },
  "manager_tasks": [
    {
      "event_id": null,
      "member_id": null,
      "title": "Lap danh sach con chau tham du",
      "description": "Tong hop so luong thanh vien tham du de chuan bi le va tiep don.",
      "due_date": "2026-07-25",
      "status": "assigned"
    }
  ]
}
```

## Cai Dat

```powershell
cd AI-server
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python app.py
```

Bien moi truong chinh:

```text
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_TIMEOUT_SECONDS=8
AI_DISABLE_GROQ=false
HOST=0.0.0.0
PORT=8001
DEBUG=false
```

Neu khong co `GROQ_API_KEY`, server van tra fallback JSON voi `success: true` cho prompt hop le.

## Chay

```powershell
cd AI-server
.venv\Scripts\Activate.ps1
python app.py
```

Mac dinh server chay tai:

```text
http://localhost:8001
```

Backend can tro toi AI-server bang:

```text
AI_SERVER_URL=http://localhost:8001
```

### `POST /genealogy/extract`

Endpoint rieng cho AI trich xuat du lieu gia pha. Khong dung chung prompt va khong di qua `/event-form/generate`.

Request text:

```json
{
  "input_source": "text",
  "prompt": "Ong Nguyen Van A co vo la ba Tran Thi B, hai nguoi co con la Nguyen Van C"
}
```

Request voice transcript:

```json
{
  "input_source": "voice_transcript",
  "prompt": "Transcript da chuyen tu giong noi..."
}
```

Response:

```json
{
  "members": [],
  "relationships": [],
  "uncertain_items": [],
  "warnings": [],
  "summary": {
    "total_members_detected": 0,
    "total_relationships_detected": 0,
    "needs_human_review": true
  }
}
```

Voice-to-text flow neu co:

```text
Voice Input -> /api/voice/... -> transcript -> /genealogy/extract
```

## Kiem Tra

```powershell
cd AI-server
python -m unittest discover tests
```
