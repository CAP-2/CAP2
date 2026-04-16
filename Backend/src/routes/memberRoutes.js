const express = require("express");
const router = express.Router();
const memberController = require("../controllers/memberController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// Member dashboard: role 3 (member), 2 (manager), 1 (admin) khi có person_id.
router.get("/dashboard", verifyToken, checkRole([1, 2, 3]), memberController.getDashboard);
router.put("/profile", verifyToken, checkRole([1, 2, 3]), memberController.updateProfile);
router.put("/password", verifyToken, checkRole([1, 2, 3]), memberController.changePassword);

router.get("/chat", verifyToken, checkRole([2, 3]), memberController.getChatMessages);
router.post("/chat", verifyToken, checkRole([2, 3]), memberController.sendChatMessage);

router.post("/reminders", verifyToken, checkRole([2, 3]), memberController.createReminder);
router.get("/tasks", verifyToken, checkRole([2, 3]), memberController.getAssignedTasks);
router.patch("/tasks/:id/status", verifyToken, checkRole([2, 3]), memberController.updateTaskStatus);

router.post("/content/profile", verifyToken, checkRole([1, 2, 3]), memberController.proposeProfileUpdate);
router.post("/content/post", verifyToken, checkRole([1, 2, 3]), memberController.submitMaterial);

// New Routes for General Posts & Submissions
router.get("/posts/general", verifyToken, checkRole([1, 2, 3]), memberController.getGeneralPosts);
router.get("/submissions", verifyToken, checkRole([1, 2, 3]), memberController.getMySubmissions);

module.exports = router;

