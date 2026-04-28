    const express = require('express');
    const router = express.Router();
    const managerController = require('../controllers/managerController');
    const {
        verifyToken,
        checkRole
    } = require('../middleware/authMiddleware');

    // Chỉ Admin (1) và Manager (2) mới được truy cập manager dashboard
    router.get('/stats', verifyToken, checkRole(['admin', 'manager']), managerController.getStats);
    router.get('/tree', verifyToken, checkRole(['admin', 'manager']), managerController.getFamilyTree);
    router.get('/members', verifyToken, checkRole(['admin', 'manager']), managerController.getAllMembers);
    router.get('/tree-edit-keys', verifyToken, checkRole(['admin', 'manager']), managerController.getActiveTreeEditKeys);
    router.post('/tree-edit-keys', verifyToken, checkRole(['admin', 'manager']), managerController.createTemporaryTreeEditKey);
    router.post('/members', verifyToken, checkRole(['admin', 'manager']), managerController.createMember);
    router.get('/members/:id/relations', verifyToken, checkRole(['admin', 'manager']), managerController.getMemberRelations);
    router.put('/members/:id/relations', verifyToken, checkRole(['admin', 'manager']), managerController.updateMemberRelations);
    router.get('/members/:id', verifyToken, checkRole(['admin', 'manager']), managerController.getMemberDetail);
    router.put('/members/:id', verifyToken, checkRole(['admin', 'manager']), managerController.updateMemberByManager);
    router.post('/members/:id/archive', verifyToken, checkRole(['admin', 'manager']), managerController.archiveMember);
    router.get('/members-archive', verifyToken, checkRole(['admin', 'manager']), managerController.getArchivedMembers);
    router.post('/members-archive/:id/restore', verifyToken, checkRole(['admin', 'manager']), managerController.restoreArchivedMember);
    router.delete('/members-archive/:id', verifyToken, checkRole(['admin', 'manager']), managerController.deleteArchivedMemberPermanently);
    router.get('/pending', verifyToken, checkRole(['admin', 'manager']), managerController.getPendingUsers);

    // Admin (1) và Manager (2) đều có thể duyệt/từ chối tài khoản chờ
    router.post('/approve/:id', verifyToken, checkRole(['admin', 'manager']), managerController.approveUser);
    router.post('/reject/:id', verifyToken, checkRole(['admin', 'manager']), managerController.rejectUser);

    // Routes duyệt bài viết/media
    router.get('/pending-posts', verifyToken, checkRole(['admin', 'manager']), managerController.getPendingPosts);
    router.post('/approve-post/:id', verifyToken, checkRole(['admin', 'manager']), managerController.approvePost);
    router.post('/reject-post/:id', verifyToken, checkRole(['admin', 'manager']), managerController.rejectPost);

    // Routes duyệt yêu cầu cập nhật Profile cá nhân (Bio, Avatar)
    router.get('/pending-profiles', verifyToken, checkRole(['admin', 'manager']), managerController.getPendingProfileUpdates);
    router.post('/approve-profile/:id', verifyToken, checkRole(['admin', 'manager']), managerController.approveProfileUpdate);
    router.post('/reject-profile/:id', verifyToken, checkRole(['admin', 'manager']), managerController.rejectProfileUpdate);

    // Route Quản lý Đa phương tiện (Media Management)
    router.get('/media', verifyToken, checkRole(['admin', 'manager']), managerController.getMedia);

    // --- 🌟 CÁC ROUTES MỚI CHO TÍNH NĂNG PHÂN CÔNG & GIA PHẢ 🌟 ---
    // 1. Phân công công việc
    router.post('/assign-task', verifyToken, checkRole(['admin', 'manager']), managerController.assignTask);
    router.get('/tasks', verifyToken, checkRole(['admin', 'manager']), managerController.getAssignedTasks);
    router.patch('/tasks/:id/complete', verifyToken, checkRole(['admin', 'manager']), managerController.completeTask);

    // 2. Quản lý Gia phả (Lineage)
    router.post('/family-tree/relationships', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.updateTreeRelationship);
    router.get('/clans/:clanId/family-tree', verifyToken, checkRole(['admin', 'manager']), managerController.getFamilyTree);
    router.patch('/clans/:clanId/family-tree/layout', verifyToken, checkRole(['admin', 'manager']), managerController.saveTreeLayout);
    router.post('/people', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.createPerson);
    router.post('/people/create', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.createPerson);
    router.patch('/people/link', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.linkRelations);
    router.patch('/people/layout', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.saveTreeLayout);
    router.patch('/people/:id/position', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.updatePersonPosition);
    router.patch('/people/:id', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.updateTreePerson);
    router.post('/families', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.createFamily);
    router.post('/families/:familyId/children', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.addFamilyChild);
    router.delete('/people/:id', verifyToken, checkRole(['admin', 'manager', 'member']), managerController.deleteTreePerson);

    module.exports = router;
