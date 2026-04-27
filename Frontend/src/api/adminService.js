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

// Quản lý Thành viên
export const getAdminMembers = async () => {
  const res = await fetch(`${BASE_URL}/members`, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không lấy được danh sách thành viên");
  return data;
};

export const updateAdminMember = async (id, body) => {
  const res = await fetch(`${BASE_URL}/members/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Cập nhật thành viên thất bại");
  return data;
};

export const deleteAdminMember = async (id) => {
  const res = await fetch(`${BASE_URL}/members/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Xóa thành viên thất bại");
  return data;
};

// Quản lý Cài đặt
export const getAdminSettings = async () => {
  const res = await fetch(`${BASE_URL}/settings`, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không lấy được cài đặt");
  return data;
};

export const updateAdminSettings = async (body) => {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Cập nhật cài đặt thất bại");
  return data;
};

// Quản lý Sự kiện
export const getAdminEvents = async () => {
  const res = await fetch(`${BASE_URL}/events`, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không lấy được danh sách sự kiện");
  return data;
};

export const createAdminEvent = async (body) => {
  const res = await fetch(`${BASE_URL}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Tạo sự kiện thất bại");
  return data;
};

export const updateAdminEvent = async (id, body) => {
  const res = await fetch(`${BASE_URL}/events/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Cập nhật sự kiện thất bại");
  return data;
};

export const deleteAdminEvent = async (id) => {
  const res = await fetch(`${BASE_URL}/events/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Xóa sự kiện thất bại");
  return data;
};

// Quản lý Thư viện
export const getAdminGallery = async () => {
  const res = await fetch(`${BASE_URL}/gallery`, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không lấy được danh sách ảnh");
  return data;
};

export const deleteAdminGalleryItem = async (id) => {
  const res = await fetch(`${BASE_URL}/gallery/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Xóa ảnh thất bại");
  return data;
};

export const getAdminDashboardStats = async () => {
  const res = await fetch(`${BASE_URL}/dashboard-stats`, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không lấy được thống kê");
  return data;
};
