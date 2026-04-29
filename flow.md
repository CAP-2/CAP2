# Phan tich ky thuat he thong Gia Pha Viet

## A. Tom tat du an

Du an la he thong **Gia Pha Viet**: mot ung dung web so hoa viec quan ly dong ho, thanh vien, cay gia pha, bai viet cong dong, su kien/reminder, giao viec va hoi dap AI tren du lieu gia pha.

Source code thuc te cho thay he thong tap trung vao bai toan **gia pha so**, khong thay MongoDB, khong thay AIF-SM. Database thuc te la **MySQL**.

Nguoi dung chinh:

| Vai tro | Mo ta |
|---|---|
| Admin | Quan tri toan he thong, quan ly dong ho, tai khoan, thanh vien, su kien, gallery, thong ke |
| Manager | Truong ho/nguoi quan ly mot dong ho, duyet tai khoan, duyet bai viet, duyet cap nhat profile, quan ly thanh vien va cay gia pha |
| Member | Thanh vien dong ho, xem cay gia pha, cap nhat ho so, gui bai viet, xem bai cong dong, chat AI, nhan task/thong bao |

Module lon trong source:

- Frontend React/Vite: `Frontend/src`
- Backend Express/Socket.IO: `Backend/server.js`
- Auth/JWT/RBAC: `Backend/src/controllers/authController.js`, `Backend/src/middleware/authMiddleware.js`
- Admin/Manager/Member API: `adminController.js`, `managerController.js`, `memberController.js`
- AI service Flask/Groq/MySQL: `AI-server/app.py`
- Database schema: `docker/init.sql`, `defaultdb.sql`

## B. Cong nghe su dung

| Nhom | Cong nghe | Source thuc te | Vai tro | Ghi chu production |
|---|---|---|---|---|
| Frontend | React 18, Vite | `Frontend/package.json`, `src/routes/index.jsx` | SPA public/admin/manager/member | Build OK, nhung `reactflow` va `socket.io-client` duoc import nhung khong khai bao trong `Frontend/package.json` |
| Routing | react-router-dom | `src/routes/index.jsx` | Dieu huong va protected route theo role | Bao mat that van phai nam o backend |
| Tree UI | Custom tree editor, react-zoom-pan-pinch, html-to-image, ReactFlow file | `FamilyTreeEditor.jsx`, `FamilyTreeFlow*.jsx` | Hien thi, zoom/pan, keo node, xuat anh cay | Can test voi cay lon |
| Backend | Node.js, Express 5 | `Backend/server.js` | REST API chinh | Can centralized error handling |
| Database driver | mysql2 promise pool | `Backend/src/config/db.js` | Ket noi MySQL/Aiven | Co ho tro SSL/Public DNS |
| Auth | bcryptjs, jsonwebtoken | `authController.js`, `authMiddleware.js` | Hash password, JWT 24h, RBAC | JWT secret co fallback hardcode |
| Upload | multer + static `/uploads` | `Backend/server.js` | Upload anh/file | `/api/upload` chua bat buoc JWT, chua validate MIME/size |
| Realtime | Socket.IO | `Backend/server.js`, `Frontend/src/utils/socket.js` | Emit thong bao realtime | Khong phai chat realtime user-user |
| Email | nodemailer | `authController.js` | Gui OTP reset password | Phu thuoc SMTP env, bang token thieu trong schema |
| AI | Flask, Groq, mysql-connector-python | `AI-server/app.py` | Hoi dap du lieu gia pha bang intent/query | Flow chinh dung whitelist query, khong co RAG/OCR/vision |
| Docker | docker compose | `docker/docker-compose.yml` | Hien chi co phpMyAdmin | README noi chay MySQL bang Docker, nhung compose chua co service MySQL |

## C. Danh sach chuc nang

### 1. Auth

API:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/register-clan`
- `POST /api/auth/register-clan-manager`

Flow dang ky:

1. Frontend gui email, password, thong tin ca nhan, `clan_id`.
2. Backend hash password bang bcrypt.
3. Insert vao `people`.
4. Insert vao `accounts` voi `role_id = 3`, `status = pending`.
5. Tra response thanh cong.

Bang DB:

- `accounts`
- `people`
- `clans` neu dang ky dong ho

Rui ro:

- Dang ky khong dung transaction. Neu insert `people` thanh cong nhung insert `accounts` loi, co the tao ban ghi person mo coi.
- Password reset dung bang `password_reset_tokens`, nhung bang nay khong co trong `docker/init.sql`.
- JWT secret co fallback hardcode.

### 2. Admin

API:

- `GET /api/admin/clans`
- `GET /api/admin/clans/:clanId/tree`
- `GET /api/admin/accounts`
- `PUT /api/admin/accounts/:id`
- `POST /api/admin/managers`
- `GET/PUT/DELETE /api/admin/members`
- `GET/POST /api/admin/settings`
- `GET/POST/PUT/DELETE /api/admin/events`
- `GET/DELETE /api/admin/gallery`
- `GET /api/admin/dashboard-stats`
- `GET /api/admin/posts/clan/:clanId`

Chuc nang:

- Quan ly dong ho.
- Xem cay cua tung dong ho.
- Quan ly tai khoan, gan role, gan clan.
- Tao tai khoan manager.
- Quan ly thanh vien, su kien, gallery, bai viet, thong ke.

Bang DB:

- `clans`, `accounts`, `people`, `events`, `posts`
- `system_settings` duoc code dung nhung chua co trong schema.

Rui ro:

- API settings se loi neu DB chua tao bang `system_settings`.
- Xoa member co cascade sang nhieu bang, can can than voi du lieu production.

### 3. Manager

API:

- `GET /api/manager/stats`
- `GET /api/manager/members`
- `POST /api/manager/members`
- `GET/PUT /api/manager/members/:id`
- `POST /api/manager/members/:id/archive`
- `GET/POST/DELETE /api/manager/members-archive`
- `GET /api/manager/pending`
- `POST /api/manager/approve/:id`
- `POST /api/manager/reject/:id`
- `GET /api/manager/pending-posts`
- `POST /api/manager/approve-post/:id`
- `POST /api/manager/reject-post/:id`
- `GET /api/manager/pending-profiles`
- `POST /api/manager/approve-profile/:id`
- `POST /api/manager/reject-profile/:id`
- `POST /api/manager/assign-task`
- `GET /api/manager/tasks`
- `PATCH /api/manager/tasks/:id/complete`

Chuc nang:

- Duyet/tuchoi tai khoan member pending.
- Quan ly member trong cung dong ho.
- Tao member active truc tiep.
- Luu tru/phuc hoi/xoa vinh vien member.
- Duyet bai viet va cap nhat profile.
- Quan ly media tu cac post co image.
- Giao viec cho member va tao notification.

Bang DB:

- `accounts`, `people`, `posts`, `archived_members`
- `manager_tasks`, `manager_task_assignments` duoc tao runtime, khong co trong `docker/init.sql`.
- `notifications`

Rui ro:

- Mot so bang runtime khong nam trong migration chuan.
- Archive chi ghi JSON vao `archived_members`, khong doi `accounts.status`; login check archive rieng.

### 4. Member

API:

- `GET /api/member/dashboard`
- `PUT /api/member/profile`
- `PUT /api/member/password`
- `POST /api/member/tree-edit-session`
- `GET/POST /api/member/chat`
- `POST /api/member/reminders`
- `GET /api/member/tasks`
- `PATCH /api/member/tasks/:id/status`
- `POST /api/member/content/profile`
- `POST /api/member/content/post`
- `GET /api/member/posts/general`
- `GET/POST /api/member/posts/:id/comments`
- `POST /api/member/posts/:id/like`
- `GET /api/member/submissions`

Chuc nang:

- Xem dashboard ca nhan, thong tin clan, cay gia pha.
- Cap nhat profile co ban.
- Doi mat khau.
- Chat voi AI.
- Tao reminder/su kien.
- Xem task duoc giao va cap nhat trang thai.
- Gui bai viet/post va yeu cau cap nhat bio/avatar.
- Like/comment bai viet approved.

Bang DB:

- `people`, `accounts`, `clans`, `families`, `children`
- `conversations`, `messages`
- `posts`, `post_comments`, `post_likes`
- `events`
- `manager_task_assignments`, `notifications`

Rui ro:

- `NotificationBell.jsx` goi `/api/member/notifications`, `/read`, `/read-all`, nhung backend routes hien tai chua khai bao cac endpoint nay.
- Member profile khong cho sua quan he gia dinh truc tiep, phai dung temporary edit key trong cay gia pha.

### 5. Gia pha/cay pha he

API:

- `GET /api/manager/tree`
- `GET /api/clans/:clanId/family-tree`
- `POST /api/people` hoac `/api/manager/people`
- `PATCH /api/people/:id`
- `PATCH /api/people/:id/position`
- `PATCH /api/people/layout`
- `PATCH /api/people/link`
- `POST /api/families`
- `POST /api/families/:familyId/children`
- `DELETE /api/people/:id`

Bang DB:

- `people`: thong tin tung nguoi, doi/generation, chi/branch, toa do cay `tree_x/tree_y`.
- `families`: cap cha/me trong mot dong ho.
- `children`: quan he con cua mot family.

Flow:

1. Frontend lay danh sach `people`, `families`, `children`.
2. Backend build `familyTree.roots`.
3. Frontend render node va duong noi.
4. Khi keo node, frontend PATCH vi tri.
5. Khi them/sua quan he, backend validate cung clan roi update `families/children`.

Rui ro:

- Chua co validate vong lap pha he.
- `families.father_id/mother_id` khong co FK trong `docker/init.sql`.
- Logic hon nhan/con cai replace danh sach con co the lam mat lien ket cu neu client gui thieu.

### 6. Bai viet cong dong

API:

- Member gui: `POST /api/member/content/post`
- Lay post approved: `GET /api/member/posts/general`
- Comment: `GET/POST /api/member/posts/:id/comments`
- Like: `POST /api/member/posts/:id/like`
- Manager duyet: `/api/manager/pending-posts`, `/approve-post/:id`, `/reject-post/:id`

Bang DB:

- `posts`
- `post_comments`
- `post_likes`

Logic:

- Member tao bai: `status = pending`.
- Manager/admin tao bai: `status = approved`.
- Chi post `approved` moi hien thi cong khai trong clan.

### 7. Chat/notification/task

Chat AI:

- `GET /api/member/chat`
- `POST /api/member/chat`
- Luu vao `conversations`, `messages`.
- Backend goi AI-server `/ask-db`.

Notification/task:

- Manager giao viec tao `manager_tasks`, `manager_task_assignments`.
- Insert `notifications`.
- Neu user online, Socket.IO emit `new_notification`.

Rui ro:

- Khong co chat realtime giua users.
- Notification API list/read/read-all dang thieu route.

### 8. AI

Source:

- Backend proxy/member chat: `memberController.js`, `aiController.js`
- AI service: `AI-server/app.py`

Flow:

1. User nhap cau hoi tieng Viet.
2. Backend gui prompt + `account_id`, `person_id`, `clan_id`, `role`.
3. Flask normalize tieng Viet, detect intent.
4. Check permission theo role.
5. Chon SQL whitelist trong `fixed_query`.
6. Query MySQL bang parameterized query.
7. Tao cau tra loi tieng Viet.
8. Backend luu message AI vao `messages`.

Khong co:

- RAG/vector database.
- OCR.
- Vision/image understanding.
- Chat user-user bang AI.

Ghi chu lech tai lieu/source:

- `AI-server/README.md` noi "sinh SQL read-only".
- Source hien tai co ham `ai_sql()` dung Groq de sinh SQL, nhung endpoint `/ask-db` dang dung `detect_intent` + `fixed_query`, khong goi `ai_sql()` trong flow chinh.

## D. Thuat toan/logic chinh

### 1. Role-based access control

Input:

- JWT trong header `Authorization: Bearer <token>`.
- Payload co `role_id`, `role_name`.

Xu ly:

1. `verifyToken` verify JWT bang `JWT_SECRET`.
2. Gan decoded payload vao `req.user`.
3. `checkRole([...])` so `req.user.role_name` voi danh sach role duoc phep.

Output:

- Hop le: cho request di tiep.
- Thieu token: 401.
- Sai role/token loi: 403.

Han che:

- Role/status khong duoc reload tu DB moi request.
- Neu role bi ha trong DB, token cu van con hieu luc den khi het han.

### 2. JWT authentication

Input:

- Email, password.

Xu ly:

1. Normalize email lower/trim.
2. Query `accounts` join `people`.
3. Check archived member.
4. Bcrypt compare password.
5. Check `pending/rejected`.
6. Sign JWT 24h.

Output:

- Token + user info.

Loi:

- Sai email/password: 401.
- Pending/rejected/archive: 403.
- DB loi: 500.

### 3. Quan he gia pha

Input:

- `person_id`, `father_id`, `mother_id`, `spouse_id`, `children_ids`, `clan_id`.

Xu ly huyet thong:

1. Kiem tra co it nhat cha hoac me.
2. Khong cho person lam cha/me cua chinh minh.
3. Check cha/me cung clan.
4. Xoa record `children` cu cua person.
5. Tim family co cung father/mother, neu chua co thi insert `families`.
6. Insert `children(family_id, person_id)`.

Output:

- Tao/cap nhat lien ket cha me cho person.

Han che:

- Chua check cycle ong/cha/con.
- Chua check cha/mother gender bang constraint DB.

### 4. Dung cay gia pha

Input:

- Danh sach `people`, `families`, `children`.

Xu ly:

1. Tao map `peopleMap`.
2. Gom children theo `family_id`.
3. Chon parent chinh uu tien `father_id`, neu khong co thi `mother_id`.
4. Map parent -> list child.
5. Map spouse theo family.
6. Chon root la doi 1 hoac doi nho nhat.
7. DFS de tao node `{ person, spouse, children }`.

Output:

- `familyTree = { roots: [...] }`.

Do phuc tap:

- Gan O(P + F + C), tuy mot so thao tac `find/includes` co the lam cham voi du lieu lon.

### 5. Luu vi tri node

Input:

- `person_id`, `tree_x`, `tree_y`, `display_order`.

Xu ly:

1. Check role/key.
2. Check person cung clan manager.
3. Update `people.tree_x/tree_y/display_order`.

Output:

- Vi tri node duoc luu trong DB.

### 6. Duyet account/post/profile

Input:

- `account_id`, `post_id`, `person_id`, optional reason.

Xu ly:

- Account approve: update `accounts.status='active'`, `role_id=3`.
- Account reject: update `accounts.status='rejected'`.
- Post approve: update `posts.status='approved'`.
- Post reject: update `posts.status='rejected'`, luu `rejection_reason`.
- Profile approve: copy `pending_bio/avatar` sang `bio/avatar_url`.
- Profile reject: set `moderation_status='rejected'`, luu reason.

Output:

- Trang thai duyet cap nhat trong DB.

### 7. AI hoi dap database

Input:

- Prompt tieng Viet + context user.

Xu ly:

1. Normalize tieng Viet khong dau.
2. Detect intent: parents, children, spouse, tree, count, posts, events...
3. Check role permission.
4. Chon SQL whitelist.
5. Add limit.
6. Check `safe_sql` chi SELECT.
7. Execute query.
8. Shape data va tao answer deterministic.

Output:

- JSON co `intent`, `confidence`, `sql`, `params`, `data`, `answer`.

Han che:

- Chi tra loi cac intent co san.
- Khong co semantic search/RAG.
- Neu mo lai LLM-generated SQL thi phai dung DB user read-only va SQL parser chat che hon regex.

## E. Flow he thong

### Flow 1: Dang ky tai khoan

User -> Frontend Register -> `POST /api/auth/register` -> Validate co ban -> Hash password -> Insert `people` -> Insert `accounts(status=pending, role_id=3)` -> Response.

### Flow 2: Dang nhap

User -> Login page -> `POST /api/auth/login` -> Query account/person -> Check archived/status -> Bcrypt compare -> Generate JWT -> Frontend luu localStorage -> Redirect theo role.

### Flow 3: Manager duyet tai khoan member

Manager -> Pending approvals -> `GET /api/manager/pending` -> Backend loc pending cung clan -> Manager approve/reject -> Update `accounts.status` -> Response.

### Flow 4: Them nguoi vao gia pha

Manager -> Form them nguoi -> `POST /api/manager/people` -> Check role/clan -> Insert `people` -> Neu co cha/me thi tao/tim `families` va insert `children` -> Refresh tree.

### Flow 5: Tao quan he gia dinh

Manager -> Chon cha/me/vo chong/con -> `PATCH /api/manager/people/link` hoac relation API -> Validate person cung clan -> Update `families`/`children` -> Frontend tai lai cay.

### Flow 6: Hien thi cay gia pha

Frontend -> `GET /api/member/dashboard` hoac `GET /api/manager/tree` -> Backend query `people/families/children` -> Build graph/tree data -> Frontend render node + line + layout.

### Flow 7: Tao bai viet cong dong

Member -> Submit post -> `POST /api/member/content/post` -> Insert `posts(status=pending)` -> Manager xem pending -> Approve -> `status=approved` -> Member khac thay trong `/posts/general`.

### Flow 8: Task/notification

Manager -> Assign task -> `POST /api/manager/assign-task` -> Insert task + assignments -> Insert notifications -> Socket.IO emit `new_notification` neu member online -> Member xem/cap nhat task.

### Flow 9: AI hoi dap gia pha

User -> Chat UI -> `POST /api/member/chat` -> Luu user message -> Backend goi AI-server `/ask-db` -> AI detect intent + query DB -> Tra answer -> Backend luu AI message -> Response ve frontend.

## F. Database design

Bang chinh:

| Bang | Muc dich |
|---|---|
| `roles` | Danh muc role admin/manager/member |
| `accounts` | Tai khoan dang nhap, password hash, role, status |
| `people` | Ho so thanh vien gia pha |
| `clans` | Dong ho |
| `account_clans` | Gan account vao clan, ho tro nhieu clan |
| `families` | Cap cha/me trong mot clan |
| `children` | Quan he con cua family |
| `posts` | Bai viet/cong dong/media |
| `post_comments` | Binh luan bai viet |
| `post_likes` | Like bai viet |
| `events` | Su kien/reminder |
| `event_contributions` | Dong gop su kien |
| `event_costs` | Chi phi su kien |
| `conversations` | Cuoc hoi thoai AI |
| `messages` | Tin nhan user/AI |
| `notifications` | Thong bao cho person |
| `manager_announcements` | Thong bao cua manager |
| `archived_members` | Kho luu tru member bi archive |

Bang/cot co trong code nhung schema chua dong bo:

- `manager_tasks`
- `manager_task_assignments`
- `member_tree_edit_keys`
- `password_reset_tokens`
- `system_settings`

Quan he quan trong:

- `accounts.person_id -> people.id`
- `accounts.role_id -> roles.id`
- `people.clan_id -> clans.id`
- `children.family_id -> families.id`
- `children.person_id -> people.id`
- `posts.clan_id -> clans.id`
- `post_comments.post_id -> posts.id`
- `post_likes.post_id -> posts.id`
- `notifications.receiver_person_id -> people.id`

Uu diem:

- Mo hinh `people/families/children` phu hop bai toan pha he.
- Co index email, display_name, phone/email people.
- Co unique like theo `(post_id, person_id)`.

Diem yeu:

- `families.father_id/mother_id` khong co FK trong `docker/init.sql`.
- Mot so bang runtime khong co migration chuan.
- Cascade delete tren clan/person co the xoa du lieu lon neu thao tac nham.
- Thieu constraint validate gender/quan he vong lap.

## G. Kien truc trien khai

```text
React/Vite Frontend
    ↓ REST API / Socket.IO
