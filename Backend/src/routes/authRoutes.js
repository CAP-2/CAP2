const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const clanController = require('../controllers/clanController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPasswordWithCode);
router.post('/register-clan', clanController.registerClan);
router.post('/register-clan-manager', clanController.registerClanWithManager);

module.exports = router;