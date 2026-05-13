require('dotenv').config();

const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./src/config/db');

const app = express();

// 1. Cấu hình middleware toàn cục
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. Khởi tạo HTTP server + Socket.IO
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

// 3. Import routes/controllers sau khi app đã có middleware
const authRoutes = require('./src/routes/authRoutes');
const billingRoutes = require('./src/routes/billingRoutes');
const managerRoutes = require('./src/routes/managerRoutes');
const memberRoutes = require('./src/routes/memberRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const voiceRoutes = require('../voice/backendRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');
const calendarRoutes = require('./src/routes/calendarRoutes');
const { startCalendarReminderScheduler } = require('./src/controllers/calendarController');

const managerController = require('./src/controllers/managerController');

const {
    MAX_IMAGE_SIZE_BYTES,
    MAX_POST_MEDIA_SIZE_BYTES,
    isAllowedImageMimeType,
    isAllowedPostMediaMimeType,
    getMediaUrl,
    createMediaFile,
    getUploadContext,
} = require('./src/utils/media');

const { verifyToken, checkRole } = require('./src/middleware/authMiddleware');

// 4. Cấu hình upload media: ảnh/video bài đăng được lưu trực tiếp vào MySQL LONGBLOB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_POST_MEDIA_SIZE_BYTES || MAX_IMAGE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (!isAllowedPostMediaMimeType(file.mimetype)) {
            return cb(new Error('Chỉ cho phép upload ảnh JPG, PNG, WEBP, GIF hoặc video MP4, WEBM, MOV'));
        }
        cb(null, true);
    }
});

// 4.1. Đăng ký route thanh toán VNPAY
const paymentRoutes = require('./src/routes/paymentRoutes');
// 5. Socket.IO
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

        socket.on('register_user', async (userId) => {
            try {
                if (!userId) {
                    return;
                }

                app.locals.onlineUsers[userId] = socket.id;

                // Join room theo account id
                socket.join(`account_${userId}`);

                console.log(`📡 User ${userId} đã kết nối (Socket: ${socket.id})`);
                console.log(`📡 User ${userId} joined room account_${userId}`);

                // Join thêm room theo clan để realtime cây gia phả cho cả dòng họ
                const [rows] = await db.query(
                    `
                    SELECT COALESCE(p.clan_id, ac.clan_id) AS clan_id
                    FROM accounts a
                    LEFT JOIN account_clans ac
                        ON ac.account_id = a.id
                    AND ac.status = 'active'
                    LEFT JOIN people p
                        ON p.id = COALESCE(a.person_id, ac.person_id)
                    WHERE a.id = ?
                    LIMIT 1
                    `,
                    [userId]
                );

                const clanId = rows[0]?.clan_id;

                if (clanId) {
                    socket.join(`clan_${clanId}`);
                    console.log(`🌳 User ${userId} joined room clan_${clanId}`);
                } else {
                    console.log(`⚠️ User ${userId} chưa có clan_id nên chưa join room clan`);
                }
            } catch (error) {
                console.error('register_user error:', error);
            }
        });

    socket.on('send_task', (data) => {
        const { receiverId, title, senderName, dueDate } = data;
        const receiverSocketId = app.locals.onlineUsers[receiverId];

        if (receiverSocketId) {
            io.to(receiverSocketId).emit('new_notification', {
                message: `Bạn có việc mới: "${title}" từ ${senderName}`,
                dueDate,
                time: new Date().toLocaleTimeString()
            });

            console.log(`✅ Đã bắn thông báo tới User ${receiverId}`);
        }
    });

    socket.on('disconnect', () => {
        for (const id in app.locals.onlineUsers) {
            if (app.locals.onlineUsers[id] === socket.id) {
                delete app.locals.onlineUsers[id];
                break;
            }
        }
    });
});

// 6. Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Backend is running'
    });
});

// 7. Upload API
app.post('/api/upload', verifyToken, (req, res) => {
    upload.single('image')(req, res, async (uploadError) => {
        if (uploadError) {
            const isMulterLimit = uploadError?.code === 'LIMIT_FILE_SIZE';

            return res.status(isMulterLimit ? 413 : 400).json({
                success: false,
                message: isMulterLimit
                    ? 'Tệp vượt quá dung lượng cho phép'
                    : uploadError.message || 'File media không hợp lệ'
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Không có file được chọn!'
                });
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

            return res.json({
                success: true,
                mediaId,
                media_id: mediaId,
                imageUrl,
                url: imageUrl,
                mimeType: req.file.mimetype,
                mime_type: req.file.mimetype
            });
        } catch (error) {
            console.error('Upload media to database error:', error);

            return res.status(500).json({
                success: false,
                message: 'Không thể lưu media vào database'
            });
        }
    });
});



