const BASE_URL = "/api/auth";

/**
 * ĐĂNG NHẬP
 */
export const loginAPI = async(data) => {
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: data.email,
                password: data.password
            }),
        });

        const text = await res.text();
        let result = {};
        try {
            result = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error("Phản hồi không phải JSON:", text);
        }

        if (!res.ok) {
            throw new Error(result.message || "Email hoặc mật khẩu không chính xác");
        }

        return result;
    } catch (error) {
        console.error("Lỗi Login API:", error.message);
        throw error;
    }
};

/**
 * ĐĂNG KÝ
 */
export const registerAPI = async(data) => {
    try {
        // Đảm bảo các trường số luôn là số để MySQL không báo lỗi 'Incorrect integer value'
        const payload = {
            email: data.email,
            password: data.password,
            display_name: data.display_name,
            first_name: data.first_name,
            middle_name: data.middle_name || "",
            surname: data.surname,
            birth_date: data.birth_date,
            gender: Number(data.gender) || 1, // Dùng Number an toàn hơn parseInt
            hometown: data.hometown,
            clan_id: Number(data.clan_id) || 1,
        };

        const res = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        let result = {};
        try {
            result = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error("Phản hồi không phải JSON:", text);
        }

        if (!res.ok) {
            // Lấy trực tiếp lỗi từ SQL mà chúng ta đã setup ở server.js (err.sqlMessage)
            throw new Error(result.message || "Đăng ký không thành công");
        }

        return result;
    } catch (error) {
        console.error("Lỗi Register API:", error.message);
        throw error;
    }
};