Node.js Express Backend
    ↓ mysql2 pool
MySQL Database

Backend /api/member/chat hoặc /api/ai/public-chat
    ↓ HTTP
Python Flask AI-server
    ↓ mysql-connector pool
MySQL Database
    ↓ optional
Groq API
```

Docker hien tai:

- `docker/docker-compose.yml` chi co `phpmyadmin`.
- Chua co service MySQL.
- Chua co service Backend/Frontend/AI-server.
- README noi chay DB bang Docker, nhung compose hien tai chua dap ung.

## H. Rui ro ky thuat

P0:

- JWT secret fallback hardcode.
- `/api/upload` khong bat buoc auth va khong validate file.
- Token luu localStorage, rui ro XSS.
- Role/status trong JWT khong reload tu DB moi request.
- Dang ky khong transaction.
- Schema/migration chua dong bo.
- Docker compose khong dung nhu README mo ta.
- AI can dam bao chi SELECT va dung DB user read-only.

P1:

- NotificationBell goi API chua ton tai.
- Frontend dependency manifest thieu `reactflow`, `socket.io-client`.
- Thieu test, CI/CD, rate limiting.
- Upload local disk khong phu hop scale.
- Nhieu chuoi tieng Viet bi loi encoding mojibake.

P2:

- Chua co cache cho tree lon.
- Chua co queue email/notification.
- Chua co monitoring/observability.
- Chua co CDN/media storage.

## I. De xuat cai thien

### P0 - Bat buoc truoc deploy

- Bo fallback JWT secret, bat buoc set `JWT_SECRET`.
- Them auth, file size limit, MIME validation cho `/api/upload`.
- Chuan hoa migration, dong bo schema DB.
- Tao bang `system_settings`, `password_reset_tokens`, `manager_tasks`, `manager_task_assignments`, `member_tree_edit_keys`.
- Dung transaction cho register/create member/create person + relation.
- Tao DB user read-only rieng cho AI.
- Hoan thien docker compose gom MySQL, Backend, Frontend, AI-server.

### P1 - Nen lam

- Unit/integration test cho auth, RBAC, relation, approval, AI intent.
- API documentation OpenAPI/Swagger.
- Rate limiting cho login, forgot password, AI, upload.
- Centralized error handler va structured logging.
- CI GitHub Actions build/test/lint.
- Bo sung notification list/read/read-all API hoac sua frontend.

### P2 - Cai thien sau

- S3/Cloudinary/CDN cho media.
- Queue job cho email/notification.
- Cache cay gia pha.
- Monitoring dashboard, metrics, slow query log.
- Scale AI service rieng.

## J. Ban viet ngan gon dua vao bao cao Word

Gia Pha Viet la he thong web so hoa quan ly dong ho va cay gia pha. He thong ho tro ba vai tro: Admin quan tri toan bo he thong, Manager quan ly mot dong ho, va Member su dung cong thanh vien. Cac chuc nang chinh gom dang ky/dang nhap bang JWT, duyet tai khoan, quan ly thanh vien, quan ly cay gia pha, bai viet cong dong, like/comment, cap nhat ho so co kiem duyet, su kien/reminder, giao viec, thong bao va hoi dap AI tren du lieu gia pha.

Kien truc he thong gom Frontend React/Vite, Backend Node.js/Express, MySQL database, Socket.IO cho thong bao realtime, Multer cho upload anh va AI-server Python Flask dung Groq/MySQL. Du lieu gia pha duoc mo hinh hoa bang ba bang chinh: `people` luu tung nguoi, `families` luu cap cha/me, va `children` luu quan he con. Backend dung cac bang nay de tao cau truc cay, sau do frontend render thanh node va duong noi.

He thong co nen tang chuc nang kha day du nhung chua san sang production. Cac rui ro chinh gom JWT secret fallback hardcode, upload chua bao ve, schema/migration chua chuan, Docker compose chua co MySQL, mot so API frontend goi chua ton tai, thieu test/CI/CD/rate limit va cau hinh deploy con hardcode localhost. Truoc khi trien khai that can chuan hoa env, migration, bao mat upload/JWT/RBAC, bo sung logging, backup database va khoa AI o che do truy van SELECT an toan.
