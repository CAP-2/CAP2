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
const voiceRoutes = require('../voice/backendRoutes');
const managerController = require('./src/controllers/managerController');
const mediaRoutes = require('./src/routes/mediaRoutes');
const {
    MAX_IMAGE_SIZE_BYTES,
    isAllowedImageMimeType,
    getMediaUrl,
    createMediaFile,
    getUploadContext,
} = require('./src/utils/media');
const { verifyToken, checkRole } = require('./src/middleware/authMiddleware');

// 5. Cấu hình upload ảnh: ảnh mới được lưu trực tiếp vào MySQL LONGBLOB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (!isAllowedImageMimeType(file.mimetype)) {
            return cb(new Error('Chỉ cho phép upload ảnh JPG, PNG, WEBP hoặc GIF'));
        }
        cb(null, true);
    }
});

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

app.post('/api/upload', verifyToken, (req, res) => {
    upload.single('image')(req, res, async (uploadError) => {
        if (uploadError) {
            const isMulterLimit = uploadError?.code === 'LIMIT_FILE_SIZE';
            return res.status(isMulterLimit ? 413 : 400).json({
                success: false,
                message: isMulterLimit ? 'Ảnh vượt quá dung lượng cho phép' : uploadError.message || 'File ảnh không hợp lệ'
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Không có file được chọn!' });
            }

            const accountId = req.user?.id || req.user?.account_id || null;
            const context = await getUploadContext(accountId);
            const usageType = req.body?.usage_type || req.body?.usageType || 'other';

            const mediaId = await createMediaFile({
                ownerAccountId: accountId,
                ownerPersonId: context.owner_person_id || context.ownerPersonId || req.user?.person_id || null,
                clanId: context.clan_id || context.clanId || null,
                usageType,
                originalFilename: req.file.originalname,
                mimeType: req.file.mimetype,
                fileSizeBytes: req.file.size,
                imageBuffer: req.file.buffer,
            });

            const imageUrl = getMediaUrl(req, mediaId);
            return res.json({ success: true, mediaId, media_id: mediaId, imageUrl, url: imageUrl });
        } catch (error) {
            console.error('Upload image to database error:', error);
            return res.status(500).json({
                success: false,
                message: 'Không thể lưu ảnh vào database'
            });
        }
    });
});

app.use('/api/media', mediaRoutes);

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
app.use('/api/voice', voiceRoutes);

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