const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const {
    verifyToken,
    checkRole
} = require('../middleware/authMiddleware');

// Chỉ Admin (1) và Manager (2) mới được xem danh sách chờ
router.get('/pending', verifyToken, checkRole([1, 2]), managerController.getPendingUsers);

// Admin (1) và Manager (2) đều được phê duyệt tài khoản
router.post('/approve/:id', verifyToken, checkRole([1, 2]), managerController.approveUser);

module.exports = router;