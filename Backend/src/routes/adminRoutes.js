const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get("/clans", verifyToken, checkRole(["admin"]), adminController.listClans);
router.get("/clans/:clanId/tree", verifyToken, checkRole(["admin"]), adminController.getClanTree);
router.get("/accounts", verifyToken, checkRole(["admin"]), adminController.listAccounts);
router.put("/accounts/:id", verifyToken, checkRole(["admin"]), adminController.updateAccountAccess);
router.post("/managers", verifyToken, checkRole(["admin"]), adminController.createManagerAccount);

module.exports = router;
