const {
    ensureArchivedMembersTable,
} = require('../../services/manager/archiveService');
const {
    bcrypt,
    buildDisplayNameFromPartsMgr,
    buildTreeEditMemberName,
    createTemporaryTreeEditKeyRecord,
    db,
    deletePersonCompletely,
    ensureCanAddAccount,
    ensureMemberTreeEditKeysTable,
    fetchPeopleLabelsMap,
    fmtSqlDate,
    normalizeTreeEditKeyMemberIds,
    parseNullableId,
} = require('../../services/manager/commonService');
const {
    applyBloodlineForPerson,
    applyMarriageRelationsForPerson,
    getChildBloodline,
    getOwnedFamilyRelations,
} = require('../../services/manager/familyRelationService');
const {
    validatePersonBirthDateWithRelations,
    validatePersonGenderWithFamilyRole,
    validatePersonGenerationWithRelations,
} = require('../../services/manager/familyValidationService');
const {
    assertCanManageAccount,
    getManagedMemberFullContext,
    getManagerClanId,
    loadTreeEditKeyTargets,
    resolveManagedClanId,
} = require('../../services/manager/managerClanService');

const getMemberRelations = async(req, res) => {
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

        const bloodlineOut = bloodline ? {
                family_id: bloodline.family_id,
                parent_father_id: bloodline.parent_father_id,
                parent_mother_id: bloodline.parent_mother_id,
                parent_father_name: bloodline.parent_father_id ?
                    labelMap.get(bloodline.parent_father_id) || null : null,
                parent_mother_name: bloodline.parent_mother_id ?
                    labelMap.get(bloodline.parent_mother_id) || null : null,
            } :
            null;

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

const updateMemberRelations = async(req, res) => {
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
            bloodline: bloodline ? {
                family_id: bloodline.family_id,
                parent_father_id: bloodline.parent_father_id,
                parent_mother_id: bloodline.parent_mother_id,
            } : null,
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

const getAllMembers = async(req, res) => {
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

const createTemporaryTreeEditKey = async(req, res) => {
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

const getActiveTreeEditKeys = async(req, res) => {
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
            `, [clanId]
        );

        return res.json({
            success: true,
            keys: rows.map((row) => ({
                id: row.id,
                member_account_id: row.member_account_id,
                member_person_id: row.member_person_id,
                member_name: buildTreeEditMemberName({...row, account_id: row.member_account_id }),
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

const getArchivedMembers = async(req, res) => {
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

const archiveMember = async(req, res) => {
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
                archived_at = CURRENT_TIMESTAMP`, [
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

const deleteArchivedMemberPermanently = async(req, res) => {
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
            await deletePersonCompletely(personId, { deleteAccounts: false });
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

const restoreArchivedMember = async(req, res) => {
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

const createMember = async(req, res) => {
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

        const accountLimitCheck = await ensureCanAddAccount(clanId);

        if (!accountLimitCheck.ok) {
            return res.status(accountLimitCheck.status).json({
                success: false,
                code: accountLimitCheck.code,
                message: accountLimitCheck.message,
                billing: accountLimitCheck.billing,
            });
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
            `INSERT INTO people (clan_id, display_name, first_name, middle_name, surname, gender, birth_date, hometown, generation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [clanId, displayName, fn, mid, sn, gVal, bd, ht, gen]
        );
        const personId = personResult.insertId;

        const [accResult] = await db.query(
            `INSERT INTO accounts (email, password, person_id, role_id, status) VALUES (?, ?, ?, 3, 'active')`, [emailTrim, hashedPassword, personId]
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

const getMemberDetail = async(req, res) => {
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

const updateMemberByManager = async(req, res) => {
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
                if (st === 'active' && String(full.status) !== 'active') {
                    const accountLimitCheck = await ensureCanAddAccount(full.clan_id);

                    if (!accountLimitCheck.ok) {
                        return res.status(accountLimitCheck.status).json({
                            success: false,
                            code: accountLimitCheck.code,
                            message: accountLimitCheck.message,
                            billing: accountLimitCheck.billing,
                        });
                    }
                }

                await db.query('UPDATE accounts SET status = ? WHERE id = ?', [st, targetAccountId]);
            }
        }

        if ((Number(req.user.role_id) === 1 || Number(req.user.role_id) === 2) && has('role_id')) {
            const rid = Number(body.role_id);
            if (rid !== 2 && rid !== 3) {
                return res.status(400).json({ success: false, message: 'Vai trò chỉ hỗ trợ Manager hoặc Member' });
            }
            if (Number(req.user.role_id) === 2) {
                if (targetAccountId === Number(req.user.id) && rid !== Number(full.role_id)) {
                    return res.status(400).json({ success: false, message: 'Manager không thể tự đổi vai trò của chính mình' });
                }
                if (rid === 3 && Number(full.role_id) !== 3) {
                    return res.status(403).json({ success: false, message: 'Manager chỉ được chỉ định thành viên lên Manager, không được hạ vai trò Manager khác' });
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

        const genderValidation = await validatePersonGenderWithFamilyRole(db, full.person_id, nextGender);
        if (!genderValidation.ok) {
            return res.status(400).json({ success: false, message: genderValidation.message });
        }

        const generationValidation = await validatePersonGenerationWithRelations(db, full.person_id, nextGen);
        if (!generationValidation.ok) {
            return res.status(400).json({ success: false, message: generationValidation.message });
        }

        const birthValidation = await validatePersonBirthDateWithRelations(db, full.person_id, nextBirth);
        if (!birthValidation.ok) {
            return res.status(400).json({ success: false, message: birthValidation.message });
        }

        await db.query(
            `UPDATE people SET 
        clan_id = ?, display_name = ?, first_name = ?, middle_name = ?, surname = ?,
        gender = ?, birth_date = ?, death_date = ?, is_living = ?, generation = ?, branch = ?,
        hometown = ?, address = ?, phone = ?, email = ?, zalo = ?, facebook = ?,
        avatar_url = ?, bio = ?, note = ?
      WHERE id = ?`, [
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

module.exports = {
    getMemberRelations,
    updateMemberRelations,
    getAllMembers,
    createTemporaryTreeEditKey,
    getActiveTreeEditKeys,
    getArchivedMembers,
    archiveMember,
    deleteArchivedMemberPermanently,
    restoreArchivedMember,
    createMember,
    getMemberDetail,
    updateMemberByManager,
};
