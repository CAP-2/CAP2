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
router.post('/members', verifyToken, checkRole([1, 2]), managerController.createMember);
router.get('/members/:id/relations', verifyToken, checkRole([1, 2]), managerController.getMemberRelations);
router.put('/members/:id/relations', verifyToken, checkRole([1, 2]), managerController.updateMemberRelations);
router.get('/members/:id', verifyToken, checkRole([1, 2]), managerController.getMemberDetail);
router.put('/members/:id', verifyToken, checkRole([1, 2]), managerController.updateMemberByManager);
router.get('/pending', verifyToken, checkRole([1, 2]), managerController.getPendingUsers);

// Admin (1) và Manager (2) đều có thể duyệt/từ chối tài khoản chờ
router.post('/approve/:id', verifyToken, checkRole([1, 2]), managerController.approveUser);
router.post('/reject/:id', verifyToken, checkRole([1, 2]), managerController.rejectUser);

// Routes duyệt bài viết/media
router.get('/pending-posts', verifyToken, checkRole([1, 2]), managerController.getPendingPosts);
router.post('/approve-post/:id', verifyToken, checkRole([1, 2]), managerController.approvePost);
router.post('/reject-post/:id', verifyToken, checkRole([1, 2]), managerController.rejectPost);

// Route Quản lý Đa phương tiện (Media Management)
router.get('/media', verifyToken, checkRole([1, 2]), managerController.getMedia);

// --- 🌟 CÁC ROUTES MỚI CHO TÍNH NĂNG PHÂN CÔNG & GIA PHẢ 🌟 ---
// 1. Phân công công việc
router.post('/assign-task', verifyToken, checkRole([1, 2]), managerController.assignTask);
router.get('/tasks', verifyToken, checkRole([1, 2]), managerController.getAssignedTasks);
router.patch('/tasks/:id/complete', verifyToken, checkRole([1, 2]), managerController.completeTask);

// 2. Quản lý Gia phả (Lineage)
router.post('/people/create', verifyToken, checkRole([1, 2]), managerController.createPerson);
router.patch('/people/link', verifyToken, checkRole([1, 2]), managerController.linkRelations);

module.exports = router;