const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const clanController = require('../controllers/clanController');

// Auth: đăng ký + đăng nhập
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/register-clan', clanController.registerClan);
router.post('/register-clan-manager', clanController.registerClanWithManager);

module.exports = router;