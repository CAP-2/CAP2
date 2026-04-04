require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

// Import Route Controllers
const authRoutes = require('./src/routes/authRoutes');
const managerRoutes = require('./src/routes/managerRoutes');
const memberRoutes = require('./src/routes/memberRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const app = express();

// Middlewares toàn cục
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API upload ảnh (dùng cho cả Member & Manager)
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Không có file được chọn!' });
    }
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl });
});

// Gắn các cụm Route
app.use('/api/auth', authRoutes); // Các API: /api/auth/login, /api/auth/register
app.use('/api/manager', managerRoutes); // Các API: /api/manager/pending, /api/manager/approve/:id
app.use('/api/member', memberRoutes);
app.use('/api/admin', adminRoutes);

// Xử lý lỗi 404
app.use((req, res) => {
    res.status(404).json({
        message: "Đường dẫn không tồn tại!"
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    🚀 SERVER IS RUNNING(All READY)!
    📡 Port: ${PORT}
    🔗 URL: http://localhost:${PORT}
    `);
});