# AI-server

Python server dung Groq de nhan `prompt`, sinh SQL read-only, query MySQL truc tiep, roi tom tat ket qua bang tieng Viet.

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
  "prompt": "Cho toi 5 thanh vien moi tao gan day"
}
```

Response:

```json
{
  "success": true,
  "prompt": "Cho toi 5 thanh vien moi tao gan day",
  "sql": "SELECT ...",
  "row_count": 5,
  "data": [],
  "answer": "Tom tat ket qua bang tieng Viet"
}
```

## Gioi han

- Server chan cac lenh SQL thay doi du lieu nhu `INSERT`, `UPDATE`, `DELETE`, `DROP`.
- Luong hien tai phu hop cho doc du lieu. Neu ban muon cho phep ghi du lieu, can them co che whitelist va xac nhan thao tac.
