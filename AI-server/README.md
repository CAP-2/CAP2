# AI-server

AI-server la Flask service cho cac tinh nang AI cua Gia Pha Viet: hoi dap du lieu gia pha, tra loi tu nhien, va ho tro tao form su kien/cong viec. Server uu tien luong an toan: intent detection + SQL whitelist/fixed query, khong de model tu sinh SQL roi chay truc tiep.

## Cau truc thu muc

```text
AI-server/
├── tests/                     # Test/kiem tra endpoint va logic AI
├── __pycache__/               # Python cache, sinh ra khi chay
├── .venv/                     # Virtual environment rieng cua AI-server
├── .env                       # Cau hinh local, khong commit
├── .env.ai                    # Cau hinh AI phu neu can
├── .env.example               # Mau bien moi truong
├── .gitignore                 # Ignore Python env/cache
├── app.py                     # Flask app entry va API handlers
├── sql/
│   ├── demo_data_checks.sql   # SQL kiem tra du lieu demo
│   └── demo_data_seed.sql     # SQL seed du lieu demo
├── requirements.txt           # Python dependencies
└── README.md                  # Tai lieu AI-server
```

Khong dung `.venv` cua AI-server cho voice worker. Voice worker co virtual environment rieng o repo root: `.venv-whisper/`.

## Luong xu ly AI an toan

```text
User prompt
-> normalize tieng Viet/context nguoi dung
-> detect intent
-> neu hoi DB: chay fixed SQL theo whitelist
-> lay rows tu MySQL
-> model dien giai ket qua thanh cau tra loi tieng Viet
-> neu khong can DB: model tra loi tu nhien theo guardrail
```

## API chinh

### `POST /ask-db`

Dung cho hoi dap du lieu gia pha theo context account/person/clan.

Request mau:

```json
{
  "prompt": "Bố mẹ tôi là ai?",
  "account_id": 20,
  "person_id": 10,
  "clan_id": 3,
  "role": "member"
}
```

Response mau:

```json
{
  "success": true,
  "intent": "PARENTS",
  "prompt": "Bố mẹ tôi là ai?",
  "row_count": 1,
  "data": {
    "intent": "PARENTS",
    "rows": [],
    "row_count": 1
  },
  "answer": "Câu trả lời tiếng Việt dựa trên dữ liệu trong database."
}
```

## Cai dat

```powershell
cd D:\cap2\AI-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

## Chay server

```powershell
cd D:\cap2\AI-server
.\.venv\Scripts\Activate.ps1
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

## Bien moi truong

Ten bien phu thuoc `app.py`, nhung thuong gom:

```text
GROQ_API_KEY=...
DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
```

## Gioi han va quy tac

- Khong chay SQL do AI sinh truc tiep.
- Chi dung fixed SQL/whitelist theo intent.
- Chan cac cau lenh thay doi du lieu nhu `INSERT`, `UPDATE`, `DELETE`, `DROP`.
- Endpoint AI tao su kien/cong viec chi nen tra ve cau truc JSON hop le de frontend/backend xu ly tiep.
- Khong dung chung virtual environment voi voice worker.

## Kiem tra nhanh

```powershell
cd D:\cap2\AI-server
.\.venv\Scripts\python.exe -m py_compile app.py
python app.py
```
