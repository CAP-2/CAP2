const db = require('../config/db');

const getManagerClanId = async (accountId) => {
    const [accountRows] = await db.query(
        `SELECT p.clan_id FROM accounts a JOIN people p ON a.person_id = p.id WHERE a.id = ?`,
        [accountId]
    );
    if (!accountRows || accountRows.length === 0) return null;
    return accountRows[0].clan_id;
};

exports.getStats = async (req, res) => {
    try {
        let totalMembersSql = "SELECT COUNT(*) AS cnt FROM accounts a JOIN people p ON a.person_id = p.id WHERE a.role_id IN (2,3) AND a.status = 'active'";
        let totalManagersSql = "SELECT COUNT(*) AS cnt FROM accounts WHERE role_id = 2 AND status = 'active'";
        let totalPendingSql = "SELECT COUNT(*) AS cnt FROM accounts WHERE status = 'pending'";
        let params = [];

        if (req.user.role_id === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (clanId === null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            totalMembersSql += " AND p.clan_id = ?";
            totalManagersSql = "SELECT COUNT(*) AS cnt FROM accounts a JOIN people p ON a.person_id = p.id WHERE a.role_id = 2 AND a.status = 'active' AND p.clan_id = ?";
            totalPendingSql = "SELECT COUNT(*) AS cnt FROM accounts a JOIN people p ON a.person_id = p.id WHERE a.status = 'pending' AND p.clan_id = ?";
            params = [clanId, clanId, clanId];
        }

        if (req.user.role_id === 1) {
            const [rowsMembers] = await db.query(totalMembersSql);
            const [rowsManagers] = await db.query(totalManagersSql);
            const [rowsPending] = await db.query(totalPendingSql);
            return res.json({
                total_members: rowsMembers[0].cnt,
                total_managers: rowsManagers[0].cnt,
                total_pending: rowsPending[0].cnt,
            });
        }

        const [membersCount] = await db.query(totalMembersSql, [params[0]]);
        const [managerCount] = await db.query(totalManagersSql, [params[1]]);
        const [pendingCount] = await db.query(totalPendingSql, [params[2]]);

        res.json({
            total_members: membersCount[0].cnt,
            total_managers: managerCount[0].cnt,
            total_pending: pendingCount[0].cnt,
        });
    } catch (error) {
        console.error('getStats error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy thống kê' });
    }
};

exports.getAllMembers = async (req, res) => {
    try {
        let sql = `
            SELECT a.id AS account_id, a.email, a.role_id, a.status,
                   p.first_name, p.surname, p.birth_date, p.clan_id, p.gender
            FROM accounts a
            JOIN people p ON a.person_id = p.id
            WHERE a.role_id IN (2,3) AND a.status = 'active'
        `;

        const params = [];

        if (req.user.role_id === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (clanId === null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            sql += ' AND p.clan_id = ?';
            params.push(clanId);
        }

        sql += ' ORDER BY p.surname, p.first_name';

        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (error) {
        console.error('getAllMembers error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách thành viên' });
    }
};

exports.getPendingUsers = async (req, res) => {
    try {
        let sql = `
            SELECT a.id as account_id, a.role_id, a.status, p.first_name, p.surname, a.email, p.birth_date, p.clan_id 
            FROM accounts a
            JOIN people p ON a.person_id = p.id
            WHERE a.status = 'pending'`;

        const params = [];

        if (req.user.role_id === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (clanId === null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            sql += ' AND p.clan_id = ?';
            params.push(clanId);
        }

        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (error) {
        console.error('getPendingUsers error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách chờ' });
    }
};

exports.approveUser = async (req, res) => {
    const accountId = req.params.id;
    try {
        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            const [rows] = await db.query(
                `SELECT p.clan_id FROM accounts a JOIN people p ON a.person_id = p.id WHERE a.id = ?`,
                [accountId]
            );
            if (!rows.length || rows[0].clan_id !== managerClanId) {
                return res.status(403).json({ success: false, message: 'Chỉ được duyệt thành viên cùng dòng họ' });
            }
        }
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
        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            const [rows] = await db.query(
                `SELECT p.clan_id FROM accounts a JOIN people p ON a.person_id = p.id WHERE a.id = ?`,
                [accountId]
            );
            if (!rows.length || rows[0].clan_id !== managerClanId) {
                return res.status(403).json({ success: false, message: 'Chỉ được từ chối thành viên cùng dòng họ' });
            }
        }
        const sql = "UPDATE accounts SET status = 'rejected' WHERE id = ?";
        await db.query(sql, [accountId]);
        res.json({ success: true, message: 'Đã từ chối tài khoản (chuyển trạng thái rejected)' });
    } catch (error) {
        console.error('rejectUser error:', error);
        res.status(500).json({ success: false, message: 'Lỗi từ chối' });
    }
};

exports.getPendingPosts = async (req, res) => {
    try {
        let sql = `
            SELECT p.id as post_id, p.content, p.image_url, p.created_at, author.display_name as author_name, author.email as author_email
            FROM posts p
            JOIN accounts a ON p.author_id = a.id
            JOIN people author ON a.person_id = author.id
            WHERE p.status = 'pending'
        `;
        const params = [];

        if (req.user.role_id === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (clanId === null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            sql += ' AND p.clan_id = ?';
            params.push(clanId);
        }

        sql += ' ORDER BY p.created_at DESC';
        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (error) {
        console.error('getPendingPosts error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách bài viết chờ duyệt' });
    }
};

exports.approvePost = async (req, res) => {
    const postId = req.params.id;
    try {
        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            const [rows] = await db.query('SELECT clan_id FROM posts WHERE id = ?', [postId]);
            if (!rows.length || rows[0].clan_id !== managerClanId) {
                return res.status(403).json({ success: false, message: 'Chỉ được duyệt bài viết cùng dòng họ' });
            }
        }
        const sql = "UPDATE posts SET status = 'approved' WHERE id = ?";
        await db.query(sql, [postId]);
        res.json({ success: true, message: 'Đã phê duyệt bài viết!' });
    } catch (error) {
        console.error('approvePost error:', error);
        res.status(500).json({ success: false, message: 'Lỗi phê duyệt bài viết' });
    }
};

exports.rejectPost = async (req, res) => {
    const postId = req.params.id;
    try {
        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            const [rows] = await db.query('SELECT clan_id FROM posts WHERE id = ?', [postId]);
            if (!rows.length || rows[0].clan_id !== managerClanId) {
                return res.status(403).json({ success: false, message: 'Chỉ được từ chối bài viết cùng dòng họ' });
            }
        }
        const sql = "UPDATE posts SET status = 'rejected' WHERE id = ?";
        await db.query(sql, [postId]);
        res.json({ success: true, message: 'Đã từ chối bài viết!' });
    } catch (error) {
        console.error('rejectPost error:', error);
        res.status(500).json({ success: false, message: 'Lỗi từ chối bài viết' });
    }
};

exports.getMedia = async (req, res) => {
    try {
        let sql = `
            SELECT p.id as post_id, p.content, p.image_url, p.created_at, author.display_name as author_name
            FROM posts p
            JOIN accounts a ON p.author_id = a.id
            JOIN people author ON a.person_id = author.id
            WHERE p.image_url IS NOT NULL AND p.image_url != '' AND p.status != 'rejected'
        `;
        const params = [];

        if (req.user.role_id === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (clanId === null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            sql += ' AND p.clan_id = ?';
            params.push(clanId);
        }

        sql += ' ORDER BY p.created_at DESC';
        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (error) {
        console.error('getMedia error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách dữ liệu truyền thông (Media)' });
    }
};