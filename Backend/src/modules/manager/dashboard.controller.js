const {
    ensureArchivedMembersTable,
} = require('./archive.service');
const {
    db,
    fmtSqlDate,
    getTreeLayoutSettings,
} = require('./common.service');
const {
    buildManagedFamilyTree,
    ensureFamilyRelationshipColumns,
    ensurePeopleTreeLayoutColumns,
} = require('../genealogy/familyRelation.service');
const {
    getManagerClanId,
    resolveManagedClanId,
} = require('./managerClan.service');

const getClanInfo = async(req, res) => {
    try {
        const clanId = await resolveManagedClanId(req);
        if (clanId == null) {
            return res.status(404).json({ success: false, message: 'Không xác định được dòng họ cần quản lý' });
        }

        const [rows] = await db.query(
            'SELECT id, clan_name, history, hall_address, created_at FROM clans WHERE id = ? LIMIT 1', [clanId]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Dòng họ không tồn tại' });
        }

        return res.json({ success: true, clan: rows[0] });
    } catch (error) {
        console.error('getClanInfo error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi lấy thông tin dòng họ' });
    }
};

const updateClanInfo = async(req, res) => {
    try {
        const clanId = await resolveManagedClanId(req);
        if (clanId == null) {
            return res.status(404).json({ success: false, message: 'Không xác định được dòng họ cần quản lý' });
        }

        const clanName = String(req.body.clan_name || '').trim();
        const history = req.body.history == null ? '' : String(req.body.history).trim();
        const hallAddress = req.body.hall_address == null ? '' : String(req.body.hall_address).trim();

        if (!clanName) {
            return res.status(400).json({ success: false, message: 'Tên dòng họ không được để trống' });
        }

        const [exists] = await db.query('SELECT id FROM clans WHERE id = ? LIMIT 1', [clanId]);
        if (!exists.length) {
            return res.status(404).json({ success: false, message: 'Dòng họ không tồn tại' });
        }

        const [duplicate] = await db.query(
            'SELECT id FROM clans WHERE LOWER(clan_name) = LOWER(?) AND id <> ? LIMIT 1', [clanName, clanId]
        );
        if (duplicate.length) {
            return res.status(409).json({ success: false, message: 'Tên dòng họ này đã tồn tại' });
        }

        await db.query(
            'UPDATE clans SET clan_name = ?, history = ?, hall_address = ? WHERE id = ?', [clanName, history || null, hallAddress || null, clanId]
        );

        const [rows] = await db.query(
            'SELECT id, clan_name, history, hall_address, created_at FROM clans WHERE id = ? LIMIT 1', [clanId]
        );

        return res.json({ success: true, message: 'Đã cập nhật thông tin dòng họ', clan: rows[0] });
    } catch (error) {
        console.error('updateClanInfo error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi cập nhật thông tin dòng họ' });
    }
};

const getFamilyTree = async(req, res) => {
    try {
        await ensureArchivedMembersTable();
        await ensurePeopleTreeLayoutColumns();
        await ensureFamilyRelationshipColumns();
        const clanId = await resolveManagedClanId(req);
        if (clanId == null) {
            return res.status(404).json({ success: false, message: 'Không xác định được dòng họ cần quản lý' });
        }

        const [clanRows] = await db.query(
            'SELECT id, clan_name, history, hall_address, created_at FROM clans WHERE id = ? LIMIT 1', [clanId]
        );
        if (!clanRows.length) {
            return res.status(404).json({ success: false, message: 'Dòng họ không tồn tại' });
        }

        const [peopleRows] = await db.query(
            `
            SELECT
                p.id,
                p.clan_id,
                p.display_name,
                p.first_name,
                p.middle_name,
                p.surname,
                p.gender,
                p.generation,
                p.branch,
                p.birth_date,
                p.death_date,
                p.is_living,
                p.phone,
                p.email,
                p.address,
                p.hometown,
                COALESCE(p.pending_avatar_url, p.avatar_url) AS avatar_url,
                COALESCE(p.pending_avatar_media_id, p.avatar_media_id) AS avatar_media_id,
                p.pending_avatar_url,
                p.pending_avatar_media_id,
                p.bio,
                p.note,
                p.tree_x,
                p.tree_y,
                p.display_order,
                a.id AS account_id,
                a.email AS account_email,
                a.role_id,
                a.status AS account_status
            FROM people p
            LEFT JOIN accounts a ON a.person_id = p.id
            LEFT JOIN archived_members am ON (a.id IS NOT NULL AND am.account_id = a.id) OR (am.person_json->>'$.id' = p.id)
            WHERE p.clan_id = ?
              AND am.id IS NULL
            ORDER BY p.generation, p.display_order, p.surname, p.middle_name, p.first_name, p.id
            `, [clanId]

        );

        const [familyRows] = await db.query(
            `SELECT id, clan_id, father_id, mother_id, marriage_date,
                    relationship_status, ended_at, relation_note
             FROM families
             WHERE clan_id = ?
             ORDER BY id ASC`,
            [clanId]
        );
        const [childRows] = await db.query(
            `
            SELECT c.family_id, c.person_id, c.sort_order
            FROM children c
            INNER JOIN families f ON c.family_id = f.id
            WHERE f.clan_id = ?
            ORDER BY c.family_id, c.sort_order, c.id
            `, [clanId]
        );
        const layoutSettings = await getTreeLayoutSettings(clanId);

        return res.json({
            success: true,
            clan: clanRows[0],
            treeMembers: peopleRows.map((p) => ({
                ...p,
                birth_date: fmtSqlDate(p.birth_date),
                death_date: fmtSqlDate(p.death_date),
            })),
            families: familyRows.map((f) => ({
                ...f,
                marriage_date: fmtSqlDate(f.marriage_date),
                ended_at: fmtSqlDate(f.ended_at),
            })),
            children: childRows,
            layoutSettings,
            familyTree: buildManagedFamilyTree(peopleRows, familyRows, childRows),
        });
    } catch (error) {
        console.error('getFamilyTree error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy cây gia phả' });
    }
};

const getStats = async(req, res) => {
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

const getMedia = async(req, res) => {
    try {
        let sql = `
            SELECT p.id as post_id, p.description, p.content, p.image_url, p.image_media_id, p.created_at, author.display_name as author_name
            FROM posts p
            JOIN accounts a ON p.author_id = a.id
            JOIN people author ON a.person_id = author.id
            WHERE ((p.image_url IS NOT NULL AND p.image_url != '') OR p.image_media_id IS NOT NULL) AND p.status != 'rejected'
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

module.exports = {
    getClanInfo,
    updateClanInfo,
    getFamilyTree,
    getStats,
    getMedia,
};
