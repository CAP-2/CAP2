# CAP2 - Gia Pha Viet

Repo gom Frontend React/Vite, Backend Express, AI-server Flask, voice/local STT, database SQL va tai lieu du an.

## Cau truc tong quan

```text
cap2/
├── Backend/              # Express API, Socket.IO, MySQL
├── Frontend/             # React/Vite UI
├── AI-server/            # Flask AI service
├── voice/                # Local speech-to-text worker + /api/voice router
├── database/             # Schema, migrations, seed, dumps
├── docs/                 # Tai lieu overview/report
├── scripts/              # Script ho tro dev/van hanh
└── README.md
```

## Frontend

```text
Frontend/src/
├── app/                  # App.jsx, main.jsx, routes.jsx
├── api/                  # API client
├── layouts/              # Admin/Manager/Member/Public layouts
├── features/             # Chia theo tinh nang nghiep vu
├── shared/               # Component/utils dung chung
├── i18n/                 # VI/EN language context
├── services/             # apiRequest, socket, tree edit session
└── assets/
```

Chi tiet: `Frontend/README.md`.

## Backend

```text
Backend/src/
├── config/
├── middleware/
├── modules/              # auth, admin, manager, genealogy, member, fund...
├── shared/
└── socket/
```

Chi tiet: `Backend/README.md`.

## AI-server

```text
AI-server/
├── app.py
├── requirements.txt
├── tests/
├── sql/
└── README.md
```

## Voice

```text
voice/
├── backend/backendRoutes.js
├── worker/worker.py
├── schema/voice.schema.sql
├── requirements.txt
└── README.md
```

## Database

```text
database/
├── schema/
├── migrations/
├── seed/
└── dumps/
```

## Lenh chay nhanh

Frontend:

```powershell
cd D:\cap2\Frontend
npm install
npm run dev
```

Backend:

```powershell
cd D:\cap2\Backend
npm install
npm run dev
```

AI-server:

```powershell
cd D:\cap2\AI-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Voice worker:

```powershell
cd D:\cap2
.\scripts\run_voice_worker.ps1
```

## Kiem tra

```powershell
cd D:\cap2\Frontend
npm run build
```

```powershell
cd D:\cap2
node --check Backend\server.js
python -c "import pathlib; [compile(pathlib.Path(f).read_text(encoding='utf-8'), f, 'exec') for f in ['AI-server/app.py','voice/worker/worker.py']]"
```
