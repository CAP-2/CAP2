const express = require("express");
const router = express.Router();
const memberController = require("../controllers/memberController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// Member dashboard: ưu tiên role 3, vẫn cho role 2 vào xem.
router.get("/dashboard", verifyToken, checkRole([2, 3]), memberController.getDashboard);
router.put("/profile", verifyToken, checkRole([2, 3]), memberController.updateProfile);

router.get("/chat", verifyToken, checkRole([2, 3]), memberController.getChatMessages);
router.post("/chat", verifyToken, checkRole([2, 3]), memberController.sendChatMessage);

router.post("/reminders", verifyToken, checkRole([2, 3]), memberController.createReminder);

module.exports = router;

