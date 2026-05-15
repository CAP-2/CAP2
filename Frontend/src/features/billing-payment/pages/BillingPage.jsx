import { useEffect, useState } from "react";
import { formatDateTimeVN, formatDateVN } from "../../../shared/utils/dateFormat";
import {
  getBillingPlans,
  getClanBilling,
  getClanPayments,
  manualUpgradeClan,
} from "../../../api/billingService";
import { getStats, getManagerTree } from "../../../api/managerService";
import { getAdminClans } from "../../../api/adminService";
import {
  createSepayPayment,
  getPaymentStatus,
  cancelPendingPayment,
} from "../../../api/paymentService";
import "./BillingPage.css";

function readJsonStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeRole(roleName, roleId) {
  const normalized = String(roleName || "").trim().toLowerCase();

  if (
    normalized.includes("admin") ||
    normalized.includes("administrator") ||
    normalized.includes("quản trị") ||
    normalized.includes("quan tri")
  ) {
    return "admin";
  }

  if (
    normalized.includes("manager") ||
    normalized.includes("quản lý") ||
    normalized.includes("quan ly") ||
    normalized.includes("tộc trưởng") ||
    normalized.includes("toc truong")
  ) {
    return "manager";
  }

  if (
    normalized.includes("member") ||
    normalized.includes("thành viên") ||
    normalized.includes("thanh vien")
  ) {
    return "member";
  }

  if (Number(roleId) === 1) return "admin";
  if (Number(roleId) === 2) return "manager";
  if (Number(roleId) === 3) return "member";

  return normalized || "";
}

function getRoleFromToken() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "";

    const payload = JSON.parse(atob(token.split(".")[1]));

    return normalizeRole(
      payload?.role_name || payload?.roleName || payload?.role,
      payload?.role_id || payload?.roleId
    );
  } catch {
    return "";
  }
}

function getCurrentUserRole() {
  const authUser = readJsonStorage("auth_user");
  const user = readJsonStorage("user");

  const source = authUser || user || {};

  const roleName =
    source.role_name ||
    source.roleName ||
    source.role ||
    source.user?.role_name ||
    source.user?.roleName ||
    source.user?.role;

  const roleId =
    source.role_id ||
    source.roleId ||
    source.user?.role_id ||
    source.user?.roleId;

  const roleFromStorage = normalizeRole(roleName, roleId);

  if (roleFromStorage) return roleFromStorage;

  return getRoleFromToken();
}

function resolveClanIdFromResponse(...responses) {
  for (const response of responses) {
    const clanId =
      response?.clan?.id ||
      response?.data?.clan?.id ||
      response?.clan_id ||
      response?.clanId ||
      response?.data?.clan_id ||
      response?.data?.clanId ||
      response?.stats?.clan_id ||
      response?.stats?.clanId;

    if (clanId) return clanId;

    const firstPersonClanId =
      response?.people?.[0]?.clan_id ||
      response?.data?.people?.[0]?.clan_id ||
      response?.tree?.people?.[0]?.clan_id;

    if (firstPersonClanId) return firstPersonClanId;
  }

  return null;
}

function normalizeClansResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.clans)) return response.clans;
  if (Array.isArray(response?.data?.clans)) return response.data.clans;
  return [];
}

function getClanName(clan) {
  return clan?.clan_name || clan?.name || `Clan #${clan?.id}`;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

export default function BillingPage() {
  const [clanId, setClanId] = useState(null);
  const [adminClans, setAdminClans] = useState([]);
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentDialog, setPaymentDialog] = useState(null);
  const [paymentChecking, setPaymentChecking] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentActionLoading, setPaymentActionLoading] = useState(false);

  const currentRole = getCurrentUserRole();
  const isAdmin = currentRole === "admin";
  const planRank = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  PLUS: 3,
};

