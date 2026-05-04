const express = require("express");
const router = express.Router();

const aiController = require("../controllers/aiController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.post("/public-chat", aiController.publicChat);

router.post(
  "/event-form/generate",
  verifyToken,
  checkRole(["admin", "manager"]),
  aiController.generateEventForm
);

module.exports = router;