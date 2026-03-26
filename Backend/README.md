Backend/
├── src/
│   ├── config/
│   │   └── db.js           # Chứa code kết nối MySQL (Pool)
│   ├── controllers/
│   │   ├── authController.js    # Logic đăng ký, đăng nhập
│   │   └── managerController.js # Logic phê duyệt, danh sách chờ
│   ├── middleware/
│   │   └── authMiddleware.js    # (Nên thêm) Kiểm tra JWT và Role
│   ├── routes/
│   │   ├── authRoutes.js        # Khai báo route đăng ký/nhập
│   │   └── managerRoutes.js     # Khai báo route phê duyệt
│   └── utils/
│       └── hashPassword.js      # Các hàm tiện ích bổ trợ
├── .env
└── server.js               # khởi chạy app