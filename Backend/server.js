require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import các Routes
const authRoutes = require('./src/routes/authRoutes');
const managerRoutes = require('./src/routes/managerRoutes');
const memberRoutes = require('./src/routes/memberRoutes');

const app = express();

// Middlewares toàn cục
app.use(cors());
app.use(express.json());

// Gắn các cụm Route
app.use('/api/auth', authRoutes); // Các API: /api/auth/login, /api/auth/register
app.use('/api/manager', managerRoutes); // Các API: /api/manager/pending, /api/manager/approve/:id
app.use('/api/member', memberRoutes);

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