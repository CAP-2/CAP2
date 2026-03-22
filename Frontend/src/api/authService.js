const BASE_URL = "/api";

export const loginAPI = async(data) => {
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        // Kiểm tra nếu response không ổn (ví dụ sai pass, user không tồn tại)
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Đăng nhập thất bại");
        }

        return await res.json();
    } catch (error) {
        console.error("Lỗi Login API:", error);
        throw error;
    }
};

export const registerAPI = async(data) => {
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Đăng ký thất bại");
        }

        return await res.json();
    } catch (error) {
        console.error("Lỗi Register API:", error);
        throw error;
    }
};