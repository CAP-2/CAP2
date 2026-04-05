require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// 1. Khởi tạo APP trước tất cả mọi thứ
const app = express();

// 2. Cấu hình Middlewares toàn cục (Phải đặt trước Routes)
app.use(cors({
    origin: "http://localhost:5173", // URL của Vite Frontend
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Khởi tạo HTTP Server và Socket.io (Dùng biến app đã tạo ở trên)
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// 4. Import Route Controllers
const authRoutes = require('./src/routes/authRoutes');
const managerRoutes = require('./src/routes/managerRoutes');
const memberRoutes = require('./src/routes/memberRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

// 5. Cấu hình lưu trữ ảnh (Multer) - Chỉ cần 1 lần
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// 6. Logic Socket.io
let onlineUsers = {};

io.on('connection', (socket) => {
    socket.on('register_user', (userId) => {
        if (userId) {
            onlineUsers[userId] = socket.id;
            console.log(`📡 User ${userId} đã kết nối (Socket: ${socket.id})`);
        }
    });

    socket.on('send_task', (data) => {
        const { receiverId, title, senderName, dueDate } = data;
        const receiverSocketId = onlineUsers[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('new_notification', {
                message: `Bạn có việc mới: "${title}" từ ${senderName}`,
                dueDate: dueDate,
                time: new Date().toLocaleTimeString()
            });
            console.log(`✅ Đã bắn thông báo tới User ${receiverId}`);
        }
    });

    socket.on('disconnect', () => {
        for (let id in onlineUsers) {
            if (onlineUsers[id] === socket.id) {
                delete onlineUsers[id];
                break;
            }
        }
    });
});

// 7. Các Routes API
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Không có file được chọn!' });
    }
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl });
});

app.use('/api/auth', authRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/admin', adminRoutes);

// 8. Xử lý lỗi 404
app.use((req, res) => {
    res.status(404).json({ message: "Đường dẫn không tồn tại!" });
});

// 9. Khởi chạy Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    🚀 SERVER IS RUNNING (REAL-TIME READY)!
    📡 Port: ${PORT}
    🔗 URL: http://localhost:${PORT}
    ✨ Socket.io: Enabled
    `);
});