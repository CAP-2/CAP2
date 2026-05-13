const {
    db,
    ensureCanAddAccount,
    parseOptionalPositiveInt,
} = require('../../services/manager/commonService');
const {
    getManagerClanId,
} = require('../../services/manager/managerClanService');
const {
    ensureFamilyMemoriesSchemaForManager,
    mapManagerMemoryRow,
} = require('../../services/manager/memoryModerationService');

const getPendingUsers = async(req, res) => {
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

const approveUser = async(req, res) => {
    const accountId = req.params.id;

    try {
        const [accountRows] = await db.query(
            `
            SELECT 
                a.id AS account_id,
                a.status,
                a.role_id,
                a.person_id,
                p.clan_id
            FROM accounts a
            JOIN people p ON a.person_id = p.id
            WHERE a.id = ?
            LIMIT 1
            `, [accountId]
        );

        if (!accountRows.length) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản cần duyệt',
            });
        }

        const target = accountRows[0];

        if (!target.clan_id) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản chưa liên kết với dòng họ',
            });
        }

        if (String(target.status) === 'active') {
            return res.json({
                success: true,
                message: 'Tài khoản đã được kích hoạt trước đó',
            });
        }

        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);

            if (managerClanId == null) {
                return res.status(404).json({
                    success: false,
                    message: 'Không xác định được clan của manager',
                });
            }

            if (Number(target.clan_id) !== Number(managerClanId)) {
                return res.status(403).json({
                    success: false,
                    message: 'Chỉ được duyệt thành viên cùng dòng họ',
                });
            }
        }

        const accountLimitCheck = await ensureCanAddAccount(target.clan_id);

        if (!accountLimitCheck.ok) {
            return res.status(accountLimitCheck.status).json({
                success: false,
                code: accountLimitCheck.code,
                message: accountLimitCheck.message,
                billing: accountLimitCheck.billing,
            });
        }

        await db.query(
            "UPDATE accounts SET role_id = 3, status = 'active' WHERE id = ?", [accountId]
        );

        return res.json({
            success: true,
            message: 'Phê duyệt thành công!',
        });
    } catch (error) {
        console.error('approveUser error:', error);
        return res.status(error.status || 500).json({
            success: false,
            message: 'Lỗi phê duyệt',
        });
    }
};

