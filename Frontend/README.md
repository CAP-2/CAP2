# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

Frontend/
├── public/              # Chứa các file tĩnh (logo, favicon)
├── src/
│   ├── assets/          # Hình ảnh, font, icon hệ thống
│   ├── components/
│   │   ├── common/      # Button, Input, Modal dùng chung
│   │   └── layouts/     # AdminLayout.jsx, UserLayout.jsx (Khung giao diện)
│   ├── pages/
│   │   ├── admin/       # Giao diện Quản trị viên
│   │   ├── manager/     # Giao diện Người quản lý dòng họ
│   │   ├── user/        # Giao diện Thành viên xem cây
│   │   └── shared/      # Login.jsx, NotFound.jsx, Home.jsx
│   ├── routes/          # Cấu hình điều hướng (React Router)
│   ├── services/        # Các file gọi API (Axios instance)
│   ├── utils/           # Hàm bổ trợ (Format date, check quyền)
│   ├── App.jsx          # Component gốc (Nơi đặt Router chính)
│   ├── main.jsx         # Điểm khởi đầu của ứng dụng (Render vào DOM)
│   ├── App.css          # CSS toàn cục cho App
│   └── index.css        # CSS căn bản (Reset CSS, Tailwind nếu có)
├── .gitignore           # Loại bỏ node_modules khi đẩy lên Git Desktop
├── package.json         # Quản lý thư viện
└── vite.config.js       # Cấu hình dự án Vite