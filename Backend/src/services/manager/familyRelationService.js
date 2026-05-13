const {
    db,
    parseNullableId,
    parseChildrenIds,
    hasDuplicateIds,
} = require('./commonService');
const {
    validateChildAgainstParents,
    validateFamilyParents,
} = require('./familyValidationService');
const {
    normalizeForceFlag,
    validateSpouseKinshipConflict,
} = require('./kinshipValidationService');

let hasEnsuredPeopleTreeLayoutColumns = false;

const ensurePeopleTreeLayoutColumns = async() => {
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

const ensurePeopleExist = async(ids) => {
    if (!ids || ids.length === 0) return true;
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(`SELECT id FROM people WHERE id IN (${placeholders})`, ids);
    return rows.length === ids.length;
};

const getOwnedFamilyRelations = async(personId) => {
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
    `, [personId, personId]
    );

    const family = familyRows[0] || null;
    if (!family) {
        return { family_id: null, spouse_id: null, children_ids: [] };
    }

    const spouseId = family.father_id === personId ? family.mother_id : family.father_id;
    const [childrenRows] = await db.query(
        'SELECT person_id FROM children WHERE family_id = ? ORDER BY id ASC', [family.id]
    );

    return {
        family_id: family.id,
        spouse_id: spouseId || null,
        children_ids: childrenRows.map((r) => r.person_id),
    };
};

const getChildBloodline = async(personId) => {
    if (!personId) return null;
    const [rows] = await db.query(
        `
      SELECT c.family_id, f.father_id AS parent_father_id, f.mother_id AS parent_mother_id
      FROM children c
      INNER JOIN families f ON c.family_id = f.id
      WHERE c.person_id = ?
      ORDER BY c.id ASC
      LIMIT 1
    `, [personId]
    );
    return rows[0] || null;
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

async function applyBloodlineForPerson(targetPersonId, clanId, parentFatherId, parentMotherId, connection = db, options = {}) {
    const forceSaveHistoricalRelation = normalizeForceFlag(options.forceSaveHistoricalRelation);
    if (!parentFatherId && !parentMotherId) {
        return {
            ok: false,
            message: 'Chỉ định huyết thống cần ít nhất ID cha hoặc mẹ (people.id)',
        };
    }

    if (targetPersonId === parentFatherId || targetPersonId === parentMotherId) {
        return {
            ok: false,
            message: 'Thành viên không thể là cha/mẹ của chính mình',
        };
    }

    const childValidation = await validateChildAgainstParents({
        connection,
        clanId,
        childId: targetPersonId,
        fatherId: parentFatherId,
        motherId: parentMotherId,
        forceSaveHistoricalRelation,
    });
    if (!childValidation.ok) return childValidation;

    const [existingBloodlineRows] = await connection.query(
        `
        SELECT c.family_id
        FROM children c
        INNER JOIN families f ON f.id = c.family_id
        WHERE c.person_id = ?
          AND f.clan_id = ?
          AND (f.father_id <=> ?)
          AND (f.mother_id <=> ?)
        LIMIT 1
        `,
        [targetPersonId, clanId, parentFatherId || null, parentMotherId || null]
    );
    if (existingBloodlineRows.length) {
        return {
            ok: false,
            level: 'error',
            code: 'DUPLICATE_PARENT_CHILD',
            message: 'Không được tạo duplicate parent-child.',
        };
    }

    await connection.query(
        'DELETE FROM children WHERE person_id = ?', [targetPersonId]
    );

    const [existing] = await connection.query(
        `
        SELECT id
        FROM families
        WHERE clan_id = ?
          AND (father_id <=> ?)
          AND (mother_id <=> ?)
        LIMIT 1
        `, [clanId, parentFatherId, parentMotherId]
    );

    let familyId;

    if (existing.length > 0) {
        familyId = existing[0].id;
    } else {
        const [insertResult] = await connection.query(
            `
            INSERT INTO families (clan_id, father_id, mother_id)
            VALUES (?, ?, ?)
            `, [clanId, parentFatherId, parentMotherId]
        );

        familyId = insertResult.insertId;
    }

    await connection.query(
        `
        INSERT INTO children (family_id, person_id, sort_order)
        VALUES (?, ?, 0)
        `, [familyId, targetPersonId]
    );

    if (childValidation.childGeneration) {
        await connection.query('UPDATE people SET generation = ? WHERE id = ?', [
            childValidation.childGeneration,
            targetPersonId,
        ]);
    }

    return { ok: true };
}

async function applyMarriageRelationsForPerson(context, body) {
    const forceSaveHistoricalRelation = normalizeForceFlag(body?.forceSaveHistoricalRelation || context?.forceSaveHistoricalRelation);
    const { family_id, spouse_id, children_ids } = body;
    const hasFamilyField = Object.prototype.hasOwnProperty.call(body, 'family_id');
    const hasSpouseField = Object.prototype.hasOwnProperty.call(body, 'spouse_id');
    const hasChildrenField = Object.prototype.hasOwnProperty.call(body, 'children_ids');

    const familyIdInput = parseNullableId(family_id);
    const spouseId = parseNullableId(spouse_id);
    const childrenIds = parseChildrenIds(children_ids);

    if (hasChildrenField && hasDuplicateIds(children_ids)) {
        return { ok: false, level: 'error', code: 'DUPLICATE_CHILD_IN_FAMILY', message: 'Không được thêm trùng con trong cùng một gia đình.' };
    }

    const relationIdsToValidate = [spouseId, ...childrenIds].filter((v) => v !== null);
    const allRelationsOk = await ensurePeopleExist(relationIdsToValidate);
    if (!allRelationsOk) {
        return { ok: false, message: 'Một hoặc nhiều ID quan hệ không tồn tại trong bảng people' };
    }

    if (spouseId !== null && spouseId === context.person_id) {
        return { ok: false, message: 'Vợ/chồng không thể trùng với chính thành viên' };
    }

    let spouseRow = null;
    if (spouseId) {
        const [sp] = await db.query('SELECT id, clan_id, gender FROM people WHERE id = ?', [spouseId]);
        if (!sp.length || sp[0].clan_id !== context.clan_id) {
            return { ok: false, message: 'Vợ/chồng phải cùng dòng họ với thành viên' };
        }
        spouseRow = sp[0];
    }
    for (const cid of childrenIds) {
        const [ch] = await db.query('SELECT clan_id FROM people WHERE id = ?', [cid]);
        if (!ch.length || ch[0].clan_id !== context.clan_id) {
            return { ok: false, message: 'Danh sách con phải là người cùng dòng họ' };
        }
    }

    const personId = context.person_id;
    const [selfFamilyRows] = await db.query(
        'SELECT id, father_id, mother_id FROM families WHERE father_id = ? OR mother_id = ? ORDER BY id ASC LIMIT 1', [personId, personId]
    );
    let selfFamilyId = selfFamilyRows[0]?.id || null;
    const currentFamily = selfFamilyRows[0] || null;
    const currentSpouseId = currentFamily
        ? Number(currentFamily.father_id) === Number(personId)
            ? parseNullableId(currentFamily.mother_id)
            : parseNullableId(currentFamily.father_id)
        : null;
    const effectiveSpouseId = hasSpouseField ? spouseId : currentSpouseId;

    if (effectiveSpouseId && (!spouseRow || Number(spouseRow.id) !== Number(effectiveSpouseId))) {
        const [sp] = await db.query('SELECT id, clan_id, gender FROM people WHERE id = ?', [effectiveSpouseId]);
        if (!sp.length || Number(sp[0].clan_id) !== Number(context.clan_id)) {
            return { ok: false, message: 'Vợ/chồng phải cùng dòng họ với thành viên.' };
        }
        spouseRow = sp[0];
    }

    const contextGender = Number(context.gender);
    const spouseGender = Number(spouseRow?.gender);
    let familyFatherId = null;
    let familyMotherId = null;
    if (contextGender === 1) {
        familyFatherId = personId;
        familyMotherId = effectiveSpouseId;
    } else if (contextGender === 2) {
        familyFatherId = effectiveSpouseId;
        familyMotherId = personId;
    } else if (spouseGender === 1) {
        familyFatherId = effectiveSpouseId;
        familyMotherId = personId;
    } else if (spouseGender === 2) {
        familyFatherId = personId;
        familyMotherId = effectiveSpouseId;
    } else {
        familyFatherId = personId;
        familyMotherId = effectiveSpouseId;
    }

    if (hasSpouseField && effectiveSpouseId) {
        const spouseConflict = await validateSpouseKinshipConflict({
            connection: db,
            clanId: context.clan_id,
            personId,
            spouseId: effectiveSpouseId,
            forceSaveHistoricalRelation,
        });
        if (!spouseConflict.ok) return spouseConflict;
    }

    if (hasFamilyField && familyIdInput !== null) {
        const [existingFamily] = await db.query(
            'SELECT id, father_id, mother_id, clan_id FROM families WHERE id = ? LIMIT 1', [familyIdInput]
        );
        if (existingFamily.length === 0) {
            if (!context.clan_id) {
                return { ok: false, message: 'Tài khoản chưa liên kết dòng họ nên không thể tạo families mới' };
            }
            const familyValidation = await validateFamilyParents({
                clanId: context.clan_id,
                fatherId: familyFatherId,
                motherId: familyMotherId,
                excludeFamilyId: familyIdInput,
            });
            if (!familyValidation.ok) return familyValidation;
            await db.query(
                'INSERT INTO families (id, clan_id, father_id, mother_id) VALUES (?, ?, ?, ?)', [familyIdInput, context.clan_id, familyFatherId, familyMotherId]
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

    if (hasChildrenField) {
        for (const childId of childrenIds) {
            const childValidation = await validateChildAgainstParents({
                clanId: context.clan_id,
                childId,
                fatherId: familyFatherId,
                motherId: familyMotherId,
                forceSaveHistoricalRelation,
            });
            if (!childValidation.ok) return childValidation;
        }
    }

    const needsNewOrUpdateFamilyRow = hasSpouseField || (hasChildrenField && childrenIds.length > 0);
    if (needsNewOrUpdateFamilyRow) {
        const familyValidation = await validateFamilyParents({
            clanId: context.clan_id,
            fatherId: familyFatherId,
            motherId: familyMotherId,
            excludeFamilyId: selfFamilyId,
        });
        if (!familyValidation.ok) return familyValidation;

        if (!selfFamilyId) {
            if (!context.clan_id) {
                return { ok: false, message: 'Tài khoản chưa liên kết dòng họ nên chưa thể khai báo quan hệ vợ/chồng/con' };
            }
            const [createdFamily] = await db.query(
                'INSERT INTO families (clan_id, father_id, mother_id) VALUES (?, ?, ?)', [context.clan_id, familyFatherId, familyMotherId]
            );
            selfFamilyId = createdFamily.insertId;
        } else {
            await db.query('UPDATE families SET father_id = ?, mother_id = ? WHERE id = ?', [
                familyFatherId,
                familyMotherId,
                selfFamilyId,
            ]);
        }
    }

    if (selfFamilyId && hasChildrenField) {
        for (const childId of childrenIds) {
            const childValidation = await validateChildAgainstParents({
                clanId: context.clan_id,
                childId,
                fatherId: familyFatherId,
                motherId: familyMotherId,
                forceSaveHistoricalRelation,
            });
            if (!childValidation.ok) return childValidation;
        }

        await db.query('DELETE FROM children WHERE family_id = ?', [selfFamilyId]);
        for (const childId of childrenIds) {
            const childValidation = await validateChildAgainstParents({
                clanId: context.clan_id,
                childId,
                fatherId: familyFatherId,
                motherId: familyMotherId,
                forceSaveHistoricalRelation,
            });
            if (childValidation.childGeneration) {
                await db.query('UPDATE people SET generation = ? WHERE id = ?', [
                    childValidation.childGeneration,
                    childId,
                ]);
            }
            await db.query('INSERT INTO children (family_id, person_id, sort_order) VALUES (?, ?, 0)', [
                selfFamilyId,
                childId,
            ]);
        }
    }

    return { ok: true };
}

module.exports = {
    hasEnsuredPeopleTreeLayoutColumns,
    ensurePeopleTreeLayoutColumns,
    ensurePeopleExist,
    getOwnedFamilyRelations,
    getChildBloodline,
    buildManagedFamilyTree,
    applyBloodlineForPerson,
    applyMarriageRelationsForPerson,
};