const normalizePlanCode = (planCode) => {
  return String(planCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
};

const getPlanRank = (planCode) => {
  return planRank[normalizePlanCode(planCode)] ?? 0;
};

const isBillingActive =
  billing?.status === "active" &&
  billing?.expires_at &&
  new Date(billing.expires_at) > new Date();

const currentPlanRank = getPlanRank(billing?.plan_code);

const activePendingPayment = payments.find((payment) => {
  return String(payment.status || "").toLowerCase() === "pending";
});

const isPaymentExpired = (payment) => {
  return String(payment?.status || "").toLowerCase() === "cancelled";
};

const isPlanDowngrade = (planCode) => {
  return isBillingActive && getPlanRank(planCode) < currentPlanRank;
};

const getPaymentStatusText = (payment) => {
  const status = String(payment?.status || "pending").toLowerCase();

  if (status === "paid") {
    return "Giao dịch đã thanh toán, không thể thanh toán lại.";
  }

  if (status === "pending") {
    if (isPaymentExpired(payment)) {
      return "Giao dịch đã quá 24 giờ, hệ thống sẽ tự hủy.";
    }

    if (isPlanDowngrade(payment.plan_code)) {
      return "Không thể thanh toán gói thấp hơn khi gói hiện tại vẫn còn hiệu lực.";
    }

    return "Có thể tiếp tục thanh toán giao dịch này.";
  }

  if (status === "cancelled") {
  return "Giao dịch đã bị hủy hoặc đã quá hạn, không thể thanh toán tiếp.";
}

return "Giao dịch đã kết thúc, không thể thanh toán tiếp.";
};

  const loadBillingForClan = async (targetClanId) => {
    if (!targetClanId) {
      setBilling(null);
      setPayments([]);
      return;
    }

    try {
      setBillingLoading(true);
      setMessage("");

      const [plansResult, billingResult, paymentsResult] = await Promise.all([
        getBillingPlans(),
        getClanBilling(targetClanId),
        getClanPayments(targetClanId),
      ]);

      setPlans(plansResult?.plans || []);
      setBilling(billingResult?.billing || null);
      setPayments(paymentsResult?.payments || []);
    } catch (error) {
      console.error("loadBillingForClan error:", error);
      setBilling(null);
      setPayments([]);
      setMessage(error.message || "Không tải được thông tin gói sử dụng.");
    } finally {
      setBillingLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setMessage("");

      if (isAdmin) {
        const clansResult = await getAdminClans("all");
        const clans = normalizeClansResponse(clansResult);

        setAdminClans(clans);

        const firstClanId = clans[0]?.id || null;

        if (!firstClanId) {
          setClanId(null);
          setBilling(null);
          setPayments([]);
          setMessage("Chưa có cây gia phả nào để kiểm tra gói sử dụng.");
          return;
        }

        setClanId(firstClanId);
        await loadBillingForClan(firstClanId);
        return;
      }

      const [statsResult, treeResult] = await Promise.all([
        getStats().catch(() => null),
        getManagerTree().catch(() => null),
      ]);

      const resolvedClanId =
        resolveClanIdFromResponse(statsResult, treeResult) ||
        localStorage.getItem("clan_id");

      if (!resolvedClanId) {
        setClanId(null);
        setBilling(null);
        setPayments([]);
        setMessage("Không xác định được dòng họ của manager.");
        return;
      }

      setClanId(resolvedClanId);
      await loadBillingForClan(resolvedClanId);
    } catch (error) {
      console.error("loadInitialData error:", error);
      setMessage(error.message || "Không tải được dữ liệu billing.");
    } finally {
      setLoading(false);
    }
  };

  const handleClanChange = async (event) => {
    const nextClanId = event.target.value;

    setClanId(nextClanId);
    setPaymentDialog(null);
    setSelectedPayment(null);

    await loadBillingForClan(nextClanId);
  };

  const handleCreateSepayPayment = async (plan) => {
    try {
      setMessage("");
      if (activePendingPayment) {
        setSelectedPayment(activePendingPayment);
        setMessage(
          "Bạn đang có giao dịch chờ thanh toán. Vui lòng thanh toán hoặc hủy giao dịch đó trước khi tạo giao dịch mới."
        );
        return;
      }

      if (isPlanDowngrade(plan.code)) {
        setMessage(
          "Không thể mua gói thấp hơn khi gói hiện tại vẫn còn hiệu lực."
        );
        return;
      }

      const payload = isAdmin
        ? {
            clan_id: clanId,
            plan_code: plan.code,
          }
        : {
            plan_code: plan.code,
          };

      const result = await createSepayPayment(payload);

      setPaymentDialog({
        plan,
        orderCode: result.order_code,
        amountVnd: result.amount_vnd,
        transferContent: result.transfer_content,
        qrUrl: result.qr_url,
        bankBin: result.bank_bin,
        bankAccount: result.bank_account,
        accountName: result.account_name,
        status: "pending",
      });
    } catch (error) {
      setMessage(error.message || "Không tạo được thanh toán.");
    }
  };

  const checkCurrentPaymentStatus = async () => {
    if (!paymentDialog?.orderCode) return;

    try {
      setPaymentChecking(true);
      setMessage("");

      const result = await getPaymentStatus(paymentDialog.orderCode);
      const payment = result?.payment;

      if (payment?.status === "paid") {
        setPaymentDialog((prev) =>
          prev
            ? {
                ...prev,
                status: "paid",
              }
            : prev
        );

        await loadBillingForClan(clanId);
        setMessage("Thanh toán thành công. Gói sử dụng đã được cập nhật.");
        return;
      }

      setPaymentDialog((prev) =>
        prev
          ? {
              ...prev,
              status: payment?.status || "pending",
            }
          : prev
      );

      setMessage("Thanh toán chưa được xác nhận. Vui lòng kiểm tra lại sau.");
    } catch (error) {
      setMessage(error.message || "Không kiểm tra được trạng thái thanh toán.");
    } finally {
      setPaymentChecking(false);
    }
  };
  
  const handleCancelPendingPayment = async (payment) => {
  if (!payment?.id) {
    return;
  }

  const ok = window.confirm("Bạn có chắc muốn hủy giao dịch này không?");

  if (!ok) {
    return;
  }

  try {
    setPaymentActionLoading(true);
    setMessage("");

    await cancelPendingPayment(payment.id);

    setSelectedPayment(null);
    setPaymentDialog(null);

    await loadBillingForClan(clanId);

    setMessage("Đã hủy giao dịch chờ thanh toán.");
  } catch (error) {
    setMessage(error.message || "Không thể hủy giao dịch.");
  } finally {
    setPaymentActionLoading(false);
  }
};

const handlePaySelectedPayment = (payment) => {
  if (!payment) {
    return;
  }

  const status = String(payment.status || "").toLowerCase();

  if (status === "paid") {
    setMessage("Giao dịch này đã được thanh toán, không thể thanh toán lại.");
    return;
  }

  if (status !== "pending") {
    setMessage("Chỉ giao dịch đang chờ thanh toán mới có thể tiếp tục thanh toán.");
    return;
  }

  if (isPaymentExpired(payment)) {
    setMessage(
      "Giao dịch đã quá 24 giờ. Vui lòng tải lại trang để hệ thống cập nhật trạng thái."
    );
    return;
  }

  if (isPlanDowngrade(payment.plan_code)) {
    setMessage("Không thể thanh toán gói thấp hơn khi gói hiện tại vẫn còn hiệu lực.");
    return;
  }

  setPaymentDialog({
    plan: {
      name: payment.plan_name || payment.plan_code || "Không rõ",
      code: payment.plan_code,
    },
    orderCode: payment.order_code,
    amountVnd: payment.amount_vnd,
    transferContent:
      payment.transfer_content || `Thanh toan ${payment.order_code}`,
    qrUrl: payment.qr_url,
    bankBin: payment.bank_bin,
    bankAccount: payment.bank_account,
    accountName: payment.account_name,
    status: payment.status || "pending",
  });
};
  useEffect(() => {
    loadInitialData();
  }, []);

  const usagePeoplePercent = billing?.person_limit ? Math.min(100, Math.round((Number(billing.current_people || 0) / Number(billing.person_limit || 1)) * 100)) : 0;
  const usageAccountsPercent = billing?.account_limit ? Math.min(100, Math.round((Number(billing.current_accounts || 0) / Number(billing.account_limit || 1)) * 100)) : 0;

  if (loading) {
    return (
      <div className="billing-page billing-page--loading">
        <div className="billing-card billing-loading-card">
          <span className="material-symbols-outlined">hourglass_top</span>
          <h1>Đang tải gói sử dụng...</h1>
          <p>Hệ thống đang kiểm tra thông tin dòng họ và lịch sử thanh toán.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-page">
      <section className="billing-hero">
        <div>
          <span className="billing-kicker">Gói sử dụng dòng họ</span>
          <h1>Quản lý dung lượng & nâng cấp</h1>
          <p>Theo dõi giới hạn hồ sơ, tài khoản đăng nhập và nâng cấp gói bằng thanh toán VietQR.</p>
        </div>
        {billing && (
          <div className="billing-current-pill">
            <span>Gói hiện tại</span>
            <strong>{billing.plan_name}</strong>
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="billing-alert billing-alert--admin">
          <span className="material-symbols-outlined">admin_panel_settings</span>
          <div>
            <strong>Chế độ quản trị hệ thống</strong>
            <p>Bạn có thể chọn cây gia phả để kiểm tra hoặc nâng cấp thử nghiệm gói sử dụng.</p>
            <label>Chọn cây gia phả</label>
            <select value={clanId || ""} onChange={handleClanChange}>
              {adminClans.map((clan) => (
                <option key={clan.id} value={clan.id}>
                  #{clan.id} - {getClanName(clan)}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      {!isAdmin && (
        <section className="billing-alert billing-alert--pay">
          <span className="material-symbols-outlined">qr_code_2</span>
          <div>
            <strong>Thanh toán SePay / VietQR đã sẵn sàng</strong>
            <p>Tài khoản manager có thể nâng cấp gói cho dòng họ bằng chuyển khoản VietQR.</p>
          </div>
        </section>
      )}


      {billingLoading && (
        <section className="billing-alert billing-alert--loading">
          <span className="material-symbols-outlined">sync</span>
          <div>Đang tải gói sử dụng của cây gia phả đã chọn...</div>
        </section>
      )}

      {billing && (
  <section className="billing-overview-grid">
    <article className="billing-card billing-current-card">
      <div className="billing-card-head">
        <div>
          <span className="billing-kicker">Gói hiện tại</span>
          <h2>{billing.plan_name}</h2>
        </div>
        <span className="billing-status-badge">{billing.status}</span>
      </div>

      <div className="billing-info-list">
        <div>
          <span>Clan ID</span>
          <strong>#{clanId}</strong>
        </div>
        <div>
          <span>Ngày hết hạn</span>
          <strong>
            {billing.expires_at
              ? formatDateVN(billing.expires_at)
              : "Không giới hạn"}
          </strong>
        </div>
      </div>

      <div className="billing-usage-block">
        <div className="billing-usage-title">
          <span>Hồ sơ gia phả</span>
          <strong>
            {billing.current_people} / {billing.person_limit}
          </strong>
        </div>
        <div className="billing-progress">
          <span style={{ width: `${usagePeoplePercent}%` }} />
        </div>
      </div>

      <div className="billing-usage-block">
        <div className="billing-usage-title">
          <span>Tài khoản đăng nhập</span>
          <strong>
            {billing.current_accounts} / {billing.account_limit}
          </strong>
        </div>
        <div className="billing-progress">
          <span style={{ width: `${usageAccountsPercent}%` }} />
        </div>
      </div>

      {(billing.is_person_limit_reached || billing.is_account_limit_reached) && (
        <div className="billing-limit-warning">
          <span className="material-symbols-outlined">warning</span>
          <span>
            Dòng họ đã đạt một số giới hạn của gói hiện tại. Hãy nâng cấp để
            tiếp tục mở rộng.
          </span>
        </div>
      )}
    </article>

    <article className="billing-card billing-history-card">
      <div className="billing-card-head">
        <div>
          <span className="billing-kicker">Thanh toán</span>
          <h2>Lịch sử nâng cấp</h2>
        </div>
        <span className="billing-count-pill">{payments.length} giao dịch</span>
      </div>

      {payments.length === 0 ? (
        <div className="billing-empty-state">
          <span className="material-symbols-outlined">receipt_long</span>
          <p>Chưa có giao dịch nào.</p>
        </div>
      ) : (
        <div className="billing-payment-list">
          {payments.map((payment) => (
            <div
              className="billing-payment-row"
              key={payment.id}
              onClick={() => setSelectedPayment(payment)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedPayment(payment);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div>
                <strong>
                  {payment.plan_name || payment.plan_code || "Không rõ"}
                </strong>
                <span>
                  {payment.payer_email || "Không rõ"} ·{" "}
                  {payment.provider || "manual"}
                </span>
              </div>

              <div className="billing-payment-meta">
                <strong>{formatMoney(payment.amount_vnd)}</strong>
                <span>
                  {payment.paid_at
                    ? formatDateTimeVN(payment.paid_at)
                    : "Chưa thanh toán"}
                </span>
              </div>

              <span
                className={`billing-payment-status is-${String(
                  payment.status || "pending"
                ).toLowerCase()}`}
              >
                {payment.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  </section>
)}

{selectedPayment && (
  <section className="billing-card billing-transaction-detail">
    <div className="billing-card-head">
      <div>
        <span className="billing-kicker">Chi tiết giao dịch</span>
        <h2>
          {selectedPayment.plan_name ||
            selectedPayment.plan_code ||
            "Không rõ"}
        </h2>
      </div>

      <button
        type="button"
        className="billing-secondary-btn"
        onClick={() => setSelectedPayment(null)}
      >
        Đóng
      </button>
    </div>

    <div className="billing-info-list is-payment">
      <div>
        <span>Mã giao dịch</span>
        <strong>{selectedPayment.order_code || selectedPayment.id}</strong>
      </div>

      <div>
        <span>Gói</span>
        <strong>
          {selectedPayment.plan_name ||
            selectedPayment.plan_code ||
            "Không rõ"}
        </strong>
      </div>

      <div>
        <span>Số tiền</span>
        <strong>{formatMoney(selectedPayment.amount_vnd)}</strong>
      </div>

      <div>
        <span>Trạng thái</span>
        <strong>{selectedPayment.status || "pending"}</strong>
      </div>

      <div>
        <span>Ngày tạo</span>
        <strong>
          {selectedPayment.created_at
            ? formatDateTimeVN(selectedPayment.created_at)
            : "Không rõ"}
        </strong>
      </div>

      <div>
        <span>Ngày thanh toán</span>
        <strong>
          {selectedPayment.paid_at
            ? formatDateTimeVN(selectedPayment.paid_at)
            : "Chưa thanh toán"}
        </strong>
      </div>

      <div>
        <span>Email thanh toán</span>
        <strong>{selectedPayment.payer_email || "Không rõ"}</strong>
      </div>

      <div>
        <span>Nhà cung cấp</span>
        <strong>{selectedPayment.provider || "manual"}</strong>
      </div>
    </div>

    <div className="billing-transaction-note">
      {getPaymentStatusText(selectedPayment)}
    </div>

    <div className="billing-actions-row">
      <button
        type="button"
        className="billing-primary-btn"
        disabled={
          paymentActionLoading ||
          String(selectedPayment.status || "").toLowerCase() !== "pending" ||
          isPaymentExpired(selectedPayment) ||
          isPlanDowngrade(selectedPayment.plan_code)
        }
        onClick={() => handlePaySelectedPayment(selectedPayment)}
      >
        {String(selectedPayment.status || "").toLowerCase() === "paid"
          ? "Đã thanh toán"
          : isPaymentExpired(selectedPayment)
            ? "Giao dịch đã hủy"
            : isPlanDowngrade(selectedPayment.plan_code)
              ? "Không thể thanh toán gói thấp hơn"
              : "Thanh toán giao dịch này"}
      </button>

      {String(selectedPayment.status || "").toLowerCase() === "pending" &&
        !isPaymentExpired(selectedPayment) && (
          <button
            type="button"
            className="billing-danger-btn"
            disabled={paymentActionLoading}
            onClick={() => handleCancelPendingPayment(selectedPayment)}
          >
            {paymentActionLoading ? "Đang xử lý..." : "Hủy giao dịch"}
          </button>
        )}
    </div>
  </section>
)}
      {paymentDialog && (
        <section className="billing-card billing-payment-dialog">
          <div className="billing-card-head">
            <div>
              <span className="billing-kicker">Thanh toán SePay</span>
              <h2>{paymentDialog.plan?.name}</h2>
            </div>
            <span className="billing-status-badge">{paymentDialog.status}</span>
          </div>

          <div className="billing-payment-content">
            <div>
              <div className="billing-info-list is-payment">
                <div><span>Số tiền</span><strong>{formatMoney(paymentDialog.amountVnd)}</strong></div>
                <div><span>Nội dung chuyển khoản</span><strong>{paymentDialog.transferContent}</strong></div>
                <div><span>Tài khoản nhận</span><strong>{paymentDialog.bankAccount || "Chưa cấu hình"} - {paymentDialog.accountName || "Chưa cấu hình"}</strong></div>
              </div>
              <div className="billing-actions-row">
                <button type="button" className="billing-primary-btn" onClick={checkCurrentPaymentStatus} disabled={paymentChecking}>
                  {paymentChecking ? "Đang kiểm tra..." : "Tôi đã thanh toán - kiểm tra"}
                </button>
                <button type="button" className="billing-secondary-btn" onClick={() => setPaymentDialog(null)}>
                  Đóng
                </button>
              </div>
            </div>
            {paymentDialog.qrUrl ? (
              <div className="billing-qr-box">
                <img src={paymentDialog.qrUrl} alt="QR thanh toán SePay" />
                <span>Quét mã để thanh toán</span>
              </div>
            ) : (
              <div className="billing-qr-box is-empty">Chưa tạo được mã QR.</div>
            )}
          </div>
        </section>
      )}
      {message && (
        <section
          className={`billing-alert ${
            message.includes("thành công") || message.includes("Đã nâng cấp")
              ? "billing-alert--success"
              : "billing-alert--error"
          }`}
        >
          <span className="material-symbols-outlined">
            {message.includes("thành công") || message.includes("Đã nâng cấp")
              ? "check_circle"
              : "error"}
          </span>
          <div>{message}</div>
        </section>
      )}

      <section className="billing-plans-section">
  <div className="billing-section-title">
    <span className="billing-kicker">Danh sách gói</span>
    <h2>Chọn gói phù hợp với quy mô dòng họ</h2>
  </div>
        <div className="billing-plan-grid">
          {plans.map((plan) => {
            const isCurrent = billing?.plan_code === plan.code;
            const isDowngrade = isPlanDowngrade(plan.code);
            const hasActivePending = Boolean(activePendingPayment);
            const isFeatured = String(plan.code || "").toLowerCase().includes("pro") || String(plan.name || "").toLowerCase().includes("pro");

            return (
              <article key={plan.id} className={`billing-plan-card ${isCurrent ? "is-current" : ""} ${isFeatured ? "is-featured" : ""}`}>
                {isCurrent && <span className="billing-plan-ribbon">Đang dùng</span>}
                {isFeatured && !isCurrent && <span className="billing-plan-ribbon is-featured-ribbon">Phổ biến</span>}
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <div className="billing-plan-price">
                  <strong>{formatMoney(plan.price_vnd)}</strong>
                  {plan.billing_cycle === "monthly" ? <span>/tháng</span> : null}
                </div>
                <ul>
                  <li><span className="material-symbols-outlined">account_tree</span>{plan.person_limit} hồ sơ trong cây gia phả</li>
                  <li><span className="material-symbols-outlined">group</span>{plan.account_limit} tài khoản đăng nhập</li>
                </ul>

                {isCurrent ? (
                  <button type="button" className="billing-disabled-btn" disabled>Gói hiện tại</button>
                ) : isAdmin ? (
                  <button
                    type="button"
                    className="billing-primary-btn"
                    onClick={async () => {
                      const ok = window.confirm(`Nâng cấp thử nghiệm cây gia phả #${clanId} lên gói ${plan.name}?`);
                      if (!ok) return;
                      try {
                        setMessage("");
                        await manualUpgradeClan(clanId, { plan_code: plan.code, months: 1 });
                        await loadBillingForClan(clanId);
                        setMessage(`Đã nâng cấp thử nghiệm cây gia phả #${clanId} lên gói ${plan.name}.`);
                      } catch (error) {
                        setMessage(error.message || "Không thể nâng cấp thử nghiệm.");
                      }
                    }}
                  >
                    Nâng cấp thử nghiệm
                  </button>
                ) : (
                  <button
                    type="button"
                    className="billing-primary-btn"
                    disabled={hasActivePending || isDowngrade}
                    onClick={() => handleCreateSepayPayment(plan)}
                  >
                    {hasActivePending
                      ? "Đang có giao dịch chờ"
                      : isDowngrade
                        ? "Không thể hạ gói"
                        : "Nâng cấp ngay"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
