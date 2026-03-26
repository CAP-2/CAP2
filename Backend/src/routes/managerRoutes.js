const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const {
    verifyToken,
    checkRole
} = require('../middleware/authMiddleware');

// Chỉ Admin (1) và Manager (2) mới được truy cập manager dashboard
router.get('/stats', verifyToken, checkRole([1, 2]), managerController.getStats);
router.get('/members', verifyToken, checkRole([1, 2]), managerController.getAllMembers);
router.get('/pending', verifyToken, checkRole([1, 2]), managerController.getPendingUsers);

// Admin (1) và Manager (2) đều có thể duyệt/từ chối tài khoản chờ
router.post('/approve/:id', verifyToken, checkRole([1, 2]), managerController.approveUser);
router.post('/reject/:id', verifyToken, checkRole([1, 2]), managerController.rejectUser);

module.exports = router;