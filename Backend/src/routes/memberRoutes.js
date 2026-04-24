const express = require("express");
const router = express.Router();
const memberController = require("../controllers/memberController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// Member dashboard: role 3 (member), 2 (manager), 1 (admin) khi có person_id.
router.get("/dashboard", verifyToken, checkRole(["admin", "manager", "member"]), memberController.getDashboard);
router.put("/profile", verifyToken, checkRole(["admin", "manager", "member"]), memberController.updateProfile);
router.put("/password", verifyToken, checkRole(["admin", "manager", "member"]), memberController.changePassword);

router.get("/chat", verifyToken, checkRole(["manager", "member"]), memberController.getChatMessages);
router.post("/chat", verifyToken, checkRole(["manager", "member"]), memberController.sendChatMessage);

router.post("/reminders", verifyToken, checkRole(["manager", "member"]), memberController.createReminder);
router.get("/tasks", verifyToken, checkRole(["manager", "member"]), memberController.getAssignedTasks);
router.patch("/tasks/:id/status", verifyToken, checkRole(["manager", "member"]), memberController.updateTaskStatus);

router.post("/content/profile", verifyToken, checkRole(["admin", "manager", "member"]), memberController.proposeProfileUpdate);
router.post("/content/post", verifyToken, checkRole(["admin", "manager", "member"]), memberController.submitMaterial);

// New Routes for General Posts & Submissions
router.get("/posts/general", verifyToken, checkRole(["admin", "manager", "member"]), memberController.getGeneralPosts);
router.get("/submissions", verifyToken, checkRole(["admin", "manager", "member"]), memberController.getMySubmissions);

module.exports = router;

