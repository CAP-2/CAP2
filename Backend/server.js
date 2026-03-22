require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();

// 3. Middleware
app.use(cors()); // Bây giờ biến 'cors' đã được định nghĩa, sẽ không còn lỗi ReferenceError
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. KẾT NỐI CLOUD AIVEN (Dùng biến môi trường để Git không chặn)
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

// Kiểm tra kết nối
db.getConnection((err, conn) => {
    if (err) {
        console.error("❌ Lỗi kết nối Database Aiven:");
        console.error("- Kiểm tra xem file .env có nằm cùng thư mục với server.js không?");
        console.error("- Chi tiết lỗi:", err.message);
    } else {
        console.log("✅ Đã kết nối Database Aiven thành công!");
        conn.release();
    }
});

// 2. LOGIC ĐĂNG KÝ (Trả về JSON thay vì redirect)
app.post('/register', async(req, res) => {
    const { first_name, last_name, email, password, dob, gender, target_tree_id } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (first_name, last_name, email, password_hash, date_of_birth, gender, target_tree_id, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`;

        db.query(sql, [first_name, last_name, email, hashedPassword, dob, gender, target_tree_id], (err) => {
            if (err) return res.status(400).json({ message: "Email đã tồn tại hoặc dữ liệu sai!" });
            // Gửi JSON thành công để React biết đường chuyển trang
            res.json({ success: true, message: "Đăng ký thành công, chờ phê duyệt!" });
        });
    } catch (e) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

// 3. LOGIC ĐĂNG NHẬP (Trả về JSON kèm thông tin User)
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], async(err, results) => {
        if (err) return res.status(500).json({ message: "Lỗi Server" });
        if (results.length > 0) {
            const user = results[0];

            if (user.status === 'pending') {
                return res.status(403).json({ message: "Tài khoản đang chờ phê duyệt!" });
            }
            if (user.status === 'rejected') {
                return res.status(403).json({ message: "Yêu cầu đã bị từ chối." });
            }

            const match = await bcrypt.compare(password, user.password_hash);
            if (match) {
                // Trả về dữ liệu user để React lưu vào localStorage/State
                res.json({
                    success: true,
                    user: { id: user.user_id, name: user.first_name, role: user.role_id }
                });
            } else { res.status(401).json({ message: "Sai mật khẩu!" }); }
        } else { res.status(404).json({ message: "Tài khoản không tồn tại!" }); }
    });
});

// 4. API LẤY DANH SÁCH CHỜ
app.get('/pending-users', (req, res) => {
    db.query("SELECT user_id, first_name, last_name, email, date_of_birth, target_tree_id FROM users WHERE status = 'pending'", (err, results) => {
        if (err) return res.status(500).json([]);
        res.json(results);
    });
});

// 5. API PHÊ DUYỆT THÀNH VIÊN
app.post('/approve/:id', (req, res) => {
    const userId = req.params.id;
    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ message: "Lỗi kết nối" });
        connection.beginTransaction((err) => {
            connection.query("UPDATE users SET status = 'active' WHERE user_id = ?", [userId], (err) => {
                if (err) return connection.rollback(() => res.status(500).json({ message: "Lỗi bước 1" }));

                const sqlLink = `INSERT INTO family_tree_members (family_tree_id, user_id)
                                 SELECT target_tree_id, user_id FROM users WHERE user_id = ?`;

                connection.query(sqlLink, [userId], (err) => {
                    if (err) return connection.rollback(() => res.status(500).json({ message: "Lỗi bước 2" }));

                    connection.commit((err) => {
                        if (err) return connection.rollback(() => res.status(500).json({ message: "Lỗi commit" }));
                        res.json({ success: true });
                    });
                });
            });
        });
    });
});

app.listen(3000, () => console.log('🚀 Backend chạy tại http://localhost:3000'));