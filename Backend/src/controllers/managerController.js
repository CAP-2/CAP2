const db = require('../config/db');

const parseNullableId = (value) => {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const parseChildrenIds = (value) => {
    if (Array.isArray(value)) {
        return [...new Set(value.map((v) => Number(v)).filter((v) => Number.isFinite(v)))];
    }
    if (typeof value === 'string') {
        return [
            ...new Set(
                value
                    .split(',')
                    .map((v) => Number(v.trim()))
                    .filter((v) => Number.isFinite(v))
            ),
        ];
    }
    return [];
};

const ensurePeopleExist = async (ids) => {
    if (!ids || ids.length === 0) return true;
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(`SELECT id FROM people WHERE id IN (${placeholders})`, ids);
    return rows.length === ids.length;
};

const getOwnedFamilyRelations = async (personId) => {
    if (!personId) {
        return { family_id: null, spouse_id: null, children_ids: [] };
    }

    const [familyRows] = await db.query(
        `
      SELECT id, father_id, mother_id
      FROM families
      WHERE father_id = ? OR mother_id = ?
      ORDER BY id ASC
      LIMIT 1
    `,
        [personId, personId]
    );

    const family = familyRows[0] || null;
    if (!family) {
        return { family_id: null, spouse_id: null, children_ids: [] };
    }

    const spouseId = family.father_id === personId ? family.mother_id : family.father_id;
    const [childrenRows] = await db.query(
        'SELECT person_id FROM children WHERE family_id = ? ORDER BY id ASC',
        [family.id]
    );

    return {
        family_id: family.id,
        spouse_id: spouseId || null,
        children_ids: childrenRows.map((r) => r.person_id),
    };
};

const getChildBloodline = async (personId) => {
    if (!personId) return null;
    const [rows] = await db.query(
        `
      SELECT c.family_id, f.father_id AS parent_father_id, f.mother_id AS parent_mother_id
      FROM children c
      INNER JOIN families f ON c.family_id = f.id
      WHERE c.person_id = ?
      ORDER BY c.id ASC
      LIMIT 1
    `,
        [personId]
    );
    return rows[0] || null;
};

const getTargetAccountContext = async (accountId) => {
    const sql = `
    SELECT 
      a.id AS account_id,
      a.email AS account_email,
      a.role_id,
      a.status,
      a.person_id,
      p.gender,
      p.clan_id
    FROM accounts a
    LEFT JOIN people p ON a.person_id = p.id
    WHERE a.id = ?
    LIMIT 1
  `;
    const [rows] = await db.query(sql, [accountId]);
    return rows[0] || null;
};

/** Manager (role 2) chỉ thao tác thành viên cùng clan; Admin (1) không giới hạn clan. */
const assertCanManageAccount = async (req, targetAccountId) => {
    const ctx = await getTargetAccountContext(targetAccountId);
    if (!ctx || !ctx.person_id) {
        return { ok: false, status: 400, message: 'Tài khoản không có hồ sơ người (person) trong hệ thống' };
    }
    if (req.user.role_id === 2) {
        const managerClanId = await getManagerClanId(req.user.id);
        if (managerClanId == null) {
            return { ok: false, status: 404, message: 'Không xác định được clan của manager' };
        }
        if (ctx.clan_id !== managerClanId) {
            return { ok: false, status: 403, message: 'Chỉ được chỉnh quan hệ thành viên cùng dòng họ' };
        }
    }
    return { ok: true, context: ctx };
};

const getManagerClanId = async (accountId) => {
    const [accountRows] = await db.query(
        `SELECT p.clan_id FROM accounts a JOIN people p ON a.person_id = p.id WHERE a.id = ?`,
        [accountId]
    );
    if (!accountRows || accountRows.length === 0) return null;
    return accountRows[0].clan_id;
};

async function applyBloodlineForPerson(targetPersonId, clanId, parentFatherId, parentMotherId) {
    if (!parentFatherId && !parentMotherId) {
        return { ok: false, message: 'Chỉ định huyết thống cần ít nhất ID cha hoặc mẹ (people.id)' };
    }
    if (targetPersonId === parentFatherId || targetPersonId === parentMotherId) {
        return { ok: false, message: 'Thành viên không thể là cha/mẹ của chính mình' };
    }
    const parentIds = [parentFatherId, parentMotherId].filter((v) => v !== null);
    const [clanRows] = await db.query(
        `SELECT id FROM people WHERE id IN (${parentIds.map(() => '?').join(',')}) AND clan_id = ?`,
        [...parentIds, clanId]
    );
    if (clanRows.length !== parentIds.length) {
        return { ok: false, message: 'Cha/mẹ phải là người trong cùng dòng họ (hoặc ID không tồn tại)' };
    }

    await db.query('DELETE FROM children WHERE person_id = ?', [targetPersonId]);

    const [existing] = await db.query(
        `SELECT id FROM families WHERE clan_id = ? AND (father_id <=> ?) AND (mother_id <=> ?) LIMIT 1`,
        [clanId, parentFatherId, parentMotherId]
    );

    let famId;
    if (existing.length > 0) {
        famId = existing[0].id;
    } else {
        const [ins] = await db.query(
            'INSERT INTO families (clan_id, father_id, mother_id) VALUES (?, ?, ?)',
            [clanId, parentFatherId, parentMotherId]
        );
        famId = ins.insertId;
    }

    await db.query('INSERT INTO children (family_id, person_id, sort_order) VALUES (?, ?, 0)', [famId, targetPersonId]);

    return { ok: true };
}

async function applyMarriageRelationsForPerson(context, body) {
    const { family_id, spouse_id, children_ids } = body;
    const hasFamilyField = Object.prototype.hasOwnProperty.call(body, 'family_id');
    const hasSpouseField = Object.prototype.hasOwnProperty.call(body, 'spouse_id');
    const hasChildrenField = Object.prototype.hasOwnProperty.call(body, 'children_ids');

    const familyIdInput = parseNullableId(family_id);
    const spouseId = parseNullableId(spouse_id);
    const childrenIds = parseChildrenIds(children_ids);

    const relationIdsToValidate = [spouseId, ...childrenIds].filter((v) => v !== null);
    const allRelationsOk = await ensurePeopleExist(relationIdsToValidate);
    if (!allRelationsOk) {
        return { ok: false, message: 'Một hoặc nhiều ID quan hệ không tồn tại trong bảng people' };
    }

    if (spouseId !== null && spouseId === context.person_id) {
        return { ok: false, message: 'Vợ/chồng không thể trùng với chính thành viên' };
    }

    if (spouseId) {
        const [sp] = await db.query('SELECT clan_id FROM people WHERE id = ?', [spouseId]);
        if (!sp.length || sp[0].clan_id !== context.clan_id) {
            return { ok: false, message: 'Vợ/chồng phải cùng dòng họ với thành viên' };
        }
    }
    for (const cid of childrenIds) {
        const [ch] = await db.query('SELECT clan_id FROM people WHERE id = ?', [cid]);
        if (!ch.length || ch[0].clan_id !== context.clan_id) {
            return { ok: false, message: 'Danh sách con phải là người cùng dòng họ' };
        }
    }

    const personId = context.person_id;
    const [selfFamilyRows] = await db.query(
        'SELECT id FROM families WHERE father_id = ? OR mother_id = ? ORDER BY id ASC LIMIT 1',
        [personId, personId]
    );
    let selfFamilyId = selfFamilyRows[0]?.id || null;
    const isMale = Number(context.gender) === 1;

    if (hasFamilyField && familyIdInput !== null) {
        const [existingFamily] = await db.query(
            'SELECT id, father_id, mother_id, clan_id FROM families WHERE id = ? LIMIT 1',
            [familyIdInput]
        );
        if (existingFamily.length === 0) {
            if (!context.clan_id) {
                return { ok: false, message: 'Tài khoản chưa liên kết dòng họ nên không thể tạo families mới' };
            }
            await db.query(
                'INSERT INTO families (id, clan_id, father_id, mother_id) VALUES (?, ?, ?, ?)',
                [familyIdInput, context.clan_id, isMale ? personId : spouseId, isMale ? spouseId : personId]
            );
            selfFamilyId = familyIdInput;
        } else {
            const fam = existingFamily[0];
            if (fam.father_id !== personId && fam.mother_id !== personId) {
                return { ok: false, message: 'Family ID đã tồn tại nhưng thành viên không phải bố/mẹ của family này' };
            }
            selfFamilyId = fam.id;
        }
    }

    const needsNewOrUpdateFamilyRow = hasSpouseField || (hasChildrenField && childrenIds.length > 0);
    if (needsNewOrUpdateFamilyRow) {
        if (!selfFamilyId) {
            if (!context.clan_id) {
                return { ok: false, message: 'Tài khoản chưa liên kết dòng họ nên chưa thể khai báo quan hệ vợ/chồng/con' };
            }
            const [createdFamily] = await db.query(
                'INSERT INTO families (clan_id, father_id, mother_id) VALUES (?, ?, ?)',
                [context.clan_id, isMale ? personId : spouseId, isMale ? spouseId : personId]
            );
            selfFamilyId = createdFamily.insertId;
        } else {
            await db.query('UPDATE families SET father_id = ?, mother_id = ? WHERE id = ?', [
                isMale ? personId : spouseId,
                isMale ? spouseId : personId,
                selfFamilyId,
            ]);
        }
    }

    if (selfFamilyId && hasChildrenField) {
        await db.query('DELETE FROM children WHERE family_id = ?', [selfFamilyId]);
        for (const childId of childrenIds) {
            await db.query('INSERT INTO children (family_id, person_id, sort_order) VALUES (?, ?, 0)', [
                selfFamilyId,
                childId,
            ]);
        }
    }

    return { ok: true };
}

exports.getMemberRelations = async (req, res) => {
    try {
        const targetAccountId = Number(req.params.id);
        const gate = await assertCanManageAccount(req, targetAccountId);
        if (!gate.ok) return res.status(gate.status).json({ success: false, message: gate.message });
        const { context } = gate;
        const bloodline = await getChildBloodline(context.person_id);
        const marriage = await getOwnedFamilyRelations(context.person_id);
        return res.json({
            success: true,
            account_id: context.account_id,
            person_id: context.person_id,
            clan_id: context.clan_id,
            gender: context.gender,
            bloodline: bloodline
                ? {
                      family_id: bloodline.family_id,
                      parent_father_id: bloodline.parent_father_id,
                      parent_mother_id: bloodline.parent_mother_id,
                  }
                : null,
            marriage: {
                family_id: marriage.family_id,
                spouse_id: marriage.spouse_id,
                children_ids: marriage.children_ids,
            },
        });
    } catch (error) {
        console.error('getMemberRelations error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy quan hệ thành viên' });
    }
};

