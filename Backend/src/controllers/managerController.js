const db = require('../config/db');
const bcrypt = require('bcryptjs');

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

const fmtSqlDate = (d) => {
    if (!d) return null;
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    const s = String(d);
    return s.length >= 10 ? s.slice(0, 10) : s || null;
};

const getManagedMemberFullContext = async (accountId) => {
    const sql = `
    SELECT 
      a.id AS account_id,
      a.email,
      a.role_id,
      a.status,
      a.person_id,
      p.display_name,
      p.first_name,
      p.middle_name,
      p.surname,
      p.gender,
      p.birth_date,
      p.death_date,
      p.is_living,
      p.generation,
      p.branch,
      p.hometown,
      p.address,
      p.phone,
      p.email AS people_email,
      p.zalo,
      p.facebook,
      p.avatar_url,
      p.bio,
      p.note,
      p.clan_id
    FROM accounts a
    INNER JOIN people p ON a.person_id = p.id
    WHERE a.id = ?
    LIMIT 1
  `;
    const [rows] = await db.query(sql, [accountId]);
    return rows[0] || null;
};

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

const buildDisplayNameFromPartsMgr = (surname, middleName, firstName) => {
    const s = surname == null ? '' : String(surname).trim();
    const m = middleName == null ? '' : String(middleName).trim();
    const f = firstName == null ? '' : String(firstName).trim();
    return [s, m, f].filter(Boolean).join(' ').trim();
};

