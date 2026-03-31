const BASE_URL = "/api/manager";

/**
 * Lấy Header chứa Token xác thực từ LocalStorage
 */
const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// --- QUẢN LÝ THỐNG KÊ & THÀNH VIÊN ---

export const getStats = async () => {
    try {
        const res = await fetch(`${BASE_URL}/stats`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Không thể lấy thống kê manager");
        return await res.json();
    } catch (error) {
        console.error("Lỗi getStats:", error);
        throw error;
    }
};

export const getMembers = async () => {
    try {
        const res = await fetch(`${BASE_URL}/members`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Không thể lấy danh sách thành viên");
        return await res.json();
    } catch (error) {
        console.error("Lỗi getMembers:", error);
        throw error;
    }
};

/** Tạo thành viên mới (account active + people). Manager: tự gắn clan; Admin: gửi clan_id trong body. */
export const createMember = async (payload) => {
    try {
        const res = await fetch(`${BASE_URL}/members`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders(),
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Không thể tạo thành viên");
        return data;
    } catch (error) {
        console.error("Lỗi createMember:", error);
        throw error;
    }
};

/** Lấy quan hệ huyết thống (cha/mẹ) + hôn nhân (vợ/chồng, con) của một thành viên (account_id). */
export const getMemberRelations = async (accountId) => {
    try {
        const res = await fetch(`${BASE_URL}/members/${accountId}/relations`, { headers: getAuthHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Không thể lấy quan hệ thành viên");
        return data;
    } catch (error) {
        console.error("Lỗi getMemberRelations:", error);
        throw error;
    }
};

/**
 * @param {number} accountId — account_id của thành viên
 * @param {{ mode: 'bloodline'|'marriage', parent_father_id?: number|null, parent_mother_id?: number|null, family_id?: number|null, spouse_id?: number|null, children_ids?: number[]|string }} body
 */
export const updateMemberRelations = async (accountId, body) => {
    try {
        const res = await fetch(`${BASE_URL}/members/${accountId}/relations`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders(),
            },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Không thể lưu quan hệ");
        return data;
    } catch (error) {
        console.error("Lỗi updateMemberRelations:", error);
        throw error;
    }
};

export const getMemberDetail = async (accountId) => {
    try {
        const res = await fetch(`${BASE_URL}/members/${accountId}`, { headers: getAuthHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Không thể lấy chi tiết thành viên");
        return data;
    } catch (error) {
        console.error("Lỗi getMemberDetail:", error);
        throw error;
    }
};

export const updateMemberByManager = async (accountId, body) => {
    try {
        const res = await fetch(`${BASE_URL}/members/${accountId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders(),
            },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Không thể cập nhật thành viên");
        return data;
    } catch (error) {
        console.error("Lỗi updateMemberByManager:", error);
        throw error;
    }
};

// --- QUẢN LÝ NGƯỜI DÙNG (CHỜ DUYỆT/DUYỆT/TỪ CHỐI) ---

export const getPendingUsers = async () => {
    try {
        const res = await fetch(`${BASE_URL}/pending`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Không thể lấy danh sách người dùng chờ duyệt");
        return await res.json();
    } catch (error) {
        console.error("Lỗi getPendingUsers:", error);
        throw error;
    }
};

export const approveUserAPI = async (id) => {
    try {
        const res = await fetch(`${BASE_URL}/approve/${id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders(),
            },
        });
        if (!res.ok) throw new Error("Duyệt người dùng thất bại");
        return await res.json();
    } catch (error) {
        console.error("Lỗi approveUserAPI:", error);
        throw error;
    }
};

export const rejectUserAPI = async (id) => {
    try {
        const res = await fetch(`${BASE_URL}/reject/${id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders(),
            },
        });
        if (!res.ok) throw new Error("Từ chối người dùng thất bại");
        return await res.json();
    } catch (error) {
        console.error("Lỗi rejectUserAPI:", error);
        throw error;
    }
};

// --- QUẢN LÝ BÀI VIẾT (PENDING POSTS) ---

export const getPendingPosts = async () => {
    try {
        const res = await fetch(`${BASE_URL}/pending-posts`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Không thể lấy danh sách bài viết chờ duyệt");
        return await res.json();
    } catch (error) {
        console.error("Lỗi getPendingPosts:", error);
        throw error;
    }
};

export const approvePostAPI = async (id) => {
    try {
        const res = await fetch(`${BASE_URL}/approve-post/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        });
        if (!res.ok) throw new Error("Phê duyệt bài viết thất bại");
        return await res.json();
    } catch (error) {
        console.error("Lỗi approvePostAPI:", error);
        throw error;
    }
};

export const rejectPostAPI = async (id) => {
    try {
        const res = await fetch(`${BASE_URL}/reject-post/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        });
        if (!res.ok) throw new Error("Từ chối bài viết thất bại");
        return await res.json();
    } catch (error) {
        console.error("Lỗi rejectPostAPI:", error);
        throw error;
    }
};

// --- QUẢN LÝ TRUYỀN THÔNG (MEDIA) ---

export const getMediaAPI = async () => {
    try {
        const res = await fetch(`${BASE_URL}/media`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Không thể lấy dữ liệu truyền thông (Media)");
        return await res.json();
    } catch (error) {
        console.error("Lỗi getMediaAPI:", error);
        throw error;
    }
};