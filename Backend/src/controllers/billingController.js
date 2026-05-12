const db = require('../config/db');
const { getClanBillingStatus } = require('../services/billingService');

function getSepayQrUrl({ amount, orderCode }) {
  const bankBin = process.env.SEPAY_BANK_BIN;
  const bankAccount = process.env.SEPAY_BANK_ACCOUNT;
  const accountName = process.env.SEPAY_ACCOUNT_NAME || '';
  const template = process.env.SEPAY_QR_TEMPLATE || 'compact2';

  if (!bankBin || !bankAccount || !orderCode) {
    return null;
  }

  const params = new URLSearchParams({
    amount: String(amount || 0),
    addInfo: orderCode,
    accountName,
  });

  return `https://img.vietqr.io/image/${bankBin}-${bankAccount}-${template}.png?${params.toString()}`;
}

async function getPlans(req, res) {
  try {
    const [plans] = await db.query(
      `
      SELECT 
        id,
        code,
        name,
        description,
        price_vnd,
        billing_cycle,
        person_limit,
        account_limit
      FROM plans
      WHERE is_active = 1
      ORDER BY price_vnd ASC, id ASC
      `
    );

    return res.json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error('getPlans error:', error);

    return res.status(500).json({
      success: false,
      message: 'Không lấy được danh sách gói.',
      error: error.message,
    });
  }
}

async function assertCanViewClanBilling(req, clanId) {
  if (Number(req.user?.role_id) === 1) {
    return { ok: true };
  }

  if (Number(req.user?.role_id) === 2) {
    const [rows] = await db.query(
      `
      SELECT p.clan_id
      FROM accounts a
      INNER JOIN people p ON p.id = a.person_id
      WHERE a.id = ?
      LIMIT 1
      `,
      [req.user.id]
    );

    const managerClanId = rows[0]?.clan_id;

    if (!managerClanId) {
      return {
        ok: false,
        status: 404,
        message: 'Không xác định được dòng họ của manager.',
      };
    }

    if (Number(managerClanId) !== Number(clanId)) {
      return {
        ok: false,
        status: 403,
        message: 'Manager chỉ được xem billing của dòng họ mình.',
      };
    }

    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    message: 'Không có quyền xem billing.',
  };
}

async function getClanBilling(req, res) {
  try {
    const clanId = Number(req.params.clanId);

    if (!Number.isFinite(clanId) || clanId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'clanId không hợp lệ.',
      });
    }

    const permission = await assertCanViewClanBilling(req, clanId);

    if (!permission.ok) {
      return res.status(permission.status).json({
        success: false,
        message: permission.message,
      });
    }

    const billing = await getClanBillingStatus(clanId);

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Clan chưa có gói sử dụng.',
      });
    }

    return res.json({
      success: true,
      billing,
    });
  } catch (error) {
    console.error('getClanBilling error:', error);

    return res.status(500).json({
      success: false,
      message: 'Không lấy được thông tin gói clan.',
      error: error.message,
    });
  }
}

async function getClanPayments(req, res) {
  try {
    const clanId = Number(req.params.clanId);

    if (!Number.isFinite(clanId) || clanId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'clanId không hợp lệ.',
      });
    }

    const permission = await assertCanViewClanBilling(req, clanId);

    if (!permission.ok) {
      return res.status(permission.status).json({
        success: false,
        message: permission.message,
      });
    }

    await db.query(
      `
      UPDATE payments
      SET status = 'cancelled'
      WHERE clan_id = ?
        AND status = 'pending'
        AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `,
      [clanId]
    );

    const [payments] = await db.query(
  `
  SELECT
    pay.id,
    pay.clan_id,
    pay.plan_id,
    pl.code AS plan_code,
    pl.name AS plan_name,
    pay.payer_account_id,
    payer.email AS payer_email,
    pay.provider,
    pay.order_code,
    pay.amount_vnd,
    pay.status,
    pay.paid_at,
    pay.created_at,
    pay.updated_at
  FROM payments pay
  LEFT JOIN plans pl ON pl.id = pay.plan_id
  LEFT JOIN accounts payer ON payer.id = pay.payer_account_id
  WHERE pay.clan_id = ?
  ORDER BY COALESCE(pay.paid_at, pay.created_at) DESC, pay.id DESC
  `,
  [clanId]
);

