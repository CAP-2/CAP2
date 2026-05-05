import { useEffect, useState } from "react";
import { formatDateTimeVN, formatDateVN } from "../../utils/dateFormat";
import {
  getBillingPlans,
  getClanBilling,
  getClanPayments,
  manualUpgradeClan,
} from "../../api/billingService";
import { getStats, getManagerTree } from "../../api/managerService";
import { getAdminClans } from "../../api/adminService";
import {
  createSepayPayment,
  getPaymentStatus,
} from "../../api/paymentService";

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

  const currentRole = getCurrentUserRole();
  const isAdmin = currentRole === "admin";

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

    await loadBillingForClan(nextClanId);
  };

  const handleCreateSepayPayment = async (plan) => {
    try {
      setMessage("");

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

  useEffect(() => {
    loadInitialData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Gói sử dụng</h1>
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Gói sử dụng dòng họ</h1>

      <p style={{ fontSize: 13, color: "#666" }}>
        Debug role: <b>{currentRole || "không xác định"}</b>
      </p>

      {isAdmin && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            borderRadius: 8,
            color: "#1e3a8a",
          }}
        >
          <div style={{ marginBottom: 10 }}>
            Bạn đang dùng tài khoản admin. Hãy chọn cây gia phả cần kiểm tra gói.
            Nút “Nâng cấp thử nghiệm” chỉ dùng để test nội bộ, không phải thanh toán thật.
          </div>

          <label
            style={{
              display: "block",
              marginBottom: 6,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            Chọn cây gia phả
          </label>

          <select
            value={clanId || ""}
            onChange={handleClanChange}
            style={{
              width: "100%",
              maxWidth: 420,
              padding: "10px 12px",
              border: "1px solid #93c5fd",
              borderRadius: 8,
              background: "#fff",
              color: "#111827",
              fontWeight: 600,
            }}
          >
            {adminClans.map((clan) => (
              <option key={clan.id} value={clan.id}>
                #{clan.id} - {getClanName(clan)}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isAdmin && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            borderRadius: 8,
            color: "#78350f",
          }}
        >
          Thanh toán SePay đang được bật. Tài khoản manager có thể nâng cấp gói
          cho dòng họ của mình bằng chuyển khoản VietQR.
        </div>
      )}

      {message && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            border: message.includes("thành công")
              ? "1px solid #bbf7d0"
              : "1px solid #f5c2c7",
            background: message.includes("thành công") ? "#f0fdf4" : "#f8d7da",
            borderRadius: 8,
            color: message.includes("thành công") ? "#14532d" : "#842029",
          }}
        >
          {message}
        </div>
      )}

      {billingLoading && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            border: "1px solid #ddd",
            background: "#fff",
            borderRadius: 8,
            color: "#111827",
          }}
        >
          Đang tải gói sử dụng của cây gia phả đã chọn...
        </div>
      )}

      {billing && (
        <section
          style={{
            marginBottom: 24,
            padding: 20,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#fff",
            color: "#111827",
          }}
        >
          <h2>Gói hiện tại: {billing.plan_name}</h2>

          <p>
            Clan ID: <b>{clanId}</b>
          </p>

          <p>
            Trạng thái: <b>{billing.status}</b>
          </p>

          <p>
            Hồ sơ trong cây gia phả:{" "}
            <b>
              {billing.current_people} / {billing.person_limit}
            </b>
          </p>

          <p>
            Tài khoản đăng nhập:{" "}
            <b>
              {billing.current_accounts} / {billing.account_limit}
            </b>
          </p>

          <p>
            Ngày hết hạn:{" "}
            <b>
              {billing.expires_at
                ? formatDateVN(billing.expires_at)
                : "Không giới hạn"}
            </b>
          </p>

          {billing.is_person_limit_reached && (
            <p style={{ color: "#dc3545", fontWeight: 600 }}>
              Dòng họ đã đạt giới hạn hồ sơ trong cây gia phả của gói hiện tại.
            </p>
          )}

          {billing.is_account_limit_reached && (
            <p style={{ color: "#dc3545", fontWeight: 600 }}>
              Dòng họ đã đạt giới hạn tài khoản đăng nhập của gói hiện tại.
            </p>
          )}
        </section>
      )}

      <section
        style={{
          marginBottom: 24,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
          color: "#111827",
        }}
      >
        <h2>Lịch sử nâng cấp / thanh toán</h2>

        {payments.length === 0 ? (
          <p>Chưa có giao dịch nào.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    Gói
                  </th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    Người thao tác
                  </th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    Nhà cung cấp
                  </th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    Mã đơn
                  </th>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #ddd" }}>
                    Số tiền
                  </th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    Trạng thái
                  </th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    Ngày thanh toán
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                      {payment.plan_name || payment.plan_code || "Không rõ"}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                      {payment.payer_email || "Không rõ"}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                      {payment.provider || "manual"}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                      {payment.order_code}
                    </td>

                    <td
                      style={{
                        padding: 10,
                        borderBottom: "1px solid #eee",
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {formatMoney(payment.amount_vnd)}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                      {payment.status}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                      {payment.paid_at
                        ? formatDateTimeVN(payment.paid_at)
                        : "Chưa thanh toán"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {paymentDialog && (
        <section
          style={{
            marginBottom: 24,
            padding: 20,
            border: "1px solid #bbf7d0",
            borderRadius: 12,
            background: "#f0fdf4",
            color: "#14532d",
          }}
        >
          <h2>Thanh toán SePay</h2>

          <p>
            Gói: <b>{paymentDialog.plan?.name}</b>
          </p>

          <p>
            Số tiền: <b>{formatMoney(paymentDialog.amountVnd)}</b>
          </p>

          <p>
            Nội dung chuyển khoản:
            <br />
            <b
              style={{
                display: "inline-block",
                marginTop: 6,
                padding: "6px 10px",
                borderRadius: 8,
                background: "#dcfce7",
                color: "#166534",
                letterSpacing: 0.3,
              }}
            >
              {paymentDialog.transferContent}
            </b>
          </p>

          <p>
            Tài khoản nhận:{" "}
            <b>
              {paymentDialog.bankAccount || "Chưa cấu hình"} -{" "}
              {paymentDialog.accountName || "Chưa cấu hình"}
            </b>
          </p>

          {paymentDialog.qrUrl ? (
            <div style={{ margin: "16px 0" }}>
              <img
                src={paymentDialog.qrUrl}
                alt="QR thanh toán SePay"
                style={{
                  width: 260,
                  maxWidth: "100%",
                  border: "1px solid #86efac",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 8,
                }}
              />
            </div>
          ) : (
            <p style={{ color: "#b91c1c", fontWeight: 600 }}>
              Chưa tạo được mã QR. Kiểm tra cấu hình SEPAY_BANK_BIN và
              SEPAY_BANK_ACCOUNT.
            </p>
          )}

          <p>
            Trạng thái: <b>{paymentDialog.status}</b>
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={checkCurrentPaymentStatus}
              disabled={paymentChecking}
              style={{
                padding: "10px 12px",
                border: "none",
                borderRadius: 8,
                background: "#15803d",
                color: "#fff",
                cursor: paymentChecking ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {paymentChecking ? "Đang kiểm tra..." : "Tôi đã thanh toán - kiểm tra"}
            </button>

            <button
              type="button"
              onClick={() => setPaymentDialog(null)}
              style={{
                padding: "10px 12px",
                border: "1px solid #86efac",
                borderRadius: 8,
                background: "#fff",
                color: "#166534",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Đóng
            </button>
          </div>
        </section>
      )}

      <h2>Danh sách gói</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {plans.map((plan) => {
          const isCurrent = billing?.plan_code === plan.code;

          return (
            <div
              key={plan.id}
              style={{
                padding: 20,
                border: isCurrent ? "2px solid #0d6efd" : "1px solid #ddd",
                borderRadius: 12,
                background: "#fff",
                color: "#111827",
                minHeight: 240,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3>{plan.name}</h3>

                <p>{plan.description}</p>

                <p>
                  Giá:{" "}
                  <b>
                    {formatMoney(plan.price_vnd)}
                    {plan.billing_cycle === "monthly" ? "/tháng" : ""}
                  </b>
                </p>

                <p>{plan.person_limit} hồ sơ trong cây gia phả</p>
                <p>{plan.account_limit} tài khoản đăng nhập</p>
              </div>

              {isCurrent ? (
                <button
                  type="button"
                  disabled
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    background: "#e5e7eb",
                    color: "#6b7280",
                    fontWeight: 600,
                  }}
                >
                  Gói hiện tại
                </button>
              ) : isAdmin ? (
                <button
                  type="button"
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    border: "none",
                    borderRadius: 8,
                    background: "#2563eb",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  onClick={async () => {
                    const ok = window.confirm(
                      `Nâng cấp thử nghiệm cây gia phả #${clanId} lên gói ${plan.name}?`
                    );

                    if (!ok) return;

                    try {
                      setMessage("");

                      await manualUpgradeClan(clanId, {
                        plan_code: plan.code,
                        months: 1,
                      });

                      await loadBillingForClan(clanId);

                      setMessage(
                        `Đã nâng cấp thử nghiệm cây gia phả #${clanId} lên gói ${plan.name}.`
                      );
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
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    border: "none",
                    borderRadius: 8,
                    background: "#16a34a",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  onClick={() => handleCreateSepayPayment(plan)}
                >
                  Nâng cấp ngay
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