const rejectUser = async(req, res) => {
    const accountId = req.params.id;
    try {
        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            const [rows] = await db.query(
                `SELECT p.clan_id FROM accounts a JOIN people p ON a.person_id = p.id WHERE a.id = ?`, [accountId]
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

const getPendingPosts = async(req, res) => {
    try {
        let sql = `
            SELECT p.id as post_id, p.description, p.content, p.image_url, p.image_media_id, p.created_at, author.display_name as author_name, author.email as author_email
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

const approvePost = async(req, res) => {
    const postId = req.params.id;

    try {
        const [postRows] = await db.query(
            'SELECT id, clan_id FROM posts WHERE id = ? LIMIT 1',
            [postId]
        );

        const post = postRows[0];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết',
            });
        }

        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);

            if (managerClanId == null) {
                return res.status(404).json({
                    success: false,
                    message: 'Không xác định được clan của manager',
                });
            }

            if (Number(post.clan_id) !== Number(managerClanId)) {
                return res.status(403).json({
                    success: false,
                    message: 'Chỉ được duyệt bài viết cùng dòng họ',
                });
            }
        }

        const sql = "UPDATE posts SET status = 'approved' WHERE id = ?";
        await db.query(sql, [postId]);

        const io = req.app?.locals?.io;

        if (io && post.clan_id) {
            io.to(`clan_${post.clan_id}`).emit("post_feed_updated", {
                action: "post_approved",
                post_id: Number(postId),
                clan_id: post.clan_id,
                actor_account_id: req.user?.id || req.user?.account_id || null,
                updated_at: new Date().toISOString(),
            });

            console.log(`📰 Đã emit post_feed_updated post_approved tới clan_${post.clan_id}`);
        }

        return res.json({ success: true, message: 'Đã phê duyệt bài viết!' });
    } catch (error) {
        console.error('approvePost error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi phê duyệt bài viết' });
    }
};

const rejectPost = async(req, res) => {
    const postId = req.params.id;
    const { reason } = req.body;
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
        const sql = "UPDATE posts SET status = 'rejected', rejection_reason = ? WHERE id = ?";
        await db.query(sql, [reason || 'Không có lý do', postId]);
        res.json({ success: true, message: 'Đã từ chối bài viết!' });
    } catch (error) {
        console.error('rejectPost error:', error);
        res.status(500).json({ success: false, message: 'Lỗi từ chối bài viết' });
    }
};

const getPendingProfileUpdates = async (req, res) => {
    try {
        let sql = `
            SELECT id as person_id, display_name, surname, first_name, pending_bio, pending_avatar_url, pending_avatar_media_id, bio as current_bio, avatar_url as current_avatar_url, avatar_media_id as current_avatar_media_id, clan_id
            FROM people
            WHERE moderation_status = 'pending'
        `;
        const params = [];

        if (req.user.role_id === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (clanId === null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            sql += ' AND clan_id = ?';
            params.push(clanId);
        }

        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (error) {
        console.error('getPendingProfileUpdates error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách profile chờ duyệt' });
    }
};

const approveProfileUpdate = async (req, res) => {
    const personId = req.params.id;
    try {
        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            const [rows] = await db.query('SELECT clan_id FROM people WHERE id = ?', [personId]);
            if (!rows.length || rows[0].clan_id !== managerClanId) {
                return res.status(403).json({ success: false, message: 'Chỉ được duyệt hồ sơ cùng dòng họ' });
            }
        }
        
        await db.query(`
            UPDATE people 
            SET 
                bio = COALESCE(pending_bio, bio), 
                avatar_url = COALESCE(pending_avatar_url, avatar_url),
                avatar_media_id = COALESCE(pending_avatar_media_id, avatar_media_id),
                pending_bio = NULL,
                pending_avatar_url = NULL,
                pending_avatar_media_id = NULL,
                moderation_status = 'none',
                moderation_reason = NULL
            WHERE id = ?`, 
            [personId]
        );
        res.json({ success: true, message: 'Đã phê duyệt cập nhật hồ sơ!' });
    } catch (error) {
        console.error('approveProfileUpdate error:', error);
        res.status(500).json({ success: false, message: 'Lỗi phê duyệt hồ sơ' });
    }
};

const rejectProfileUpdate = async (req, res) => {
    const personId = req.params.id;
    const { reason } = req.body;
    try {
        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            const [rows] = await db.query('SELECT clan_id FROM people WHERE id = ?', [personId]);
            if (!rows.length || rows[0].clan_id !== managerClanId) {
                return res.status(403).json({ success: false, message: 'Chỉ được từ chối hồ sơ cùng dòng họ' });
            }
        }
        
        await db.query(`
            UPDATE people 
            SET 
                moderation_status = 'rejected',
                moderation_reason = ?
            WHERE id = ?`, 
            [reason || 'Không có lý do', personId]
        );
        res.json({ success: true, message: 'Đã từ chối cập nhật hồ sơ!' });
    } catch (error) {
        console.error('rejectProfileUpdate error:', error);
        res.status(500).json({ success: false, message: 'Lỗi từ chối hồ sơ' });
    }
};

const getPendingMemories = async (req, res) => {
    try {
        await ensureFamilyMemoriesSchemaForManager();
        let clanId = null;
        if (Number(req.user.role_id) === 2) {
            clanId = await getManagerClanId(req.user.id);
            if (!clanId) return res.status(404).json({ success: false, message: 'Không xác định được dòng họ của manager' });
        } else {
            clanId = parseOptionalPositiveInt(req.query.clan_id || req.body?.clan_id);
        }

        const values = [];
        let where = "fm.status = 'pending'";
        if (clanId) {
            where += ' AND fm.clan_id = ?';
            values.push(clanId);
        }

        const [rows] = await db.query(
            `SELECT fm.*, COALESCE(p.display_name, a.email) AS author_name, a.email AS author_email
             FROM family_memories fm
             LEFT JOIN accounts a ON a.id = fm.author_account_id
             LEFT JOIN people p ON p.id = fm.author_person_id
             WHERE ${where}
             ORDER BY fm.created_at DESC`,
            values
        );
        return res.json({ success: true, memories: rows.map(mapManagerMemoryRow) });
    } catch (error) {
        console.error('getPendingMemories error:', error);
        return res.status(500).json({ success: false, message: 'Không thể tải kỉ niệm chờ duyệt' });
    }
};

const approveMemory = async (req, res) => {
    try {
        await ensureFamilyMemoriesSchemaForManager();
        const memoryId = Number(req.params.id);
        if (!Number.isInteger(memoryId) || memoryId <= 0) return res.status(400).json({ success: false, message: 'ID kỉ niệm không hợp lệ' });

        const values = [memoryId];
        let where = 'id = ?';
        if (Number(req.user.role_id) === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (!clanId) return res.status(404).json({ success: false, message: 'Không xác định được dòng họ của manager' });
            where += ' AND clan_id = ?';
            values.push(clanId);
        }

        const [result] = await db.query(
            `UPDATE family_memories SET status = 'approved', rejection_reason = NULL, approved_by_account_id = ?, approved_at = CURRENT_TIMESTAMP WHERE ${where}`,
            [req.user.id, ...values]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy kỉ niệm chờ duyệt' });
        return res.json({ success: true, message: 'Đã duyệt kỉ niệm dòng họ' });
    } catch (error) {
        console.error('approveMemory error:', error);
        return res.status(500).json({ success: false, message: 'Không thể duyệt kỉ niệm' });
    }
};

const rejectMemory = async (req, res) => {
    try {
        await ensureFamilyMemoriesSchemaForManager();
        const memoryId = Number(req.params.id);
        if (!Number.isInteger(memoryId) || memoryId <= 0) return res.status(400).json({ success: false, message: 'ID kỉ niệm không hợp lệ' });
        const reason = String(req.body?.reason || '').trim() || 'Nội dung chưa phù hợp';

        const values = [memoryId];
        let where = 'id = ?';
        if (Number(req.user.role_id) === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (!clanId) return res.status(404).json({ success: false, message: 'Không xác định được dòng họ của manager' });
            where += ' AND clan_id = ?';
            values.push(clanId);
        }

        const [result] = await db.query(
            `UPDATE family_memories SET status = 'rejected', rejection_reason = ? WHERE ${where}`,
            [reason, ...values]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy kỉ niệm chờ duyệt' });
        return res.json({ success: true, message: 'Đã từ chối kỉ niệm dòng họ' });
    } catch (error) {
        console.error('rejectMemory error:', error);
        return res.status(500).json({ success: false, message: 'Không thể từ chối kỉ niệm' });
    }
};

module.exports = {
    getPendingUsers,
    approveUser,
    rejectUser,
    getPendingPosts,
    approvePost,
    rejectPost,
    getPendingProfileUpdates,
    approveProfileUpdate,
    rejectProfileUpdate,
    getPendingMemories,
    approveMemory,
    rejectMemory,
};
