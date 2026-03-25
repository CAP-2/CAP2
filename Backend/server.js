require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// KẾT NỐI CLOUD AIVEN
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 16931,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10
});

// Kiểm tra kết nối khi khởi động
db.getConnection((err, conn) => {
    if (err) {
        console.error("❌ Lỗi kết nối Database Aiven:", err.message);
    } else {
        console.log("✅ Đã kết nối Database Aiven thành công!");
        conn.release();
    }
});

// ==========================================
// 1. LOGIC ĐĂNG KÝ (FIXED)
// ==========================================
app.post('/register', async(req, res) => {
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

        db.query(sqlPeople, [clan_id || 1, display_name, first_name, middle_name, surname, gender, birth_date, hometown], (err, result) => {
            if (err) {
                console.error("❌ LỖI DATABASE (BẢNG PEOPLE):", err.sqlMessage || err);
                return res.status(400).json({ message: "Lỗi dữ liệu cá nhân: " + (err.sqlMessage || "") });
            }

            const personId = result.insertId;

            // Bước 2: Chèn vào bảng accounts
            const sqlAccount = `INSERT INTO accounts (email, password, person_id, role_id) VALUES (?, ?, ?, 3)`;

            db.query(sqlAccount, [email, hashedPassword, personId], (err2) => {
                if (err2) {
                    console.error("❌ LỖI DATABASE (BẢNG ACCOUNTS):", err2.sqlMessage || err2);
                    return res.status(400).json({ message: "Lỗi tài khoản: " + (err2.sqlMessage || "Email đã tồn tại") });
                }
                res.json({ success: true, message: "Đăng ký thành công!" });
            });
        });
    } catch (e) {
        console.error("❌ LỖI HỆ THỐNG:", e);
        res.status(500).json({ message: "Lỗi hệ thống nghiêm trọng!" });
    }
});

// ==========================================
// 2. LOGIC ĐĂNG NHẬP 
// ==========================================

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // DEBUG 1: Xem React gửi gì lên
    console.log("--- BƯỚC 1: DỮ LIỆU TỪ REACT ---");
    console.log("Email:", email);
    console.log("Password nhập vào:", password);

    const sql = `SELECT a.*, p.display_name FROM accounts a 
                 LEFT JOIN people p ON a.person_id = p.id 
                 WHERE a.email = ?`;

    db.query(sql, [email], async(err, results) => {
        if (err) return res.status(500).json({ message: "Lỗi Server" });

        if (results.length > 0) {
            const user = results[0];

            // DEBUG 2: Xem Database trả về gì
            console.log("--- BƯỚC 2: DỮ LIỆU TỪ DATABASE ---");
            console.log("Password Hash trong DB:", user.password);
            console.log("Độ dài chuỗi Hash:", user.password ? user.password.length : 0);

            try {
                const match = await bcrypt.compare(password, user.password);
                console.log("--- BƯỚC 3: KẾT QUẢ SO SÁNH ---");
                console.log("Khớp mật khẩu không?:", match);

                if (match) {
                    res.json({ success: true, user: { id: user.id, role_id: user.role_id } });
                } else {
                    res.status(401).json({ message: "Mật khẩu không chính xác!" });
                }
            } catch (e) {
                console.log("Lỗi Bcrypt:", e.message);
                res.status(500).json({ message: "Lỗi mã hóa" });
            }
        } else {
            res.status(404).json({ message: "Tài khoản không tồn tại!" });
        }
    });
});

// ==========================================
// 3. DANH SÁCH CHỜ & PHÊ DUYỆT
// ==========================================
app.get('/pending-users', (req, res) => {
    const sql = `
        SELECT a.id as account_id, p.first_name, p.surname, a.email, p.birth_date, p.clan_id 
        FROM accounts a
        JOIN people p ON a.person_id = p.id
        WHERE a.role_id = 3`;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json([]);
        res.json(results);
    });
});

app.post('/approve/:id', (req, res) => {
    const accountId = req.params.id;
    const sql = "UPDATE accounts SET role_id = 2 WHERE id = ?";
    db.query(sql, [accountId], (err, result) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.listen(5000, () => console.log('🚀 Backend chạy tại http://localhost:5000'));