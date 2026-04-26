const BASE_URL = "/api/admin";

const getAuthHeaders = () => {
  const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getAdminClans = async () => {
  const res = await fetch(`${BASE_URL}/clans`, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không lấy được danh sách dòng họ");
  return data;
};

export const getAdminClanTree = async (clanId) => {
  const res = await fetch(`${BASE_URL}/clans/${clanId}/tree`, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không tải được cây phả hệ");
  return data;
};

export const getAdminAccounts = async () => {
  const res = await fetch(`${BASE_URL}/accounts`, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không lấy được danh sách tài khoản");
  return data;
};

export const updateAdminAccountAccess = async (accountId, body) => {
  const res = await fetch(`${BASE_URL}/accounts/${accountId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Cập nhật thất bại");
  return data;
};

export const createAdminManager = async (body) => {
  const res = await fetch(`${BASE_URL}/managers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Tạo manager thất bại");
  return data;
};
