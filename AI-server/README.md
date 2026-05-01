# AI-server

Python Flask server dùng Groq và MySQL cho trợ lý Gia Phả Việt.

Luồng an toàn hiện tại:

```text
User hỏi
-> normalize tiếng Việt
-> detect intent
-> câu hỏi thường: Groq trả lời tự nhiên
-> câu hỏi cần database: fixed SQL whitelist -> MySQL -> Groq diễn giải dữ liệu thật
```

Server không để AI tự sinh SQL để chạy trực tiếp.

## Cai dat

```bash
cd AI-server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Chay server

```bash
cd AI-server
copy .env.example .env
python app.py
```

Mac dinh server chay tai `http://localhost:8001`.

## API

### `POST /ask-db`

```json
{
  "prompt": "Bố mẹ tôi là ai?",
  "account_id": 20,
  "person_id": 10,
  "clan_id": 3,
  "role": "member"
}
```

Response:

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

## Gioi han

- Chỉ dùng fixed SQL whitelist theo intent, không chạy SQL do AI sinh ra.
- Server chặn các lệnh SQL thay đổi dữ liệu như `INSERT`, `UPDATE`, `DELETE`, `DROP`.
- Câu hỏi không cần database sẽ được trả lời tự nhiên bằng Groq.
