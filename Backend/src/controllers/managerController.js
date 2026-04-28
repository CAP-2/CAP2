const db = require('../config/db');
const bcrypt = require('bcryptjs');
const {
    createTemporaryTreeEditKey: createTemporaryTreeEditKeyRecord,
    ensureMemberTreeEditKeysTable,
    assertTreeMutationPermission,
} = require('../utils/treeEditPermissions');
let hasEnsuredArchivedMembersTable = false;
let hasEnsuredPeopleTreeLayoutColumns = false;

const ensureArchivedMembersTable = async () => {
    if (hasEnsuredArchivedMembersTable) return;
    await db.query(`
        CREATE TABLE IF NOT EXISTS archived_members (
            id INT PRIMARY KEY AUTO_INCREMENT,
            account_id INT NOT NULL,
            archived_by_account_id INT NOT NULL,
            clan_id INT NULL,
            archived_reason TEXT NULL,
            account_json JSON NOT NULL,
            person_json JSON NULL,
            archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_archived_account (account_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    hasEnsuredArchivedMembersTable = true;
};

const ensurePeopleTreeLayoutColumns = async () => {
    if (hasEnsuredPeopleTreeLayoutColumns) return;

    const [columns] = await db.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'people'
          AND COLUMN_NAME IN ('tree_x', 'tree_y', 'display_order')
        `
    );
    const existing = new Set(columns.map((row) => row.COLUMN_NAME));
    const missing = [
        ['tree_x', 'INT DEFAULT 0'],
        ['tree_y', 'INT DEFAULT 0'],
        ['display_order', 'INT DEFAULT 0'],
    ].filter(([name]) => !existing.has(name));

    for (const [name, definition] of missing) {
        await db.query(`ALTER TABLE people ADD COLUMN ${name} ${definition}`);
    }

    hasEnsuredPeopleTreeLayoutColumns = true;
};

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

const parseTreeInt = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : fallback;
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

const buildPersonLabelFromRow = (row) => {
    if (!row) return null;
    const d = row.display_name != null ? String(row.display_name).trim() : '';
    if (d) return d;
    const s = row.surname == null ? '' : String(row.surname).trim();
    const m = row.middle_name == null ? '' : String(row.middle_name).trim();
    const f = row.first_name == null ? '' : String(row.first_name).trim();
    const name = [s, m, f].filter(Boolean).join(' ').trim();
    return name || (row.id != null ? `Hồ sơ #${row.id}` : null);
};

const fetchPeopleLabelsMap = async (ids) => {
    const unique = [...new Set((ids || []).map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))];
    if (!unique.length) return new Map();
    const [rows] = await db.query(
        `SELECT id, display_name, surname, middle_name, first_name FROM people WHERE id IN (${unique.map(() => '?').join(',')})`,
        unique
    );
    const m = new Map();
    for (const r of rows) {
        m.set(r.id, buildPersonLabelFromRow(r));
    }
    return m;
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
        `SELECT p.clan_id FROM accounts a LEFT JOIN people p ON a.person_id = p.id WHERE a.id = ? LIMIT 1`,
        [accountId]
    );
    if (accountRows?.[0]?.clan_id != null) return accountRows[0].clan_id;

    try {
        const [membershipRows] = await db.query(
            `SELECT clan_id FROM account_clans WHERE account_id = ? AND status = 'active' ORDER BY id ASC LIMIT 1`,
            [accountId]
        );
        if (membershipRows?.[0]?.clan_id != null) return membershipRows[0].clan_id;
    } catch (error) {
        if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }

    return null;
};

const assertClanExists = async (clanId) => {
    const cid = Number(clanId);
    if (!Number.isFinite(cid)) return false;
    const [rows] = await db.query('SELECT id FROM clans WHERE id = ? LIMIT 1', [cid]);
    return rows.length > 0;
};

const resolveManagedClanId = async (req, source = {}) => {
    if (req.user.role_id === 2) {
        return await getManagerClanId(req.user.id);
    }

    const rawClanId = source.clan_id ?? req.params?.clanId ?? req.query?.clan_id;
    const requestedClanId = Number(rawClanId);
    if (Number.isFinite(requestedClanId)) {
        return (await assertClanExists(requestedClanId)) ? requestedClanId : null;
    }

    const [rows] = await db.query('SELECT id FROM clans ORDER BY id ASC LIMIT 1');
    return rows[0]?.id ?? null;
};

const assertCanManagePersonId = async (req, personId) => {
    const pid = Number(personId);
    if (!Number.isFinite(pid) || pid <= 0) {
        return { ok: false, status: 400, message: 'person_id khong hop le' };
    }

    const [rows] = await db.query('SELECT id, clan_id, gender FROM people WHERE id = ? LIMIT 1', [pid]);
    if (!rows.length) {
        return { ok: false, status: 404, message: 'Khong tim thay nguoi trong gia pha' };
    }

    if (Number(req.user.role_id) === 2) {
        const managerClanId = await getManagerClanId(req.user.id);
        if (managerClanId == null) {
            return { ok: false, status: 404, message: 'Khong xac dinh duoc dong ho cua manager' };
        }
        if (Number(rows[0].clan_id) !== Number(managerClanId)) {
            return { ok: false, status: 403, message: 'Chi duoc thao tac voi nguoi trong cung dong ho' };
        }
    }

    return { ok: true, person: rows[0] };
};

