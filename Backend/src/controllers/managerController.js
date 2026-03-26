const db = require('../config/db');

exports.getPendingUsers = async (req, res) => {
    try {
        const sql = `
            SELECT a.id as account_id, p.first_name, p.surname, a.email, p.birth_date, p.clan_id 
            FROM accounts a
            JOIN people p ON a.person_id = p.id
            WHERE a.role_id = 3`;

        const [results] = await db.query(sql);
        res.json(results);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi lấy danh sách chờ"
        });
    }
};

exports.approveUser = async (req, res) => {
    const accountId = req.params.id;
    try {
        // Nâng cấp role_id từ 3 (Pending) lên 2 (Manager) hoặc 4 (User) tùy bạn thiết kế
        const sql = "UPDATE accounts SET role_id = 2 WHERE id = ?";
        await db.query(sql, [accountId]);
        res.json({
            success: true,
            message: "Phê duyệt thành công!"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi phê duyệt"
        });
    }
};