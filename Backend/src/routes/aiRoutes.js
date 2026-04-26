const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

router.post("/public-chat", aiController.publicChat);

module.exports = router;