// 7.1 Upload API for family memories: image, video, audio are stored in MySQL media_files
const memoryMediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Number(process.env.MAX_MEMORY_MEDIA_UPLOAD_BYTES || 50 * 1024 * 1024) },
    fileFilter: (req, file, cb) => {
        const mime = String(file.mimetype || '').toLowerCase();
        if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) {
            return cb(null, true);
        }
        return cb(new Error('Chỉ cho phép tải ảnh, video hoặc ghi âm'));
    }
});

app.post('/api/upload-memory-media', verifyToken, (req, res) => {
    memoryMediaUpload.single('file')(req, res, async (uploadError) => {
        if (uploadError) {
            const isMulterLimit = uploadError?.code === 'LIMIT_FILE_SIZE';
            return res.status(isMulterLimit ? 413 : 400).json({
                success: false,
                message: isMulterLimit ? 'Tệp vượt quá dung lượng cho phép' : uploadError.message || 'Tệp không hợp lệ'
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Không có tệp được chọn' });
            }

            const accountId = req.user?.id || req.user?.account_id || null;
            const context = await getUploadContext(accountId);
            const mediaId = await createMediaFile({
                ownerAccountId: accountId,
                ownerPersonId: context.owner_person_id || context.ownerPersonId || req.user?.person_id || null,
                clanId: context.clan_id || context.clanId || null,
                usageType: 'other',
                originalFilename: req.file.originalname,
                mimeType: req.file.mimetype,
                fileSizeBytes: req.file.size,
                imageBuffer: req.file.buffer,
            });
            const url = getMediaUrl(req, mediaId);
            return res.json({
                success: true,
                mediaId,
                media_id: mediaId,
                url,
                mediaUrl: url,
                mimeType: req.file.mimetype,
                originalFilename: req.file.originalname,
            });
        } catch (error) {
            console.error('Upload memory media error:', error);
            return res.status(500).json({ success: false, message: 'Không thể lưu tệp vào database' });
        }
    });
});

// 8. Main API routes
app.use('/api/media', mediaRoutes);
app.use('/api/calendar', calendarRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentRoutes);

app.get(
    '/api/clans/:clanId/family-tree',
    verifyToken,
    checkRole(['admin', 'manager']),
    managerController.getFamilyTree
);

app.patch(
    '/api/clans/:clanId/family-tree/layout',
    verifyToken,
    checkRole(['admin', 'manager']),
    managerController.saveTreeLayout
);

app.post(
    '/api/people',
    verifyToken,
    checkRole(['admin', 'manager', 'member']),
    managerController.createPerson
);

app.patch(
    '/api/people/layout',
    verifyToken,
    checkRole(['admin', 'manager', 'member']),
    managerController.saveTreeLayout
);

app.patch(
    '/api/people/link',
    verifyToken,
    checkRole(['admin', 'manager', 'member']),
    managerController.linkRelations
);

app.patch(
    '/api/people/:id/position',
    verifyToken,
    checkRole(['admin', 'manager', 'member']),
    managerController.updatePersonPosition
);

app.patch(
    '/api/people/:id',
    verifyToken,
    checkRole(['admin', 'manager', 'member']),
    managerController.updateTreePerson
);

app.delete(
    '/api/people/:id',
    verifyToken,
    checkRole(['admin', 'manager', 'member']),
    managerController.deleteTreePerson
);

app.post(
    '/api/families',
    verifyToken,
    checkRole(['admin', 'manager', 'member']),
    managerController.createFamily
);

app.post(
    '/api/families/:familyId/children',
    verifyToken,
    checkRole(['admin', 'manager', 'member']),
    managerController.addFamilyChild
);

app.use('/api/manager', managerRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/voice', voiceRoutes);

// 9. 404 handler phải luôn nằm cuối routes
app.use((req, res) => {
    res.status(404).json({
        message: 'Đường dẫn không tồn tại!'
    });
});

// 10. Start server
const PORT = process.env.PORT || 3000;

startCalendarReminderScheduler(app);

server.listen(PORT, () => {
    console.log(`
    🚀 SERVER IS RUNNING (REAL-TIME READY)!
    📡 Port: ${PORT}
    🔗 URL: http://localhost:${PORT}
    ✨ Socket.io: Enabled
    `);
});