exports.updateMemberRelations = async (req, res) => {
    try {
        const targetAccountId = Number(req.params.id);
        const mode = String(req.body.mode || '').toLowerCase();
        const gate = await assertCanManageAccount(req, targetAccountId);
        if (!gate.ok) return res.status(gate.status).json({ success: false, message: gate.message });
        const { context } = gate;

        if (mode === 'bloodline') {
            const parentFatherId = parseNullableId(req.body.parent_father_id);
            const parentMotherId = parseNullableId(req.body.parent_mother_id);
            const r = await applyBloodlineForPerson(context.person_id, context.clan_id, parentFatherId, parentMotherId);
            if (!r.ok) return res.status(400).json({ success: false, message: r.message });
        } else if (mode === 'marriage') {
            const r = await applyMarriageRelationsForPerson(context, req.body);
            if (!r.ok) return res.status(400).json({ success: false, message: r.message });
        } else {
            return res.status(400).json({ success: false, message: 'mode phải là bloodline hoặc marriage' });
        }

        const bloodline = await getChildBloodline(context.person_id);
        const marriage = await getOwnedFamilyRelations(context.person_id);
        return res.json({
            success: true,
            message: 'Đã lưu quan hệ',
            bloodline: bloodline
                ? {
                      family_id: bloodline.family_id,
                      parent_father_id: bloodline.parent_father_id,
                      parent_mother_id: bloodline.parent_mother_id,
                  }
                : null,
            marriage: {
                family_id: marriage.family_id,
                spouse_id: marriage.spouse_id,
                children_ids: marriage.children_ids,
            },
        });
    } catch (error) {
        console.error('updateMemberRelations error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lưu quan hệ' });
    }
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
                   p.id AS person_id, p.first_name, p.surname, p.birth_date, p.clan_id, p.gender,
                   p.generation
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