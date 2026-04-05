const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get("/clans", verifyToken, checkRole([1]), adminController.listClans);
router.get("/clans/:clanId/tree", verifyToken, checkRole([1]), adminController.getClanTree);
router.get("/accounts", verifyToken, checkRole([1]), adminController.listAccounts);
router.put("/accounts/:id", verifyToken, checkRole([1]), adminController.updateAccountAccess);
router.post("/managers", verifyToken, checkRole([1]), adminController.createManagerAccount);

module.exports = router;
