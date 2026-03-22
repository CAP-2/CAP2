const BASE_URL = "/api";

export const getPendingUsers = async() => {
    try {
        // Nếu Backend của bạn viết là app.get('/pending-users', ...) 
        // thì gọi qua Proxy sẽ là `${BASE_URL}/pending-users`
        const res = await fetch(`${BASE_URL}/pending-users`);

        if (!res.ok) throw new Error("Không thể lấy danh sách người dùng chờ duyệt");

        return await res.json();
    } catch (error) {
        console.error("Lỗi getPendingUsers:", error);
        throw error;
    }
};

export const approveUserAPI = async(id) => {
    try {
        const res = await fetch(`${BASE_URL}/approve/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        if (!res.ok) throw new Error("Duyệt người dùng thất bại");

        return await res.json();
    } catch (error) {
        console.error("Lỗi approveUserAPI:", error);
        throw error;
    }
};