const buildManagedFamilyTree = (peopleRows, familyRows, childRows) => {
    const peopleMap = new Map(peopleRows.map((p) => [p.id, p]));
    const childrenByFamily = new Map();
    for (const row of childRows) {
        if (!childrenByFamily.has(row.family_id)) childrenByFamily.set(row.family_id, []);
        childrenByFamily.get(row.family_id).push(row.person_id);
    }

    const childrenByParent = new Map();
    const spouseByPrimary = new Map();
    for (const fam of familyRows) {
        const childIds = childrenByFamily.get(fam.id) || [];
        const parentId = fam.father_id || fam.mother_id;
        if (!parentId) continue;
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
        const list = childrenByParent.get(parentId);
        for (const childId of childIds) {
            if (!list.includes(childId)) list.push(childId);
        }
        if (childIds.length > 0 && fam.father_id && fam.mother_id) {
            spouseByPrimary.set(parentId, parentId === fam.father_id ? fam.mother_id : fam.father_id);
        }
    }

    const generations = peopleRows.map((p) => Number(p.generation)).filter((g) => Number.isFinite(g) && g > 0);
    const rootGeneration = generations.length ? Math.min(...generations) : 1;
    const rootCandidates = peopleRows.filter((p) => Number(p.generation || rootGeneration) === rootGeneration);
    const placed = new Set();

    const buildNode = (personId) => {
        const person = peopleMap.get(personId);
        if (!person || placed.has(personId)) return null;
        placed.add(personId);

        const spouseId = spouseByPrimary.get(personId);
        let spouse = null;
        if (spouseId && peopleMap.has(spouseId) && !placed.has(spouseId)) {
            spouse = peopleMap.get(spouseId);
            placed.add(spouseId);
        }

        const children = [];
        for (const childId of childrenByParent.get(personId) || []) {
            const childNode = buildNode(childId);
            if (childNode) children.push(childNode);
        }
        return { person, spouse, children };
    };

    const roots = [];
    for (const root of rootCandidates) {
        const node = buildNode(root.id);
        if (node) roots.push(node);
    }
    for (const person of peopleRows) {
        const node = buildNode(person.id);
        if (node) roots.push(node);
    }

    return { roots };
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

        const labelIds = [];
        if (bloodline?.parent_father_id) labelIds.push(bloodline.parent_father_id);
        if (bloodline?.parent_mother_id) labelIds.push(bloodline.parent_mother_id);
        if (marriage.spouse_id) labelIds.push(marriage.spouse_id);
        if (Array.isArray(marriage.children_ids)) labelIds.push(...marriage.children_ids);
        const labelMap = await fetchPeopleLabelsMap(labelIds);

        const bloodlineOut = bloodline
            ? {
                  family_id: bloodline.family_id,
                  parent_father_id: bloodline.parent_father_id,
                  parent_mother_id: bloodline.parent_mother_id,
                  parent_father_name: bloodline.parent_father_id
                      ? labelMap.get(bloodline.parent_father_id) || null
                      : null,
                  parent_mother_name: bloodline.parent_mother_id
                      ? labelMap.get(bloodline.parent_mother_id) || null
                      : null,
              }
            : null;

        const children_ids = marriage.children_ids || [];
        const children = children_ids.map((cid) => ({
            person_id: cid,
            name: labelMap.get(cid) || `Hồ sơ #${cid}`,
        }));

        return res.json({
            success: true,
            account_id: context.account_id,
            person_id: context.person_id,
            clan_id: context.clan_id,
            gender: context.gender,
            bloodline: bloodlineOut,
            marriage: {
                family_id: marriage.family_id,
                spouse_id: marriage.spouse_id,
                spouse_name: marriage.spouse_id ? labelMap.get(marriage.spouse_id) || null : null,
                children_ids,
                children,
                is_married: Boolean(marriage.spouse_id),
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

exports.getFamilyTree = async (req, res) => {
    try {
        await ensureArchivedMembersTable();
        await ensurePeopleTreeLayoutColumns();
        const clanId = await resolveManagedClanId(req);
        if (clanId == null) {
            return res.status(404).json({ success: false, message: 'Không xác định được dòng họ cần quản lý' });
        }

        const [clanRows] = await db.query(
            'SELECT id, clan_name, history, hall_address, created_at FROM clans WHERE id = ? LIMIT 1',
            [clanId]
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
                p.avatar_url,
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
            LEFT JOIN archived_members am ON am.account_id = a.id
            WHERE p.clan_id = ?
              AND am.id IS NULL
            ORDER BY p.generation, p.display_order, p.surname, p.middle_name, p.first_name, p.id
            `,
            [clanId]
        );

        const [familyRows] = await db.query(
            'SELECT id, clan_id, father_id, mother_id, marriage_date FROM families WHERE clan_id = ? ORDER BY id ASC',
            [clanId]
        );
        const [childRows] = await db.query(
            `
            SELECT c.family_id, c.person_id, c.sort_order
            FROM children c
            INNER JOIN families f ON c.family_id = f.id
            WHERE f.clan_id = ?
            ORDER BY c.family_id, c.sort_order, c.id
            `,
            [clanId]
        );

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
            })),
            children: childRows,
            familyTree: buildManagedFamilyTree(peopleRows, familyRows, childRows),
        });
    } catch (error) {
        console.error('getFamilyTree error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy cây gia phả' });
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
        await ensureArchivedMembersTable();
        let sql = `
            SELECT a.id AS account_id, a.email, a.role_id, a.status,
                   p.id AS person_id, p.display_name, p.first_name, p.middle_name, p.surname,
                   p.birth_date, p.death_date, p.is_living, p.clan_id, p.gender,
                   p.generation, p.branch, p.hometown, p.address, p.phone, p.avatar_url, p.bio
            FROM accounts a
            JOIN people p ON a.person_id = p.id
            LEFT JOIN archived_members am ON am.account_id = a.id
            WHERE a.role_id IN (2,3) AND a.status = 'active'
              AND am.id IS NULL
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
        res.json(
            results.map((m) => ({
                ...m,
                birth_date: fmtSqlDate(m.birth_date),
                death_date: fmtSqlDate(m.death_date),
            }))
        );
    } catch (error) {
        console.error('getAllMembers error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách thành viên' });
    }
};

const normalizeTreeEditKeyMemberIds = (body = {}) => {
    const raw = Array.isArray(body.member_account_ids)
        ? body.member_account_ids
        : Array.isArray(body.member_ids)
          ? body.member_ids
          : [body.member_account_id];
    return [...new Set(raw.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
};

const buildTreeEditMemberName = (row) =>
    row?.display_name ||
    [row?.surname, row?.middle_name, row?.first_name].filter(Boolean).join(' ').trim() ||
    `Member #${row?.account_id}`;

const loadTreeEditKeyTargets = async (req, memberAccountIds) => {
    const placeholders = memberAccountIds.map(() => '?').join(',');
    const [rows] = await db.query(
        `
        SELECT
            a.id AS account_id,
            a.role_id,
            a.status,
            p.id AS person_id,
            p.clan_id,
            p.display_name,
            p.first_name,
            p.middle_name,
            p.surname
        FROM accounts a
        INNER JOIN people p ON a.person_id = p.id
        WHERE a.id IN (${placeholders})
        `,
        memberAccountIds
    );

    const byAccountId = new Map(rows.map((row) => [Number(row.account_id), row]));
    const targets = memberAccountIds.map((id) => byAccountId.get(Number(id))).filter(Boolean);

    if (targets.length !== memberAccountIds.length) {
        return { ok: false, status: 404, message: 'Khong tim thay mot hoac nhieu member duoc cap key' };
    }
    if (targets.some((target) => Number(target.role_id) !== 3)) {
        return { ok: false, status: 400, message: 'Chi co the cap temporary edit key cho member' };
    }
    if (targets.some((target) => String(target.status) !== 'active')) {
        return { ok: false, status: 400, message: 'Mot hoac nhieu tai khoan member chua active' };
    }
    if (targets.some((target) => !Number(target.person_id) || !Number(target.clan_id))) {
        return { ok: false, status: 400, message: 'Mot hoac nhieu member chua lien ket day du voi ho so dong ho' };
    }

    if (Number(req.user.role_id) === 2) {
        const managerClanId = await getManagerClanId(req.user.id);
        if (managerClanId == null) {
            return { ok: false, status: 404, message: 'Khong xac dinh duoc dong ho cua manager' };
        }
        if (targets.some((target) => Number(managerClanId) !== Number(target.clan_id))) {
            return { ok: false, status: 403, message: 'Chi duoc cap key cho member trong cung dong ho' };
        }
    }

    return { ok: true, targets };
};

exports.createTemporaryTreeEditKey = async (req, res) => {
    try {
        const memberAccountIds = normalizeTreeEditKeyMemberIds(req.body);
        if (!memberAccountIds.length) {
            return res.status(400).json({ success: false, message: 'member_account_ids khong hop le' });
        }

        const targetResult = await loadTreeEditKeyTargets(req, memberAccountIds);
        if (!targetResult.ok) {
            return res.status(targetResult.status).json({ success: false, message: targetResult.message });
        }

        const keys = [];
        for (const target of targetResult.targets) {
            const created = await createTemporaryTreeEditKeyRecord({
                memberAccountId: target.account_id,
                memberPersonId: target.person_id,
                clanId: target.clan_id,
                createdByAccountId: req.user.id,
            });

            keys.push({
                member_account_id: target.account_id,
                member_person_id: target.person_id,
                member_name: buildTreeEditMemberName(target),
                key: created.rawKey,
                expires_at: created.expiresAt,
                created_at: new Date(),
            });
        }

        const first = keys[0] || {};
        return res.json({
            success: true,
            keys,
            created_count: keys.length,
            member_account_id: first.member_account_id,
            member_person_id: first.member_person_id,
            member_name: first.member_name,
            key: first.key,
            expires_at: first.expires_at,
        });
    } catch (error) {
        console.error('createTemporaryTreeEditKey error:', error);
        return res.status(500).json({ success: false, message: 'Loi tao temporary edit key' });
    }
};

exports.getActiveTreeEditKeys = async (req, res) => {
    try {
        await ensureMemberTreeEditKeysTable();
        const clanId = await resolveManagedClanId(req);
        if (clanId == null) {
            return res.status(404).json({ success: false, message: 'Khong xac dinh duoc dong ho can quan ly' });
        }

        const [rows] = await db.query(
            `
            SELECT
                k.id,
                k.member_account_id,
                k.member_person_id,
                k.clan_id,
                k.raw_key,
                k.expires_at,
                k.created_at,
                k.created_by_account_id,
                p.display_name,
                p.first_name,
                p.middle_name,
                p.surname
            FROM member_tree_edit_keys k
            INNER JOIN people p ON p.id = k.member_person_id
            WHERE k.clan_id = ?
              AND k.expires_at > NOW()
            ORDER BY k.created_at DESC, k.id DESC
            `,
            [clanId]
        );

        return res.json({
            success: true,
            keys: rows.map((row) => ({
                id: row.id,
                member_account_id: row.member_account_id,
                member_person_id: row.member_person_id,
                member_name: buildTreeEditMemberName({ ...row, account_id: row.member_account_id }),
                key: row.raw_key || '',
                expires_at: row.expires_at,
                created_at: row.created_at,
                created_by_account_id: row.created_by_account_id,
            })),
        });
    } catch (error) {
        console.error('getActiveTreeEditKeys error:', error);
        return res.status(500).json({ success: false, message: 'Loi lay danh sach temporary edit key' });
    }
};

exports.getArchivedMembers = async (req, res) => {
    try {
        await ensureArchivedMembersTable();
        let sql = `
            SELECT id, account_id, archived_by_account_id, clan_id, archived_reason, archived_at,
                   JSON_UNQUOTE(JSON_EXTRACT(account_json, '$.email')) AS email,
                   JSON_UNQUOTE(JSON_EXTRACT(person_json, '$.surname')) AS surname,
                   JSON_UNQUOTE(JSON_EXTRACT(person_json, '$.middle_name')) AS middle_name,
                   JSON_UNQUOTE(JSON_EXTRACT(person_json, '$.first_name')) AS first_name
            FROM archived_members
        `;
        const params = [];
        if (req.user.role_id === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (clanId === null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            sql += ' WHERE clan_id = ?';
            params.push(clanId);
        }
        sql += ' ORDER BY archived_at DESC, id DESC';
        const [rows] = await db.query(sql, params);
        return res.json({ success: true, items: rows });
    } catch (error) {
        console.error('getArchivedMembers error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi lấy kho lưu trữ thành viên' });
    }
};

exports.archiveMember = async (req, res) => {
    try {
        await ensureArchivedMembersTable();
        const targetAccountId = Number(req.params.id);
        if (!Number.isFinite(targetAccountId)) {
            return res.status(400).json({ success: false, message: 'account_id không hợp lệ' });
        }
        const gate = await assertCanManageAccount(req, targetAccountId);
        if (!gate.ok) return res.status(gate.status).json({ success: false, message: gate.message });
        const reason = req.body?.reason ? String(req.body.reason).trim() : null;
        const { context } = gate;

        const [accRows] = await db.query('SELECT * FROM accounts WHERE id = ? LIMIT 1', [targetAccountId]);
        if (!accRows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản thành viên' });
        }
        const [personRows] = await db.query('SELECT * FROM people WHERE id = ? LIMIT 1', [context.person_id]);

        await db.query(
            `INSERT INTO archived_members
             (account_id, archived_by_account_id, clan_id, archived_reason, account_json, person_json)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                archived_by_account_id = VALUES(archived_by_account_id),
                clan_id = VALUES(clan_id),
                archived_reason = VALUES(archived_reason),
                account_json = VALUES(account_json),
                person_json = VALUES(person_json),
                archived_at = CURRENT_TIMESTAMP`,
            [
                targetAccountId,
                req.user.id,
                context.clan_id ?? null,
                reason,
                JSON.stringify(accRows[0]),
                personRows[0] ? JSON.stringify(personRows[0]) : null,
            ]
        );

        return res.json({ success: true, message: 'Đã chuyển thành viên vào kho lưu trữ.' });
    } catch (error) {
        console.error('archiveMember error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi lưu trữ thành viên' });
    }
};

exports.deleteArchivedMemberPermanently = async (req, res) => {
    try {
        await ensureArchivedMembersTable();
        const archiveId = Number(req.params.id);
        if (!Number.isFinite(archiveId)) {
            return res.status(400).json({ success: false, message: 'archive_id không hợp lệ' });
        }
        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            const [rows] = await db.query('SELECT clan_id FROM archived_members WHERE id = ? LIMIT 1', [archiveId]);
            if (!rows.length || Number(rows[0].clan_id) !== Number(managerClanId)) {
                return res.status(403).json({ success: false, message: 'Chỉ được xóa dữ liệu lưu trữ của cùng dòng họ' });
            }
        }
        const [archivedRows] = await db.query('SELECT account_id FROM archived_members WHERE id = ? LIMIT 1', [archiveId]);
        if (!archivedRows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi lưu trữ' });
        }
        const accountId = Number(archivedRows[0].account_id);

        const [ctxRows] = await db.query('SELECT person_id FROM accounts WHERE id = ? LIMIT 1', [accountId]);
        const personId = ctxRows[0]?.person_id ?? null;
        if (personId) {
            await db.query('UPDATE families SET father_id = NULL WHERE father_id = ?', [personId]);
            await db.query('UPDATE families SET mother_id = NULL WHERE mother_id = ?', [personId]);
            await db.query('DELETE FROM children WHERE person_id = ?', [personId]);
            await db.query('DELETE FROM people WHERE id = ?', [personId]);
        }
        await db.query('DELETE FROM accounts WHERE id = ?', [accountId]);
        const [result] = await db.query('DELETE FROM archived_members WHERE id = ?', [archiveId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi lưu trữ' });
        }
        return res.json({ success: true, message: 'Đã xóa vĩnh viễn khỏi kho lưu trữ.' });
    } catch (error) {
        console.error('deleteArchivedMemberPermanently error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi xóa vĩnh viễn bản ghi lưu trữ' });
    }
};

exports.restoreArchivedMember = async (req, res) => {
    try {
        await ensureArchivedMembersTable();
        const archiveId = Number(req.params.id);
        if (!Number.isFinite(archiveId)) {
            return res.status(400).json({ success: false, message: 'archive_id không hợp lệ' });
        }

        const [rows] = await db.query('SELECT * FROM archived_members WHERE id = ? LIMIT 1', [archiveId]);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi lưu trữ' });
        }
        const archived = rows[0];

        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được clan của manager' });
            }
            if (Number(archived.clan_id) !== Number(managerClanId)) {
                return res.status(403).json({ success: false, message: 'Chỉ được phục hồi thành viên cùng dòng họ' });
            }
        }

        const accountId = Number(archived.account_id);
        if (!Number.isFinite(accountId)) {
            return res.status(400).json({ success: false, message: 'Bản ghi lưu trữ không có account_id hợp lệ' });
        }
        await db.query('DELETE FROM archived_members WHERE id = ?', [archiveId]);
        return res.json({
            success: true,
            message: 'Phục hồi thành viên thành công.',
            account_id: accountId,
        });
    } catch (error) {
        console.error('restoreArchivedMember error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi phục hồi thành viên' });
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

        if ((Number(req.user.role_id) === 1 || Number(req.user.role_id) === 2) && has('role_id')) {
            const rid = Number(body.role_id);
            if (rid !== 2 && rid !== 3) {
                return res.status(400).json({ success: false, message: 'Vai trÃ² chá»‰ há»— trá»£ Manager hoáº·c Member' });
            }
            if (Number(req.user.role_id) === 2) {
                if (targetAccountId === Number(req.user.id) && rid !== Number(full.role_id)) {
                    return res.status(400).json({ success: false, message: 'Manager khÃ´ng thá»ƒ tá»± Ä‘á»•i vai trÃ² cá»§a chÃ­nh mÃ¬nh' });
                }
                if (rid === 3 && Number(full.role_id) !== 3) {
                    return res.status(403).json({ success: false, message: 'Manager chá»‰ Ä‘Æ°á»£c chá»‰ Ä‘á»‹nh thÃ nh viÃªn lÃªn Manager, khÃ´ng Ä‘Æ°á»£c háº¡ vai trÃ² Manager khÃ¡c' });
                }
            }
            if (rid !== Number(full.role_id)) {
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
            SELECT p.id as post_id, p.description, p.content, p.image_url, p.created_at, author.display_name as author_name, author.email as author_email
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

exports.getMedia = async (req, res) => {
    try {
        let sql = `
            SELECT p.id as post_id, p.description, p.content, p.image_url, p.created_at, author.display_name as author_name
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

let hasEnsuredTaskTables = false;

const ensureTaskTables = async () => {
    if (hasEnsuredTaskTables) return;
    await db.query(`
        CREATE TABLE IF NOT EXISTS manager_tasks (
            id INT PRIMARY KEY AUTO_INCREMENT,
            manager_account_id INT NOT NULL,
            clan_id INT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            due_date DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_manager_tasks_manager (manager_account_id),
            KEY idx_manager_tasks_clan (clan_id),
            CONSTRAINT fk_manager_tasks_account FOREIGN KEY (manager_account_id) REFERENCES accounts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS manager_task_assignments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            task_id INT NOT NULL,
            member_account_id INT NOT NULL,
            member_person_id INT NOT NULL,
            status ENUM('assigned', 'in_progress', 'completed') DEFAULT 'assigned',
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL DEFAULT NULL,
            UNIQUE KEY uk_task_member (task_id, member_account_id),
            KEY idx_task_assignments_member (member_account_id),
            KEY idx_task_assignments_person (member_person_id),
            CONSTRAINT fk_task_assignments_task FOREIGN KEY (task_id) REFERENCES manager_tasks(id) ON DELETE CASCADE,
            CONSTRAINT fk_task_assignments_account FOREIGN KEY (member_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            CONSTRAINT fk_task_assignments_person FOREIGN KEY (member_person_id) REFERENCES people(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    hasEnsuredTaskTables = true;
};

const normalizeTaskMemberIds = (body) => {
    const raw = Array.isArray(body.member_ids) ? body.member_ids : [body.member_id];
    return [...new Set(raw.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0))];
};

const emitNotificationToAccount = async (req, receiverAccountId, payload) => {
    const onlineUsers = req.app?.locals?.onlineUsers || {};
    const io = req.app?.locals?.io;
    const socketId = onlineUsers[receiverAccountId];
    if (io && socketId) {
        io.to(socketId).emit("new_notification", {
            ...payload,
            time: new Date().toLocaleTimeString(),
        });
    }
};

exports.assignTask = async (req, res) => {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const dueDate = req.body.due_date || null;
    const memberIds = normalizeTaskMemberIds(req.body);

    try {
        await ensureTaskTables();
        if (!title) {
            return res.status(400).json({ success: false, message: "Tiêu đề công việc không được để trống" });
        }
        if (!memberIds.length) {
            return res.status(400).json({ success: false, message: "Vui lòng chọn ít nhất một thành viên" });
        }

        let managerClanId = null;
        if (req.user.role_id === 2) {
            managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: "Không xác định được clan của manager" });
            }
        }

        const placeholders = memberIds.map(() => "?").join(",");
        const [memberRows] = await db.query(
            `
            SELECT a.id AS account_id, a.person_id, p.clan_id, p.display_name, p.surname, p.first_name
            FROM accounts a
            INNER JOIN people p ON p.id = a.person_id
            WHERE a.id IN (${placeholders}) AND a.role_id = 3 AND a.status = 'active'
            `,
            memberIds
        );
        if (memberRows.length !== memberIds.length) {
            return res.status(400).json({ success: false, message: "Một hoặc nhiều thành viên không hợp lệ hoặc chưa kích hoạt" });
        }
        if (managerClanId != null && memberRows.some((m) => m.clan_id !== managerClanId)) {
            return res.status(403).json({ success: false, message: "Manager chỉ được giao việc cho thành viên cùng dòng họ" });
        }

        const taskClanId = managerClanId ?? memberRows[0]?.clan_id ?? null;
        const [taskResult] = await db.query(
            "INSERT INTO manager_tasks (manager_account_id, clan_id, title, description, due_date) VALUES (?, ?, ?, ?, ?)",
            [req.user.id, taskClanId, title, description || null, dueDate || null]
        );

        for (const member of memberRows) {
            await db.query(
                "INSERT INTO manager_task_assignments (task_id, member_account_id, member_person_id) VALUES (?, ?, ?)",
                [taskResult.insertId, member.account_id, member.person_id]
            );
            await db.query(
                "INSERT INTO notifications (receiver_person_id, type, title, message, link_url) VALUES (?, ?, ?, ?, ?)",
                [
                    member.person_id,
                    "task_assigned",
                    `Cong viec moi: ${title}`,
                    `Ban duoc giao cong viec "${title}"${dueDate ? `, han chot ${dueDate}` : ""}.`,
                    `/member/tasks/${taskResult.insertId}`,
                ]
            );
            await emitNotificationToAccount(req, member.account_id, {
                type: "task_assigned",
                title: "Cong viec moi",
                message: `Ban duoc giao cong viec: "${title}"`,
                dueDate: dueDate,
                taskId: taskResult.insertId,
            });
        }

        return res.json({
            success: true,
            message: "Đã giao việc thành công",
            task_id: taskResult.insertId,
            assigned_count: memberRows.length,
        });
    } catch (error) {
        console.error('assignTask error:', error);
        res.status(500).json({ success: false, message: "Lỗi phân công công việc" });
    }
};

exports.getAssignedTasks = async (req, res) => {
    try {
        await ensureTaskTables();
        let sql = `
            SELECT
                a.id,
                a.task_id,
                t.title,
                t.description,
                t.due_date,
                t.created_at,
                a.status,
                a.assigned_at,
                a.completed_at,
                m.id AS manager_id,
                COALESCE(mp.display_name, m.email) AS manager_name,
                member.id AS member_id,
                member.display_name AS member_name,
                member.surname,
                member.first_name
            FROM manager_task_assignments a
            INNER JOIN manager_tasks t ON t.id = a.task_id
            INNER JOIN accounts m ON m.id = t.manager_account_id
            LEFT JOIN people mp ON mp.id = m.person_id
            INNER JOIN people member ON member.id = a.member_person_id
        `;
        const params = [];
        if (req.user.role_id === 2) {
            const clanId = await getManagerClanId(req.user.id);
            if (clanId == null) {
                return res.status(404).json({ success: false, message: "Không xác định được clan của manager" });
            }
            sql += " WHERE t.manager_account_id = ? AND t.clan_id = ?";
            params.push(req.user.id, clanId);
        } else {
            sql += " WHERE 1=1";
        }
        sql += " ORDER BY t.created_at DESC, a.id DESC";
        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (error) {
        console.error('getAssignedTasks error:', error);
        res.status(500).json({ success: false, message: "Lỗi lấy danh sách công việc" });
    }
};

exports.completeTask = async (req, res) => {
    const assignmentId = parseInt(req.params.id);
    try {
        await ensureTaskTables();
        if (!Number.isFinite(assignmentId)) {
            return res.status(400).json({ success: false, message: "ID công việc không hợp lệ" });
        }
        let sql = `
            SELECT a.id
            FROM manager_task_assignments a
            INNER JOIN manager_tasks t ON t.id = a.task_id
            WHERE a.id = ?
        `;
        const params = [assignmentId];
        if (req.user.role_id === 2) {
            sql += " AND t.manager_account_id = ?";
            params.push(req.user.id);
        }
        const [rows] = await db.query(sql, params);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: "Không tìm thấy công việc" });
        }
        await db.query(
            "UPDATE manager_task_assignments SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
            [assignmentId]
        );
        res.json({ success: true, message: "Đã xác nhận hoàn thành công việc!" });
    } catch (error) {
        console.error('completeTask error:', error);
        res.status(500).json({ success: false, message: "Lỗi cập nhật công việc" });
    }
};

// ==============================================================
// --- QUẢN LÝ CẬP NHẬT HỒ SƠ TỪ NHÁNH MAIN ---
// ==============================================================
exports.getPendingProfileUpdates = async (req, res) => {
    try {
        let sql = `
            SELECT id as person_id, display_name, surname, first_name, pending_bio, pending_avatar_url, bio as current_bio, avatar_url as current_avatar_url, clan_id
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

exports.approveProfileUpdate = async (req, res) => {
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
                pending_bio = NULL,
                pending_avatar_url = NULL,
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

exports.rejectProfileUpdate = async (req, res) => {
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
exports.createPerson = async (req, res) => {
    try {
        const permission = await assertTreeMutationPermission(req, {
            action: 'create_person',
        });
        if (!permission.ok) {
            return res.status(permission.status).json({ success: false, message: permission.message });
        }

        await ensurePeopleTreeLayoutColumns();
        const {
            display_name,
            surname,
            middle_name,
            first_name,
            gender,
            birth_date,
            death_date,
            is_living,
            generation,
            branch,
            hometown,
            address,
            phone,
            email,
            avatar_url,
            bio,
            note,
            tree_x,
            tree_y,
            display_order,
            parent_father_id,
            parent_mother_id,
            father_person_id,
            mother_person_id,
        } = req.body;

        const clanId = await resolveManagedClanId(req, req.body);
        if (clanId == null) {
            return res.status(404).json({ success: false, message: 'Không xác định được dòng họ cần quản lý' });
        }

        const sn = surname != null ? String(surname).trim() : '';
        const mid = middle_name != null ? String(middle_name).trim() : '';
        const fn = first_name != null ? String(first_name).trim() : '';
        const display = String(display_name || buildDisplayNameFromPartsMgr(sn, mid, fn)).trim();
        if (!display && !sn && !fn) {
            return res.status(400).json({ success: false, message: 'Cần nhập họ tên thành viên' });
        }

        let genderValue = null;
        if (gender !== undefined && gender !== null && String(gender).trim() !== '') {
            const g = Number(gender);
            genderValue = g === 1 || g === 2 ? g : null;
        }

        const generationValue = Number(generation);
        const branchValue = branch === undefined || branch === null || branch === '' ? null : Number(branch);
        const livingValue = is_living === undefined || is_living === null || is_living === '' ? 1 : Number(is_living) ? 1 : 0;
        const treeXValue = parseTreeInt(tree_x, 0);
        const treeYValue = parseTreeInt(tree_y, 0);
        const displayOrderValue = parseTreeInt(display_order, 0);

        const [personResult] = await db.query(
            `INSERT INTO people (
                clan_id, display_name, first_name, middle_name, surname, gender, generation, branch,
                birth_date, death_date, is_living, phone, email, address, hometown, avatar_url, bio, note,
                tree_x, tree_y, display_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                clanId,
                display || buildDisplayNameFromPartsMgr(sn, mid, fn),
                fn,
                mid,
                sn,
                genderValue,
                Number.isFinite(generationValue) && generationValue > 0 ? generationValue : 1,
                Number.isFinite(branchValue) ? branchValue : null,
                birth_date ? String(birth_date).trim() : null,
                death_date ? String(death_date).trim() : null,
                livingValue,
                phone != null ? String(phone).trim() : null,
                email != null ? String(email).trim() : null,
                address != null ? String(address).trim() : null,
                hometown != null ? String(hometown).trim() : null,
                avatar_url != null ? String(avatar_url).trim() || null : null,
                bio != null ? String(bio).trim() : null,
                note != null ? String(note).trim() : null,
                treeXValue,
                treeYValue,
                displayOrderValue,
            ]
        );

        const personId = personResult.insertId;
        const fatherId = parseNullableId(parent_father_id ?? father_person_id);
        const motherId = parseNullableId(parent_mother_id ?? mother_person_id);
        if (fatherId || motherId) {
            const relation = await applyBloodlineForPerson(personId, clanId, fatherId, motherId);
            if (!relation.ok) {
                await db.query('DELETE FROM people WHERE id = ?', [personId]);
                return res.status(400).json({ success: false, message: relation.message });
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Đã tạo người trong gia phả',
            person_id: personId,
        });
    } catch (error) {
        console.error('createPerson error:', error);
        res.status(500).json({ success: false, message: 'Lỗi tạo người trong gia phả' });
    }
};

exports.linkRelations = async (req, res) => {
    try {
        const body = req.body || {};
        const personId = parseNullableId(body.person_id ?? body.id);
        if (!personId) {
            return res.status(400).json({ success: false, message: 'person_id không hợp lệ' });
        }

        const permission = await assertTreeMutationPermission(req, {
            action: 'link_relations',
            affectedPersonIds: [personId],
        });
        if (!permission.ok) {
            return res.status(permission.status).json({ success: false, message: permission.message });
        }

        const [personRows] = await db.query('SELECT id, clan_id, gender FROM people WHERE id = ? LIMIT 1', [personId]);
        if (!personRows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người trong gia phả' });
        }

        const person = personRows[0];
        if (req.user.role_id === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (managerClanId == null) {
                return res.status(404).json({ success: false, message: 'Không xác định được dòng họ của manager' });
            }
            if (Number(person.clan_id) !== Number(managerClanId)) {
                return res.status(403).json({ success: false, message: 'Chỉ được liên kết người trong cùng dòng họ' });
            }
        }

        const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
        const hasBloodline =
            has('parent_father_id') || has('parent_mother_id') || has('father_person_id') || has('mother_person_id');
        if (hasBloodline) {
            const fatherId = parseNullableId(body.parent_father_id ?? body.father_person_id);
            const motherId = parseNullableId(body.parent_mother_id ?? body.mother_person_id);
            if (fatherId || motherId) {
                const relation = await applyBloodlineForPerson(personId, person.clan_id, fatherId, motherId);
                if (!relation.ok) return res.status(400).json({ success: false, message: relation.message });
            } else {
                await db.query('DELETE FROM children WHERE person_id = ?', [personId]);
            }
        }

        const hasMarriage =
            has('family_id') || has('spouse_id') || has('spouse_person_id') || has('children_ids') || has('children_person_ids');
        if (hasMarriage) {
            const relationBody = {};
            if (has('family_id')) relationBody.family_id = body.family_id;
            if (has('spouse_id') || has('spouse_person_id')) relationBody.spouse_id = body.spouse_id ?? body.spouse_person_id;
            if (has('children_ids') || has('children_person_ids')) relationBody.children_ids = body.children_ids ?? body.children_person_ids;

            const relation = await applyMarriageRelationsForPerson(
                { person_id: personId, clan_id: person.clan_id, gender: person.gender },
                relationBody
            );
            if (!relation.ok) return res.status(400).json({ success: false, message: relation.message });
        }

        return res.json({ success: true, message: 'Đã lưu liên kết gia phả' });
    } catch (error) {
        console.error('linkRelations error:', error);
        res.status(500).json({ success: false, message: 'Lỗi liên kết quan hệ' });
    }
};

exports.updateTreePerson = async (req, res) => {
    try {
        await ensurePeopleTreeLayoutColumns();
        const personId = Number(req.params.id);
        const permission = await assertTreeMutationPermission(req, {
            action: 'update_person',
            affectedPersonIds: [personId],
        });
        if (!permission.ok) {
            return res.status(permission.status).json({ success: false, message: permission.message });
        }
        const gate = await assertCanManagePersonId(req, personId);
        if (!gate.ok) return res.status(gate.status).json({ success: false, message: gate.message });

        const [rows] = await db.query('SELECT * FROM people WHERE id = ? LIMIT 1', [personId]);
        const current = rows[0];
        const body = req.body || {};
        const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

        const strOrKeep = (key, currentValue) => {
            if (!has(key)) return currentValue ?? '';
            if (body[key] === null) return '';
            return String(body[key]).trim();
        };
        const dateOrKeep = (key, currentValue) => {
            if (!has(key)) return currentValue;
            if (body[key] === null || body[key] === '') return null;
            const value = String(body[key]).trim();
            return value || null;
        };

        const nextSurname = strOrKeep('surname', current.surname);
        const nextMiddle = strOrKeep('middle_name', current.middle_name);
        const nextFirst = strOrKeep('first_name', current.first_name);
        let nextDisplay = has('display_name') ? String(body.display_name || '').trim() : (current.display_name || '').trim();
        nextDisplay = nextDisplay || buildDisplayNameFromPartsMgr(nextSurname, nextMiddle, nextFirst);
        if (!nextDisplay && !nextSurname && !nextFirst) {
            return res.status(400).json({ success: false, message: 'Can nhap ho ten thanh vien' });
        }

        let nextGender = current.gender;
        if (has('gender')) {
            if (body.gender === null || body.gender === '') nextGender = null;
            else {
                const g = Number(body.gender);
                nextGender = g === 1 || g === 2 ? g : current.gender;
            }
        }

        let nextGeneration = current.generation;
        if (has('generation')) {
            const g = Number(body.generation);
            nextGeneration = Number.isFinite(g) && g > 0 ? g : current.generation || 1;
        }

        let nextBranch = current.branch;
        if (has('branch')) {
            if (body.branch === null || body.branch === '') nextBranch = null;
            else {
                const b = Number(body.branch);
                nextBranch = Number.isFinite(b) ? b : current.branch;
            }
        }

        let nextLiving = current.is_living;
        if (has('is_living')) {
            nextLiving = body.is_living === true || body.is_living === 1 || body.is_living === '1' ? 1 : 0;
        }

        let nextClanId = current.clan_id;
        if (Number(req.user.role_id) === 1 && has('clan_id')) {
            const cid = Number(body.clan_id);
            if (Number.isFinite(cid)) {
                const [clanRows] = await db.query('SELECT id FROM clans WHERE id = ? LIMIT 1', [cid]);
                if (!clanRows.length) {
                    return res.status(400).json({ success: false, message: 'clan_id khong ton tai' });
                }
                nextClanId = cid;
            }
        }

        const nextTreeX = has('tree_x') ? parseTreeInt(body.tree_x, current.tree_x || 0) : current.tree_x || 0;
        const nextTreeY = has('tree_y') ? parseTreeInt(body.tree_y, current.tree_y || 0) : current.tree_y || 0;
        const nextDisplayOrder = has('display_order')
            ? parseTreeInt(body.display_order, current.display_order || 0)
            : current.display_order || 0;

        await db.query(
            `UPDATE people SET
                clan_id = ?, display_name = ?, first_name = ?, middle_name = ?, surname = ?,
                gender = ?, birth_date = ?, death_date = ?, is_living = ?, generation = ?, branch = ?,
                hometown = ?, address = ?, phone = ?, email = ?, zalo = ?, facebook = ?,
                avatar_url = ?, bio = ?, note = ?, tree_x = ?, tree_y = ?, display_order = ?
             WHERE id = ?`,
            [
                nextClanId,
                nextDisplay,
                nextFirst,
                nextMiddle,
                nextSurname,
                nextGender,
                dateOrKeep('birth_date', current.birth_date),
                dateOrKeep('death_date', current.death_date),
                nextLiving,
                nextGeneration,
                nextBranch,
                strOrKeep('hometown', current.hometown),
                strOrKeep('address', current.address),
                strOrKeep('phone', current.phone),
                strOrKeep('email', current.email),
                strOrKeep('zalo', current.zalo),
                strOrKeep('facebook', current.facebook),
                strOrKeep('avatar_url', current.avatar_url) || null,
                strOrKeep('bio', current.bio),
                strOrKeep('note', current.note),
                nextTreeX,
                nextTreeY,
                nextDisplayOrder,
                personId,
            ]
        );

        const hasBloodline = has('parent_father_id') || has('parent_mother_id') || has('father_person_id') || has('mother_person_id');
        if (permission.scope === 'limited' && hasBloodline) {
            return res.status(403).json({
                success: false,
                message: 'Temporary edit key khong cho phep sua quan he cha me.',
            });
        }
        if (hasBloodline) {
            const fatherId = parseNullableId(body.parent_father_id ?? body.father_person_id);
            const motherId = parseNullableId(body.parent_mother_id ?? body.mother_person_id);
            if (fatherId || motherId) {
                const relation = await applyBloodlineForPerson(personId, nextClanId, fatherId, motherId);
                if (!relation.ok) return res.status(400).json({ success: false, message: relation.message });
            } else {
                await db.query('DELETE FROM children WHERE person_id = ?', [personId]);
            }
        }

        const hasMarriage = has('family_id') || has('spouse_id') || has('spouse_person_id') || has('children_ids') || has('children_person_ids');
        if (permission.scope === 'limited' && hasMarriage) {
            return res.status(403).json({
                success: false,
                message: 'Temporary edit key khong cho phep sua quan he hon nhan va con cai.',
            });
        }
        if (hasMarriage) {
            const relationBody = {};
            if (has('family_id')) relationBody.family_id = body.family_id;
            if (has('spouse_id') || has('spouse_person_id')) relationBody.spouse_id = body.spouse_id ?? body.spouse_person_id;
            if (has('children_ids') || has('children_person_ids')) relationBody.children_ids = body.children_ids ?? body.children_person_ids;
            const relation = await applyMarriageRelationsForPerson(
                { person_id: personId, clan_id: nextClanId, gender: nextGender },
                relationBody
            );
            if (!relation.ok) return res.status(400).json({ success: false, message: relation.message });
        }

        const [updatedRows] = await db.query('SELECT * FROM people WHERE id = ? LIMIT 1', [personId]);
        const updated = updatedRows[0] || null;
        return res.json({
            success: true,
            message: 'Da cap nhat thanh vien',
            person: updated
                ? {
                      ...updated,
                      birth_date: fmtSqlDate(updated.birth_date),
                      death_date: fmtSqlDate(updated.death_date),
                  }
                : null,
        });
    } catch (error) {
        console.error('updateTreePerson error:', error);
        res.status(500).json({ success: false, message: 'Loi cap nhat nguoi trong gia pha' });
    }
};

exports.updatePersonPosition = async (req, res) => {
    try {
        await ensurePeopleTreeLayoutColumns();
        const personId = Number(req.params.id);
        const permission = await assertTreeMutationPermission(req, {
            action: 'move_person',
            affectedPersonIds: [personId],
        });
        if (!permission.ok) {
            return res.status(permission.status).json({ success: false, message: permission.message });
        }
        const gate = await assertCanManagePersonId(req, personId);
        if (!gate.ok) return res.status(gate.status).json({ success: false, message: gate.message });

        const treeX = parseTreeInt(req.body?.tree_x, 0);
        const treeY = parseTreeInt(req.body?.tree_y, 0);
        const hasOrder = Object.prototype.hasOwnProperty.call(req.body || {}, 'display_order');
        if (hasOrder) {
            await db.query('UPDATE people SET tree_x = ?, tree_y = ?, display_order = ? WHERE id = ?', [
                treeX,
                treeY,
                parseTreeInt(req.body.display_order, 0),
                personId,
            ]);
        } else {
            await db.query('UPDATE people SET tree_x = ?, tree_y = ? WHERE id = ?', [treeX, treeY, personId]);
        }

        res.json({ success: true, person_id: personId, tree_x: treeX, tree_y: treeY });
    } catch (error) {
        console.error('updatePersonPosition error:', error);
        res.status(500).json({ success: false, message: 'Loi luu vi tri trong cay' });
    }
};

exports.saveTreeLayout = async (req, res) => {
    try {
        await ensurePeopleTreeLayoutColumns();
        const people = Array.isArray(req.body?.positions)
            ? req.body.positions
            : Array.isArray(req.body?.people)
              ? req.body.people
              : [];
        const permission = await assertTreeMutationPermission(req, {
            action: 'bulk_layout',
            affectedPersonIds: people.map((item) => item.id ?? item.person_id),
        });
        if (!permission.ok) {
            return res.status(permission.status).json({ success: false, message: permission.message });
        }
        if (!people.length) return res.json({ success: true, updated: 0 });

        let updated = 0;
        for (const item of people) {
            const personId = Number(item.id ?? item.person_id);
            if (!Number.isFinite(personId)) continue;
            const gate = await assertCanManagePersonId(req, personId);
            if (!gate.ok) continue;
            await db.query('UPDATE people SET tree_x = ?, tree_y = ?, display_order = ? WHERE id = ?', [
                parseTreeInt(item.tree_x, 0),
                parseTreeInt(item.tree_y, 0),
                parseTreeInt(item.display_order, 0),
                personId,
            ]);
            updated += 1;
        }

        res.json({ success: true, updated });
    } catch (error) {
        console.error('saveTreeLayout error:', error);
        res.status(500).json({ success: false, message: 'Loi luu bo cuc cay' });
    }
};

exports.createFamily = async (req, res) => {
    try {
        const permission = await assertTreeMutationPermission(req, {
            action: 'create_family',
        });
        if (!permission.ok) {
            return res.status(permission.status).json({ success: false, message: permission.message });
        }
        const clanId = await resolveManagedClanId(req, req.body || {});
        if (clanId == null) {
            return res.status(404).json({ success: false, message: 'Khong xac dinh duoc dong ho' });
        }
        const fatherId = parseNullableId(req.body?.father_id ?? req.body?.father_person_id);
        const motherId = parseNullableId(req.body?.mother_id ?? req.body?.mother_person_id);
        if (!fatherId && !motherId) {
            return res.status(400).json({ success: false, message: 'Can co cha hoac me de tao family' });
        }

        const parentIds = [fatherId, motherId].filter(Boolean);
        const [parents] = await db.query(
            `SELECT id FROM people WHERE clan_id = ? AND id IN (${parentIds.map(() => '?').join(',')})`,
            [clanId, ...parentIds]
        );
        if (parents.length !== parentIds.length) {
            return res.status(400).json({ success: false, message: 'Cha/me phai thuoc cung dong ho' });
        }

        const [result] = await db.query(
            'INSERT INTO families (clan_id, father_id, mother_id, marriage_date) VALUES (?, ?, ?, ?)',
            [clanId, fatherId, motherId, req.body?.marriage_date || null]
        );

        res.status(201).json({ success: true, family_id: result.insertId });
    } catch (error) {
        console.error('createFamily error:', error);
        res.status(500).json({ success: false, message: 'Loi tao family' });
    }
};

exports.addFamilyChild = async (req, res) => {
    try {
        const familyId = Number(req.params.familyId);
        const childId = parseNullableId(req.body?.person_id ?? req.body?.child_id);
        if (!Number.isFinite(familyId) || !childId) {
            return res.status(400).json({ success: false, message: 'family_id hoac person_id khong hop le' });
        }
        const permission = await assertTreeMutationPermission(req, {
            action: 'add_family_child',
            affectedPersonIds: [childId],
        });
        if (!permission.ok) {
            return res.status(permission.status).json({ success: false, message: permission.message });
        }

        const [families] = await db.query('SELECT id, clan_id FROM families WHERE id = ? LIMIT 1', [familyId]);
        if (!families.length) return res.status(404).json({ success: false, message: 'Khong tim thay family' });
        const family = families[0];
        if (Number(req.user.role_id) === 2) {
            const managerClanId = await getManagerClanId(req.user.id);
            if (Number(family.clan_id) !== Number(managerClanId)) {
                return res.status(403).json({ success: false, message: 'Chi duoc sua family trong cung dong ho' });
            }
        }

        const [childRows] = await db.query('SELECT id FROM people WHERE id = ? AND clan_id = ? LIMIT 1', [
            childId,
            family.clan_id,
        ]);
        if (!childRows.length) {
            return res.status(400).json({ success: false, message: 'Con phai thuoc cung dong ho' });
        }

        await db.query('DELETE FROM children WHERE person_id = ?', [childId]);
        await db.query('INSERT INTO children (family_id, person_id, sort_order) VALUES (?, ?, ?)', [
            familyId,
            childId,
            parseTreeInt(req.body?.sort_order, 0),
        ]);
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('addFamilyChild error:', error);
        res.status(500).json({ success: false, message: 'Loi them con vao family' });
    }
};

exports.deleteTreePerson = async (req, res) => {
    try {
        const personId = Number(req.params.id);
        const permission = await assertTreeMutationPermission(req, {
            action: 'delete_person',
            affectedPersonIds: [personId],
        });
        if (!permission.ok) {
            return res.status(permission.status).json({ success: false, message: permission.message });
        }
        const gate = await assertCanManagePersonId(req, personId);
        if (!gate.ok) return res.status(gate.status).json({ success: false, message: gate.message });

        const [familyRows] = await db.query('SELECT id FROM families WHERE father_id = ? OR mother_id = ?', [
            personId,
            personId,
        ]);
        const familyIds = familyRows.map((row) => row.id);
        if (familyIds.length) {
            await db.query(`DELETE FROM children WHERE family_id IN (${familyIds.map(() => '?').join(',')})`, familyIds);
            await db.query(`DELETE FROM families WHERE id IN (${familyIds.map(() => '?').join(',')})`, familyIds);
        }
        await db.query('DELETE FROM children WHERE person_id = ?', [personId]);
        await db.query('DELETE FROM people WHERE id = ?', [personId]);

        res.json({ success: true, person_id: personId });
    } catch (error) {
        console.error('deleteTreePerson error:', error);
        res.status(500).json({ success: false, message: 'Loi xoa nguoi khoi gia pha' });
    }
};
