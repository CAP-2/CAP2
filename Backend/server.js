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
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS không cho phép origin này: ' + origin));
    },
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Khởi tạo HTTP Server và Socket.io (Dùng biến app đã tạo ở trên)
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});
app.locals.io = io;
app.locals.onlineUsers = {};

// 4. Import Route Controllers
const authRoutes = require('./src/routes/authRoutes');
const managerRoutes = require('./src/routes/managerRoutes');
const memberRoutes = require('./src/routes/memberRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const managerController = require('./src/controllers/managerController');
const { verifyToken, checkRole } = require('./src/middleware/authMiddleware');

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
io.on('connection', (socket) => {
    socket.on('register_user', (userId) => {
        if (userId) {
            app.locals.onlineUsers[userId] = socket.id;
            console.log(`📡 User ${userId} đã kết nối (Socket: ${socket.id})`);
        }
    });

    socket.on('send_task', (data) => {
        const { receiverId, title, senderName, dueDate } = data;
        const receiverSocketId = app.locals.onlineUsers[receiverId];
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
        for (let id in app.locals.onlineUsers) {
            if (app.locals.onlineUsers[id] === socket.id) {
                delete app.locals.onlineUsers[id];
                break;
            }
        }
    });
});

// 7. Các Routes API

app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Backend is running' });
});
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Không có file được chọn!' });
    }
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl });
});

app.use('/api/auth', authRoutes);
app.get('/api/clans/:clanId/family-tree', verifyToken, checkRole(['admin', 'manager']), managerController.getFamilyTree);
app.patch('/api/clans/:clanId/family-tree/layout', verifyToken, checkRole(['admin', 'manager']), managerController.saveTreeLayout);
app.post('/api/people', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.createPerson);
app.patch('/api/people/layout', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.saveTreeLayout);
app.patch('/api/people/link', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.linkRelations);
app.patch('/api/people/:id/position', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.updatePersonPosition);
app.patch('/api/people/:id', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.updateTreePerson);
app.delete('/api/people/:id', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.deleteTreePerson);
app.post('/api/families', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.createFamily);
app.post('/api/families/:familyId/children', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.addFamilyChild);
app.use('/api/manager', managerRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

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
