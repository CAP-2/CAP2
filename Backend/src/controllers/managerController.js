const db = require('../config/db');

exports.getStats = async (req, res) => {
    try {
        // Thống kê nhiều thông tin của manager
        const [counts] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM accounts WHERE role_id IN (2,3) AND status = 'active') AS total_members,
                (SELECT COUNT(*) FROM accounts WHERE role_id = 2 AND status = 'active') AS total_managers,
                (SELECT COUNT(*) FROM accounts WHERE status = 'pending') AS total_pending
        `);

        res.json(counts[0]);
    } catch (error) {
        console.error('getStats error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy thống kê' });
    }
};

exports.getAllMembers = async (req, res) => {
    try {
        const sql = `
            SELECT a.id AS account_id, a.email, a.role_id, a.status,
                   p.first_name, p.surname, p.birth_date, p.clan_id, p.gender
            FROM accounts a
            JOIN people p ON a.person_id = p.id
            WHERE a.role_id IN (2,3) AND a.status = 'active'
            ORDER BY p.surname, p.first_name
        `;

        const [results] = await db.query(sql);
        res.json(results);
    } catch (error) {
        console.error('getAllMembers error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách thành viên' });
    }
};

exports.getPendingUsers = async (req, res) => {
    try {
        const sql = `
            SELECT a.id as account_id, a.role_id, a.status, p.first_name, p.surname, a.email, p.birth_date, p.clan_id 
            FROM accounts a
            JOIN people p ON a.person_id = p.id
            WHERE a.status = 'pending'`;

        const [results] = await db.query(sql);
        res.json(results);
    } catch (error) {
        console.error('getPendingUsers error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách chờ' });
    }
};

exports.approveUser = async (req, res) => {
    const accountId = req.params.id;
    try {
        // Duyệt tài khoản: luôn chuyển về active, và với user thường thì giữ role_id = 3
        const sql = "UPDATE accounts SET role_id = 3, status = 'active' WHERE id = ?";
        await db.query(sql, [accountId]);
        res.json({ success: true, message: 'Phê duyệt thành công!' });
    } catch (error) {
        console.error('approveUser error:', error);
        res.status(500).json({ success: false, message: 'Lỗi phê duyệt' });
    }
};

exports.rejectUser = async (req, res) => {
    const accountId = req.params.id;
    try {
        const sql = "UPDATE accounts SET status = 'rejected' WHERE id = ?";
        await db.query(sql, [accountId]);
        res.json({ success: true, message: 'Đã từ chối tài khoản (chuyển trạng thái rejected)' });
    } catch (error) {
        console.error('rejectUser error:', error);
        res.status(500).json({ success: false, message: 'Lỗi từ chối' });
    }
};