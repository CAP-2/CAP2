const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// LOGIC ĐĂNG KÝ
exports.register = async (req, res) => {
    const {
        email,
        password,
        display_name,
        first_name,
        middle_name,
        surname,
        birth_date,
        gender,
        hometown,
        clan_id
    } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Bước 1: Chèn vào bảng people
        const sqlPeople = `INSERT INTO people (clan_id, display_name, first_name, middle_name, surname, gender, birth_date, hometown, generation) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;

        const [personResult] = await db.query(sqlPeople, [
            clan_id || 1, display_name, first_name, middle_name, surname, gender, birth_date, hometown
        ]);

        const personId = personResult.insertId;

        // Bước 2: Chèn vào bảng accounts (role_id = 3 là User/Pending)
        const sqlAccount = `INSERT INTO accounts (email, password, person_id, role_id) VALUES (?, ?, ?, 3)`;
        await db.query(sqlAccount, [email, hashedPassword, personId]);

        res.json({
            success: true,
            message: "Đăng ký thành công!"
        });

    } catch (error) {
        console.error("❌ Lỗi Đăng ký:", error);
        res.status(400).json({
            success: false,
            message: error.code === 'ER_DUP_ENTRY' ? "Email đã tồn tại!" : "Lỗi dữ liệu hệ thống"
        });
    }
};

// LOGIC ĐĂNG NHẬP (Đã chỉnh sửa để tạo Token)
exports.login = async (req, res) => {
    const {
        email,
        password
    } = req.body;

    try {
        const sql = `SELECT a.*, p.display_name FROM accounts a 
                     LEFT JOIN people p ON a.person_id = p.id 
                     WHERE a.email = ?`;

        const [results] = await db.query(sql, [email]);

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Tài khoản không tồn tại!"
            });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            // TẠO TOKEN JWT
            const token = jwt.sign({
                    id: user.id,
                    role_id: user.role_id,
                    email: user.email
                },
                process.env.JWT_SECRET, {
                    expiresIn: '24h'
                } // Token hết hạn sau 24 giờ
            );

            // Trả về Token kèm thông tin user cho Frontend
            res.json({
                success: true,
                message: "Đăng nhập thành công!",
                token: token,
                user: {
                    id: user.id,
                    role_id: user.role_id,
                    name: user.display_name
                }
            });
        } else {
            res.status(401).json({
                success: false,
                message: "Mật khẩu không chính xác!"
            });
        }
    } catch (error) {
        console.error("❌ Lỗi Đăng nhập:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi kết nối server"
        });
    }
};