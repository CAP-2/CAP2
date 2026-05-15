# Backend - Gia Pha Viet API

Backend la Node.js/Express server ket noi MySQL, quan ly auth, role, gia pha, member, manager, admin, media, task, event, notification, fund, billing, payment va Socket.IO realtime.

## Cau truc

```text
Backend/
├── server.js             # Entry Express + Socket.IO
├── src/
│   ├── config/           # DB, roles
│   ├── middleware/       # verifyToken, checkRole
│   ├── modules/          # API chia theo domain
│   ├── shared/           # Utils dung chung
│   └── socket/           # Realtime helpers
├── scripts/              # Script ho tro van hanh/migration
├── storage/              # File private, gom voice recordings
├── uploads/              # Upload legacy/local
└── package.json
```

## `src/modules/`

```text
modules/
├── admin/                # /api/admin
├── ai/                   # /api/ai
├── auth/                 # /api/auth
├── billing/              # /api/billing
├── calendar/             # /api/calendar
├── clan/                 # Clan registration/info controller
├── fund/                 # Quy dong ho
├── genealogy/            # Tree controller va relation/validation services
├── manager/              # /api/manager, dashboard, moderation, event/task
├── media/                # /api/media
├── member/               # /api/member
└── payment/              # /api/payments
```

## `src/shared/` va `src/socket/`

```text
shared/utils/
├── email.js
├── media.js
├── notifications.js
├── personDeletion.js
├── treeEditPermissions.js
└── treeLayoutSettings.js

socket/
└── treeRealtime.js
```

## Lenh chay

```powershell
cd D:\cap2\Backend
npm install
npm run dev
```

Production/local start:

```powershell
cd D:\cap2\Backend
npm start
```

## Route mount chinh

```text
/api/auth
/api/admin
/api/manager
/api/member
/api/media
/api/billing
/api/payments
/api/calendar
/api/ai
/api/voice
```

`/api/voice` duoc mount tu `../voice/backend/backendRoutes.js`.

## Kiem tra nhanh

```powershell
node --check server.js
node --check src/modules/member/member.controller.js
```