const paymentsWithQr = payments.map((payment) => {
  const status = String(payment.status || '').toLowerCase();
  const provider = String(payment.provider || '').toLowerCase();

  const canGenerateQr =
    provider === 'sepay' &&
    status === 'pending' &&
    payment.order_code;

  return {
    ...payment,
    transfer_content: payment.order_code,
    qr_url: canGenerateQr
      ? getSepayQrUrl({
          amount: payment.amount_vnd,
          orderCode: payment.order_code,
        })
      : null,
    bank_bin: canGenerateQr ? process.env.SEPAY_BANK_BIN || null : null,
    bank_account: canGenerateQr ? process.env.SEPAY_BANK_ACCOUNT || null : null,
    account_name: canGenerateQr ? process.env.SEPAY_ACCOUNT_NAME || null : null,
  };
});

return res.json({
  success: true,
  payments: paymentsWithQr,
});
  } catch (error) {
    console.error('getClanPayments error:', error);

    return res.status(500).json({
      success: false,
      message: 'Không lấy được lịch sử thanh toán.',
      error: error.message,
    });
  }
}

async function manualUpgradeClan(req, res) {
  const connection = await db.getConnection();

  try {
    const clanId = Number(req.params.clanId);
    const body = req.body || {};

    const planCode = String(body.plan_code || body.planCode || '').trim().toUpperCase();
    const months = Number(body.months || 1);

    if (!Number.isFinite(clanId) || clanId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'clanId không hợp lệ.',
      });
    }

    if (!planCode) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu plan_code.',
        received_body: body,
        content_type: req.headers['content-type'] || null,
      });
    }

    const [plans] = await connection.query(
      `
      SELECT *
      FROM plans
      WHERE code = ?
        AND is_active = 1
      LIMIT 1
      `,
      [planCode]
    );

    if (!plans.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gói.',
      });
    }

    const plan = plans[0];
    const safeMonths = Number.isFinite(months) && months > 0 ? Math.floor(months) : 1;

    await connection.beginTransaction();

    await connection.query(
      `
      INSERT INTO subscriptions (clan_id, plan_id, status, started_at, expires_at)
      VALUES (
        ?,
        ?,
        ?,
        NOW(),
        CASE
          WHEN ? = 'free' THEN NULL
          ELSE DATE_ADD(NOW(), INTERVAL ? MONTH)
        END
      )
      ON DUPLICATE KEY UPDATE
        plan_id = VALUES(plan_id),
        status = VALUES(status),
        started_at = VALUES(started_at),
        expires_at = VALUES(expires_at),
        cancelled_at = NULL
      `,
      [
        clanId,
        plan.id,
        plan.billing_cycle === 'free' ? 'free' : 'active',
        plan.billing_cycle,
        safeMonths,
      ]
    );

    await connection.query(
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
        paid_at,
        raw_response
      )
      VALUES (?, ?, ?, 'manual', ?, ?, 'paid', NOW(), ?)
      `,
      [
        clanId,
        plan.id,
        req.user?.id || req.user?.account_id || null,
        `MANUAL_${clanId}_${Date.now()}`,
        plan.price_vnd,
        JSON.stringify({
          type: 'manual_upgrade',
          admin_id: req.user?.id || req.user?.account_id || null,
          plan_code: plan.code,
          months: safeMonths,
        }),
      ]
    );

    await connection.commit();

    const billing = await getClanBillingStatus(clanId);

    return res.json({
      success: true,
      message: 'Đã nâng cấp gói thủ công.',
      billing,
    });
  } catch (error) {
    await connection.rollback();
    console.error('manualUpgradeClan error:', error);

    return res.status(500).json({
      success: false,
      message: 'Không nâng cấp thủ công được.',
      error: error.message,
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  getPlans,
  getClanBilling,
  getClanPayments,
  manualUpgradeClan,
};