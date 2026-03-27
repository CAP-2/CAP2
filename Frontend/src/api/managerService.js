const BASE_URL = "/api/manager";

const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

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