exports.createMember = async (req, res) => {
    try {
        const { email, password, surname, middle_name, first_name, gender, birth_date, hometown, generation, clan_id: bodyClanId, } = req.body;

        const emailTrim = String(email || '').trim().toLowerCase();
        const pwd = String(password || '');
        if (!emailTrim || !pwd) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
        }
        if (pwd.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu tối thiểu 6 ký tự' });
        }
        const sn = surname != null ? String(surname).trim() : '';
        const mid = middle_name != null ? String(middle_name).trim() : '';
        const fn = first_name != null ? String(first_name).trim() : '';
        if (!sn && !fn) {
            return res.status(400).json({ success: false, message: 'Cần ít nhất họ hoặc tên' });
        }

        let clanId;
        if (req.user.role_id === 2) {
            clanId = await getManagerClanId(req.user.id);
            if (clanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
        } else {
            const cid = Number(bodyClanId);
            if (!Number.isFinite(cid)) {
                return res.status(400).json({ success: false, message: 'Admin cần gửi clan_id (mã dòng họ)' });
            }
            const [crows] = await db.query('SELECT id FROM clans WHERE id = ? LIMIT 1', [cid]);
            if (!crows.length) {
                return res.status(400).json({ success: false, message: 'clan_id không tồn tại' });
            }
            clanId = cid;
        }

        const genRaw = generation === undefined || generation === null || String(generation).trim() === '' ? 1 : Number(generation);
        const gen = Number.isFinite(genRaw) && genRaw > 0 ? genRaw : 1;

        let gVal = null;
        if (gender !== undefined && gender !== null && String(gender).trim() !== '') {
            const g = Number(gender);
            gVal = g === 1 || g === 2 ? g : null;
        }

        const bd = birth_date && String(birth_date).trim() !== '' ? String(birth_date).trim() : null;
        const ht = hometown != null ? String(hometown).trim() : '';

        const displayName = buildDisplayNameFromPartsMgr(sn, mid, fn) || emailTrim;
        const hashedPassword = await bcrypt.hash(pwd, 10);

        const [personResult] = await db.query(
            `INSERT INTO people (clan_id, display_name, first_name, middle_name, surname, gender, birth_date, hometown, generation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [clanId, displayName, fn, mid, sn, gVal, bd, ht, gen]
        );
        const personId = personResult.insertId;

        const [accResult] = await db.query(
            `INSERT INTO accounts (email, password, person_id, role_id, status) VALUES (?, ?, ?, 3, 'active')`,
            [emailTrim, hashedPassword, personId]
        );

        return res.status(201).json({
            success: true,
            message: 'Đã tạo thành viên mới (đã kích hoạt)',
            account_id: accResult.insertId,
            person_id: personId,
        });
    } catch (error) {
        console.error('createMember error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Email đã tồn tại trong hệ thống' });
        }
        return res.status(500).json({ success: false, message: 'Lỗi tạo thành viên' });
    }
};

exports.getMemberDetail = async (req, res) => {
    try {
        const targetAccountId = Number(req.params.id);
        if (!Number.isFinite(targetAccountId)) {
            return res.status(400).json({ success: false, message: 'account_id không hợp lệ' });
        }
        const gate = await assertCanManageAccount(req, targetAccountId);
        if (!gate.ok) return res.status(gate.status).json({ success: false, message: gate.message });

        const full = await getManagedMemberFullContext(targetAccountId);
        if (!full) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thành viên' });
        }

        const marriage = await getOwnedFamilyRelations(full.person_id);
        const bloodline = await getChildBloodline(full.person_id);

        return res.json({
            success: true,
            member: {
                ...full,
                birth_date: fmtSqlDate(full.birth_date),
                death_date: fmtSqlDate(full.death_date),
                marriage,
                bloodline,
            },
        });
    } catch (error) {
        console.error('getMemberDetail error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết thành viên' });
    }
};

exports.updateMemberByManager = async (req, res) => {
    try {
        const targetAccountId = Number(req.params.id);
        if (!Number.isFinite(targetAccountId)) {
            return res.status(400).json({ success: false, message: 'account_id không hợp lệ' });
        }
        const gate = await assertCanManageAccount(req, targetAccountId);
        if (!gate.ok) return res.status(gate.status).json({ success: false, message: gate.message });

        const full = await getManagedMemberFullContext(targetAccountId);
        if (!full) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thành viên' });
        }

        const body = req.body;
        const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

        if (has('email')) {
            const em = String(body.email || '').trim().toLowerCase();
            if (!em) {
                return res.status(400).json({ success: false, message: 'Email không được để trống' });
            }
            const [dup] = await db.query('SELECT id FROM accounts WHERE email = ? AND id <> ?', [em, targetAccountId]);
            if (dup.length) {
                return res.status(400).json({ success: false, message: 'Email đã được tài khoản khác sử dụng' });
            }
            await db.query('UPDATE accounts SET email = ? WHERE id = ?', [em, targetAccountId]);
        }

        if (has('status')) {
            const st = String(body.status || '').trim();
            if (['pending', 'active', 'rejected'].includes(st)) {
                await db.query('UPDATE accounts SET status = ? WHERE id = ?', [st, targetAccountId]);
            }
        }

        if (req.user.role_id === 1 && has('role_id')) {
            const rid = Number(body.role_id);
            if (rid === 2 || rid === 3) {
                await db.query('UPDATE accounts SET role_id = ? WHERE id = ?', [rid, targetAccountId]);
            }
        }

        if (has('new_password') && String(body.new_password || '').trim() !== '') {
            const np = String(body.new_password).trim();
            if (np.length < 6) {
                return res.status(400).json({ success: false, message: 'Mật khẩu mới tối thiểu 6 ký tự' });
            }
            const hashed = await bcrypt.hash(np, 10);
            await db.query('UPDATE accounts SET password = ? WHERE id = ?', [hashed, targetAccountId]);
        }

        const strOrKeep = (key, current) => {
            if (!has(key)) return current ?? '';
            if (body[key] === null) return '';
            return String(body[key]).trim();
        };

        const dateOrKeep = (key, current) => {
            if (!has(key)) return current;
            if (body[key] === null || body[key] === '') return null;
            const s = String(body[key]).trim();
            return s || null;
        };

        let nextSurname = strOrKeep('surname', full.surname);
        let nextMiddle = strOrKeep('middle_name', full.middle_name);
        let nextFirst = strOrKeep('first_name', full.first_name);
        const nextHometown = strOrKeep('hometown', full.hometown);
        const nextAddress = strOrKeep('address', full.address);
        const nextPhone = strOrKeep('phone', full.phone);
        const nextPeopleEmail = strOrKeep('people_email', full.people_email);
        const nextZalo = strOrKeep('zalo', full.zalo);
        const nextFacebook = strOrKeep('facebook', full.facebook);
        const nextAvatar = strOrKeep('avatar_url', full.avatar_url);
        const nextBio = strOrKeep('bio', full.bio);
        const nextNote = strOrKeep('note', full.note);

        let nextGender = full.gender;
        if (has('gender')) {
            if (body.gender === null || body.gender === '') {
                nextGender = null;
            } else {
                const g = Number(body.gender);
                nextGender = g === 1 || g === 2 ? g : full.gender;
            }
        }

        let nextGen = full.generation;
        if (has('generation')) {
            const n = Number(body.generation);
            nextGen = Number.isFinite(n) && n > 0 ? n : full.generation || 1;
        }

        let nextBranch = full.branch;
        if (has('branch')) {
            if (body.branch === null || body.branch === '') {
                nextBranch = null;
            } else {
                const b = Number(body.branch);
                nextBranch = Number.isFinite(b) ? b : full.branch;
            }
        }

        let nextLiving = full.is_living;
        if (has('is_living')) {
            nextLiving = body.is_living === true || body.is_living === 1 || body.is_living === '1' ? 1 : 0;
        }

        const nextBirth = dateOrKeep('birth_date', full.birth_date);
        const nextDeath = dateOrKeep('death_date', full.death_date);

        let nextClanId = full.clan_id;
        if (req.user.role_id === 1 && has('clan_id')) {
            const cid = Number(body.clan_id);
            if (Number.isFinite(cid)) {
                const [crows] = await db.query('SELECT id FROM clans WHERE id = ? LIMIT 1', [cid]);
                if (!crows.length) {
                    return res.status(400).json({ success: false, message: 'clan_id không tồn tại' });
                }
                nextClanId = cid;
            }
        }

        const nextDisplay = buildDisplayNameFromPartsMgr(nextSurname, nextMiddle, nextFirst) || (full.display_name || '').trim() || '';

        await db.query(
            `UPDATE people SET 
        clan_id = ?, display_name = ?, first_name = ?, middle_name = ?, surname = ?,
        gender = ?, birth_date = ?, death_date = ?, is_living = ?, generation = ?, branch = ?,
        hometown = ?, address = ?, phone = ?, email = ?, zalo = ?, facebook = ?,
        avatar_url = ?, bio = ?, note = ?
      WHERE id = ?`,
            [
                nextClanId, nextDisplay, nextFirst, nextMiddle, nextSurname, nextGender, nextBirth, nextDeath, nextLiving, nextGen, nextBranch,
                nextHometown, nextAddress, nextPhone, nextPeopleEmail, nextZalo, nextFacebook, nextAvatar || null, nextBio, nextNote, full.person_id,
            ]
        );

        const [pRef] = await db.query('SELECT gender, clan_id FROM people WHERE id = ? LIMIT 1', [full.person_id]);
        const famCtx = {
            person_id: full.person_id,
            clan_id: pRef[0]?.clan_id ?? nextClanId,
            gender: pRef[0]?.gender ?? nextGender,
        };

        const hasBl = has('parent_father_id') || has('parent_mother_id');
        if (hasBl) {
            const pf = has('parent_father_id') ? parseNullableId(body.parent_father_id) : null;
            const pm = has('parent_mother_id') ? parseNullableId(body.parent_mother_id) : null;
            if (pf || pm) {
                const r = await applyBloodlineForPerson(full.person_id, famCtx.clan_id, pf, pm);
                if (!r.ok) return res.status(400).json({ success: false, message: r.message });
            }
        }

        const hasMarriage = has('family_id') || has('spouse_id') || has('children_ids');
        if (hasMarriage) {
            const r = await applyMarriageRelationsForPerson(famCtx, body);
            if (!r.ok) return res.status(400).json({ success: false, message: r.message });
        }

        const updated = await getManagedMemberFullContext(targetAccountId);
        const marriage = await getOwnedFamilyRelations(updated.person_id);
        const bloodline = await getChildBloodline(updated.person_id);

        return res.json({
            success: true,
            message: 'Đã cập nhật thành viên',
            member: {
                ...updated,
                birth_date: fmtSqlDate(updated.birth_date),
                death_date: fmtSqlDate(updated.death_date),
                marriage,
                bloodline,
            },
        });
    } catch (error) {
        console.error('updateMemberByManager error:', error);
        res.status(500).json({ success: false, message: 'Lỗi cập nhật thành viên' });
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

exports.createPerson = async (req, res) => {
    const {
        clan_id, display_name, first_name, middle_name, surname,
        gender, birth_date, hometown, generation,
        father_id, mother_id, spouse_id
    } = req.body;

    if (!first_name || !surname || !clan_id) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin bắt buộc (Tên, Họ, Clan ID)" });
    }

    try {
        const sql = `
            INSERT INTO people 
            (clan_id, display_name, first_name, middle_name, surname, gender, birth_date, hometown, generation, father_id, mother_id, spouse_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(sql, [
            clan_id, display_name, first_name, middle_name, surname,
            gender, birth_date, hometown, generation || 1, 
            father_id || null, mother_id || null, spouse_id || null
        ]);

        res.status(201).json({
            success: true,
            message: "Tạo thành viên mới thành công!",
            person_id: result.insertId
        });
    } catch (error) {
        console.error('createPerson error:', error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi tạo thành viên" });
    }
};

exports.updatePerson = async (req, res) => {
    const personId = req.params.id;
    const {
        display_name, first_name, middle_name, surname,
        gender, birth_date, hometown, generation
    } = req.body;

    try {
        const [check] = await db.query("SELECT id FROM people WHERE id = ?", [personId]);
        if (check.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy thành viên" });
        }

        const sql = `
            UPDATE people 
            SET display_name = ?, first_name = ?, middle_name = ?, surname = ?, 
                gender = ?, birth_date = ?, hometown = ?, generation = ?
            WHERE id = ?
        `;

        await db.query(sql, [
            display_name, first_name, middle_name, surname,
            gender, birth_date, hometown, generation, personId
        ]);

        res.json({ success: true, message: "Cập nhật thông tin thành công!" });
    } catch (error) {
        console.error('updatePerson error:', error);
        res.status(500).json({ success: false, message: "Lỗi khi cập nhật thông tin" });
    }
};

exports.linkRelations = async (req, res) => {
    const { person_id, father_id, mother_id, spouse_id } = req.body;

    if (!person_id) {
        return res.status(400).json({ success: false, message: "Thiếu ID người cần liên kết (person_id)" });
    }

    try {
        let newGeneration = null;
        if (father_id) {
            const [fatherRows] = await db.query("SELECT generation FROM people WHERE id = ?", [father_id]);
            if (fatherRows.length > 0 && fatherRows[0].generation) {
                newGeneration = fatherRows[0].generation + 1;
            }
        } else if (mother_id) {
             const [motherRows] = await db.query("SELECT generation FROM people WHERE id = ?", [mother_id]);
            if (motherRows.length > 0 && motherRows[0].generation) {
                newGeneration = motherRows[0].generation + 1;
            }
        }

        let sql = "UPDATE people SET father_id = ?, mother_id = ?, spouse_id = ?";
        let params = [father_id || null, mother_id || null, spouse_id || null];

        if (newGeneration) {
            sql += ", generation = ?";
            params.push(newGeneration);
        }

        sql += " WHERE id = ?";
        params.push(person_id);

        await db.query(sql, params);

        if (spouse_id) {
            await db.query("UPDATE people SET spouse_id = ? WHERE id = ?", [person_id, spouse_id]);
        }

        res.json({ success: true, message: "Liên kết gia phả thành công!", new_generation: newGeneration });
    } catch (error) {
        console.error('linkRelations error:', error);
        res.status(500).json({ success: false, message: "Lỗi khi tạo liên kết gia phả" });
    }
};

exports.getPersonWithRelations = async (req, res) => {
    const personId = req.params.id;

    try {
        const sql = `
            SELECT p.*,
                   CONCAT(f.surname, ' ', f.first_name) as father_name,
                   CONCAT(m.surname, ' ', m.first_name) as mother_name,
                   CONCAT(s.surname, ' ', s.first_name) as spouse_name
            FROM people p
            LEFT JOIN people f ON p.father_id = f.id
            LEFT JOIN people m ON p.mother_id = m.id
            LEFT JOIN people s ON p.spouse_id = s.id
            WHERE p.id = ?
        `;

        const [results] = await db.query(sql, [personId]);

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy thành viên" });
        }

        res.json(results[0]);
    } catch (error) {
        console.error('getPersonWithRelations error:', error);
        res.status(500).json({ success: false, message: "Lỗi lấy thông tin chi tiết" });
    }
};

// ==============================================================
// --- FAKE DATABASE CHO TÍNH NĂNG PHÂN CÔNG CÔNG VIỆC ---
// ==============================================================
let fakeTasksDB = [];
let taskIdCounter = 1;

exports.assignTask = async (req, res) => {
    const { member_id, title, description, due_date } = req.body;
    
    try {
        const newTask = {
            id: taskIdCounter++,
            manager_id: req.user ? req.user.id : 1, 
            member_id: member_id,
            title: title,
            description: description,
            due_date: due_date,
            status: 'pending',
            created_at: new Date().toISOString(),
            surname: "Thành viên",
            first_name: `(ID: ${member_id})` 
        };

        fakeTasksDB.push(newTask);

        res.json({ success: true, message: "Đã giao việc thành công (Chế độ Không SQL)!" });
    } catch (error) {
        console.error('assignTask error:', error);
        res.status(500).json({ success: false, message: "Lỗi phân công công việc" });
    }
};

exports.getAssignedTasks = async (req, res) => {
    try {
        const results = [...fakeTasksDB].reverse();
        res.json(results);
    } catch (error) {
        console.error('getAssignedTasks error:', error);
        res.status(500).json({ success: false, message: "Lỗi lấy danh sách công việc" });
    }
};

exports.completeTask = async (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = fakeTasksDB.findIndex(t => t.id === taskId);
    
    if (taskIndex !== -1) {
        fakeTasksDB[taskIndex].status = 'completed';
        res.json({ success: true, message: "Đã xác nhận hoàn thành công việc!" });
    } else {
        res.status(404).json({ success: false, message: "Không tìm thấy công việc" });
    }
};