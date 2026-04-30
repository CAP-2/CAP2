const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get("/clans", verifyToken, checkRole(["admin"]), adminController.listClans);
router.post("/clans", verifyToken, checkRole(["admin"]), adminController.createClan);
router.put("/clans/:clanId", verifyToken, checkRole(["admin"]), adminController.updateClan);
router.delete("/clans/:clanId", verifyToken, checkRole(["admin"]), adminController.deleteClan);
router.get("/clans/:clanId/tree", verifyToken, checkRole(["admin"]), adminController.getClanTree);
router.get("/accounts", verifyToken, checkRole(["admin"]), adminController.listAccounts);
router.post("/accounts", verifyToken, checkRole(["admin"]), adminController.createAccount);
router.put("/accounts/:id", verifyToken, checkRole(["admin"]), adminController.updateAccountAccess);
router.delete("/accounts/:id", verifyToken, checkRole(["admin"]), adminController.deleteAccount);
router.post("/managers", verifyToken, checkRole(["admin"]), adminController.createManagerAccount);

// Quản lý Thành viên
router.get("/members", verifyToken, checkRole(["admin"]), adminController.getMembers);
router.put("/members/:id", verifyToken, checkRole(["admin"]), adminController.updateMember);
router.delete("/members/:id", verifyToken, checkRole(["admin"]), adminController.deleteMember);

// Quản lý Cài đặt
router.get("/settings", verifyToken, checkRole(["admin"]), adminController.getSettings);
router.post("/settings", verifyToken, checkRole(["admin"]), adminController.updateSettings);

// Quản lý Sự kiện
router.get("/events", verifyToken, checkRole(["admin"]), adminController.getEvents);
router.post("/events", verifyToken, checkRole(["admin"]), adminController.createEvent);
router.put("/events/:id", verifyToken, checkRole(["admin"]), adminController.updateEvent);
router.delete("/events/:id", verifyToken, checkRole(["admin"]), adminController.deleteEvent);

// Quản lý Thư viện
router.get("/gallery", verifyToken, checkRole(["admin"]), adminController.getGallery);
router.delete("/gallery/:id", verifyToken, checkRole(["admin"]), adminController.deleteGalleryItem);

// Thống kê & Bài viết
router.get("/dashboard-stats", verifyToken, checkRole(["admin"]), adminController.getDashboardStats);
router.get("/posts/clan/:clanId", verifyToken, checkRole(["admin"]), adminController.getPostsByClan);

module.exports = router;
