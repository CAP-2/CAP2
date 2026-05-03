const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.post(
  '/sepay/create',
  verifyToken,
  checkRole(['manager', 'admin']),
  paymentController.createSepayPayment
);

router.post(
  '/sepay/webhook',
  paymentController.handleSepayWebhook
);

router.get(
  '/status/:orderCode',
  verifyToken,
  checkRole(['manager', 'admin']),
  paymentController.getPaymentStatus
);

module.exports = router;