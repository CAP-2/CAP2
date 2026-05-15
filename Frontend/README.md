# Frontend - Gia Pha Viet React/Vite

Frontend la ung dung React chay bang Vite. Source da duoc chia theo module de de tim khi sua tinh nang.

## Cau truc `src/`

```text
src/
├── app/                 # App.jsx, main.jsx, routes.jsx
├── api/                 # API client theo domain
├── layouts/             # AdminLayout, ManagerLayout, MemberLayout, PublicLayout
├── features/            # Code theo tung tinh nang nghiep vu
├── shared/              # Component/utils dung lai nhieu noi
├── i18n/                # Language context va static translations
├── services/            # apiRequest, socket, tree edit session
├── assets/              # Asset import trong source
└── index.css            # Global style
```

## `features/`

```text
features/
├── admin/               # Trang quan tri he thong
├── ai-chat/             # AI chat gateway/widget
├── auth/                # Login, Register, ForgotPassword, Waiting
├── billing-payment/     # Billing va payment UI
├── calendar/            # Lich Viet Nam / lich dong ho
├── clan/                # Dang ky dong ho
├── events-tasks/        # Su kien, task, AI tao task
├── fund/                # Quy dong ho
├── genealogy/           # Cay gia pha, editor, hooks, tree utils
├── manager/             # Dashboard, account, pending approvals
├── member/              # Member dashboard/profile/submissions
├── posts/               # Bai viet chung
├── public/              # Landing/detail public pages
├── time-capsule/        # Ky niem dong ho
└── voice/               # VoiceRecorder local STT
```

## `shared/`

```text
shared/
├── components/          # DateInput, LanguageToggle, ImageUpload, ProfileDrawer, ProtectedRoute
└── utils/               # auth, dateFormat, lunarCalendar, media
```

## Lenh chay

```powershell
cd D:\cap2\Frontend
npm install
npm run dev
```

Build production:

```powershell
cd D:\cap2\Frontend
npm run build
```

## Ghi chu

- Route trung tam nam o `src/app/routes.jsx`.
- Khi sua cay gia pha, xem `src/features/genealogy/`.
- Khi them component dung lai nhieu noi, dat trong `src/shared/components/`.
- Khi them API moi, uu tien them vao `src/api/*Service.js`.
