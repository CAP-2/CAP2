const db = require('../config/db');
const { getClanBillingStatus } = require('../services/billingService');

function buildOrderCode(clanId) {
  return `SEPAY_${clanId}_${Date.now()}`;
}

function normalizeAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function getManagerClanId(accountId) {
  return db
    .query(
      `
      SELECT p.clan_id
      FROM accounts a
      INNER JOIN people p ON p.id = a.person_id
      WHERE a.id = ?
      LIMIT 1
      `,
      [accountId]
    )
    .then(([rows]) => rows[0]?.clan_id || null);
}

function getSepayQrUrl({ amount, orderCode }) {
  const bankBin = process.env.SEPAY_BANK_BIN;
  const bankAccount = process.env.SEPAY_BANK_ACCOUNT;
  const accountName = process.env.SEPAY_ACCOUNT_NAME || '';
  const template = process.env.SEPAY_QR_TEMPLATE || 'compact2';

  if (!bankBin || !bankAccount) {
    return null;
  }

  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: orderCode,
    accountName,
  });

  return `https://img.vietqr.io/image/${bankBin}-${bankAccount}-${template}.png?${params.toString()}`;
}

function extractSepayContent(payload = {}) {
  return String(
    payload.content ||
      payload.description ||
      payload.transferContent ||
      payload.transaction_content ||
      payload.reference ||
      ''
  );
}

function extractSepayAmount(payload = {}) {
  return normalizeAmount(
    payload.transferAmount ||
      payload.amount ||
      payload.money ||
      payload.creditAmount ||
      payload.transaction_amount ||
      0
  );
}

async function createSepayPayment(req, res) {
  try {
    const body = req.body || {};
    const planCode = String(body.plan_code || body.planCode || '').trim().toUpperCase();

    if (!planCode || planCode === 'FREE') {
      return res.status(400).json({
        success: false,
        message: 'Gói thanh toán không hợp lệ.',
      });
    }

    let clanId = Number(body.clan_id);

    if (Number(req.user.role_id) === 2) {
      clanId = await getManagerClanId(req.user.id);
    }

    if (!Number.isFinite(clanId) || clanId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Không xác định được dòng họ cần nâng cấp.',
      });
    }

    const [plans] = await db.query(
      `
      SELECT *
      FROM plans
      WHERE code = ?
        AND is_active = 1
        AND price_vnd > 0
      LIMIT 1
      `,
      [planCode]
    );

    if (!plans.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gói thanh toán.',
      });
    }

    const plan = plans[0];
    const orderCode = buildOrderCode(clanId);

    await db.query(
      `
      INSERT INTO payments
      (
        clan_id,
        plan_id,
        payer_account_id,
        provider,
        order_code,
        amount_vnd,
        status,
        raw_response
      )
      VALUES (?, ?, ?, 'sepay', ?, ?, 'pending', ?)
      `,
      [
        clanId,
        plan.id,
        req.user.id,
        orderCode,
        plan.price_vnd,
        JSON.stringify({
          type: 'sepay_create',
          plan_code: plan.code,
        }),
      ]
    );

    const qrUrl = getSepayQrUrl({
      amount: plan.price_vnd,
      orderCode,
    });

    return res.json({
      success: true,
      provider: 'sepay',
      order_code: orderCode,
      amount_vnd: plan.price_vnd,
      transfer_content: orderCode,
      qr_url: qrUrl,
      bank_bin: process.env.SEPAY_BANK_BIN || null,
      bank_account: process.env.SEPAY_BANK_ACCOUNT || null,
      account_name: process.env.SEPAY_ACCOUNT_NAME || null,
      message: 'Tạo thanh toán SePay thành công.',
    });
  } catch (error) {
    console.error('createSepayPayment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Không tạo được thanh toán SePay.',
      error: error.message,
    });
  }
}

async function handleSepayWebhook(req, res) {
  const payload = req.body || {};

  try {
    const configuredSecret = process.env.SEPAY_WEBHOOK_SECRET;
    const receivedSecret =
      req.headers['x-sepay-secret'] ||
      req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      payload.secret;

    if (configuredSecret && receivedSecret && String(receivedSecret) !== String(configuredSecret)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook secret',
      });
    }

    const content = extractSepayContent(payload);
    const amount = extractSepayAmount(payload);

    if (!content || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Webhook thiếu nội dung hoặc số tiền.',
      });
    }

    const [payments] = await db.query(
      `
      SELECT pay.*, pl.billing_cycle
      FROM payments pay
      INNER JOIN plans pl ON pl.id = pay.plan_id
      WHERE ? LIKE CONCAT('%', pay.order_code, '%')
        AND pay.provider = 'sepay'
      ORDER BY pay.id DESC
      LIMIT 1
      `,
      [content]
    );

    if (!payments.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy payment khớp nội dung chuyển khoản.',
      });
    }

    const payment = payments[0];

    if (payment.status === 'paid') {
      return res.json({
        success: true,
        message: 'Payment đã được xác nhận trước đó.',
      });
    }

    if (Number(payment.amount_vnd) !== Number(amount)) {
      await db.query(
        `
        UPDATE payments
        SET raw_response = ?
        WHERE id = ?
        `,
        [JSON.stringify(payload), payment.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Số tiền chuyển khoản không khớp payment.',
      });
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query(
        `
        UPDATE payments
        SET status = 'paid',
            paid_at = NOW(),
            raw_response = ?
        WHERE id = ?
        `,
        [JSON.stringify(payload), payment.id]
      );

      await connection.query(
        `
        INSERT INTO subscriptions (clan_id, plan_id, status, started_at, expires_at)
        VALUES (
          ?,
          ?,
          'active',
          NOW(),
          DATE_ADD(NOW(), INTERVAL 1 MONTH)
        )
        ON DUPLICATE KEY UPDATE
          plan_id = VALUES(plan_id),
          status = VALUES(status),
          started_at = VALUES(started_at),
          expires_at = VALUES(expires_at),
          cancelled_at = NULL
        `,
        [payment.clan_id, payment.plan_id]
      );

      await connection.commit();

      return res.json({
        success: true,
        message: 'Xác nhận thanh toán SePay thành công.',
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('handleSepayWebhook error:', error);

    return res.status(500).json({
      success: false,
      message: 'Lỗi xử lý webhook SePay.',
      error: error.message,
    });
  }
}

async function getPaymentStatus(req, res) {
  try {
    const orderCode = String(req.params.orderCode || '').trim();

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu orderCode.',
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        pay.id,
        pay.clan_id,
        pay.plan_id,
        pl.code AS plan_code,
        pl.name AS plan_name,
        pay.provider,
        pay.order_code,
        pay.amount_vnd,
        pay.status,
        pay.paid_at,
        pay.created_at
      FROM payments pay
      LEFT JOIN plans pl ON pl.id = pay.plan_id
      WHERE pay.order_code = ?
      LIMIT 1
      `,
      [orderCode]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy payment.',
      });
    }

    const payment = rows[0];

    return res.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('getPaymentStatus error:', error);

    return res.status(500).json({
      success: false,
      message: 'Không lấy được trạng thái thanh toán.',
      error: error.message,
    });
  }
}

module.exports = {
  createSepayPayment,
  handleSepayWebhook,
  getPaymentStatus,
};