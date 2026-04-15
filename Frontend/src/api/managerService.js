const BASE_URL = "/api/manager";

const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// --- QUẢN LÝ THỐNG KÊ & THÀNH VIÊN ---
export const getStats = async () => {
    const res = await fetch(`${BASE_URL}/stats`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Không thể lấy thống kê manager");
    return await res.json();
};

export const getMembers = async () => {
    const res = await fetch(`${BASE_URL}/members`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Không thể lấy danh sách thành viên");
    return await res.json();
};

export const createMember = async (payload) => {
    const res = await fetch(`${BASE_URL}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Không thể tạo thành viên");
    return data;
};

export const getMemberRelations = async (accountId) => {
    const res = await fetch(`${BASE_URL}/members/${accountId}/relations`, { headers: getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Không thể lấy quan hệ thành viên");
    return data;
};

export const updateMemberRelations = async (accountId, body) => {
    const res = await fetch(`${BASE_URL}/members/${accountId}/relations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Không thể lưu quan hệ");
    return data;
};

export const getMemberDetail = async (accountId) => {
    const res = await fetch(`${BASE_URL}/members/${accountId}`, { headers: getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Không thể lấy chi tiết thành viên");
    return data;
};

export const updateMemberByManager = async (accountId, body) => {
    const res = await fetch(`${BASE_URL}/members/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Không thể cập nhật thành viên");
    return data;
};

export const archiveMemberAPI = async (accountId, reason) => {
    const res = await fetch(`${BASE_URL}/members/${accountId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Không thể lưu trữ thành viên");
    return data;
};

export const getArchivedMembersAPI = async () => {
    const res = await fetch(`${BASE_URL}/members-archive`, { headers: getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Không thể lấy kho lưu trữ thành viên");
    return data;
};

export const deleteArchivedMemberAPI = async (archiveId) => {
    const res = await fetch(`${BASE_URL}/members-archive/${archiveId}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Không thể xóa vĩnh viễn bản ghi lưu trữ");
    return data;
};

export const restoreArchivedMemberAPI = async (archiveId) => {
    const res = await fetch(`${BASE_URL}/members-archive/${archiveId}/restore`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Không thể phục hồi thành viên");
    return data;
};

// --- QUẢN LÝ NGƯỜI DÙNG CHỜ DUYỆT ---
export const getPendingUsers = async () => {
    const res = await fetch(`${BASE_URL}/pending`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Không thể lấy danh sách người dùng chờ duyệt");
    return await res.json();
};

export const approveUserAPI = async (id) => {
    const res = await fetch(`${BASE_URL}/approve/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error("Duyệt người dùng thất bại");
    return await res.json();
};

export const rejectUserAPI = async (id) => {
    const res = await fetch(`${BASE_URL}/reject/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error("Từ chối người dùng thất bại");
    return await res.json();
};

// --- QUẢN LÝ BÀI VIẾT (PENDING POSTS) ---
export const getPendingPosts = async () => {
    const res = await fetch(`${BASE_URL}/pending-posts`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Không thể lấy danh sách bài viết chờ duyệt");
    return await res.json();
};

export const approvePostAPI = async (id) => {
    const res = await fetch(`${BASE_URL}/approve-post/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error("Phê duyệt bài viết thất bại");
    return await res.json();
};

export const rejectPostAPI = async (id, reason) => {
    const res = await fetch(`${BASE_URL}/reject-post/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error("Từ chối bài viết thất bại");
    return await res.json();
};

// --- QUẢN LÝ TRUYỀN THÔNG (MEDIA) ---
export const getMediaAPI = async () => {
    const res = await fetch(`${BASE_URL}/media`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Không thể lấy dữ liệu truyền thông");
    return await res.json();
};

// --- CÁC HÀM MỚI CHO LINEAGE MANAGEMENT & TASKS ---
export const createPersonAPI = async (data) => {
    const res = await fetch(`${BASE_URL}/people/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Tạo thành viên thất bại");
    return await res.json();
};

export const linkRelationsAPI = async (data) => {
    const res = await fetch(`${BASE_URL}/people/link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Liên kết thất bại");
    return await res.json();
};

export const assignTaskAPI = async (data) => {
    const res = await fetch(`${BASE_URL}/assign-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Giao việc thất bại");
    return await res.json();
};

export const getTasksAPI = async () => {
    const res = await fetch(`${BASE_URL}/tasks`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Lấy danh sách việc thất bại");
    return await res.json();
};

// --- QUẢN LÝ THAY ĐỔI HỒ SƠ (PROFILE UPDATES) ---
export const getPendingProfileUpdates = async () => {
    const res = await fetch(`${BASE_URL}/pending-profiles`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Không thể lấy danh sách cập nhật hồ sơ");
    return await res.json();
};

export const approveProfileUpdateAPI = async (id) => {
    const res = await fetch(`${BASE_URL}/approve-profile/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error("Phê duyệt hồ sơ thất bại");
    return await res.json();
};

export const rejectProfileUpdateAPI = async (id, reason) => {
    const res = await fetch(`${BASE_URL}/reject-profile/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error("Từ chối hồ sơ thất bại");
    return await res.json();
};