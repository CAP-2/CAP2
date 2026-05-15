const {
    db,
    toPositiveId,
    uniquePositiveIds,
    dateOnlyTime,
    loadPeopleByIds,
} = require('../manager/common.service');
const {
    validateBirthDeathDates,
    validateParentChildSpouseConflict,
} = require('./kinshipValidation.service');

const getDescendantIds = async(connection, personId, clanId) => {
    const rootId = toPositiveId(personId);
    if (!rootId) return new Set();
    const descendants = new Set();
    const queue = [rootId];

    while (queue.length) {
        const currentId = queue.shift();
        const [rows] = await connection.query(
            `
            SELECT c.person_id
            FROM families f
            INNER JOIN children c ON c.family_id = f.id
            WHERE f.clan_id = ?
              AND (f.father_id = ? OR f.mother_id = ?)
            `,
            [clanId, currentId, currentId]
        );

        for (const row of rows) {
            const childId = toPositiveId(row.person_id);
            if (childId && !descendants.has(childId)) {
                descendants.add(childId);
                queue.push(childId);
            }
        }
    }

    return descendants;
};

const validateFamilyParents = async({ connection = db, clanId, fatherId, motherId, excludeFamilyId = null }) => {
    const nextFatherId = toPositiveId(fatherId);
    const nextMotherId = toPositiveId(motherId);
    const parentIds = uniquePositiveIds([nextFatherId, nextMotherId]);

    if (nextFatherId && nextMotherId && nextFatherId === nextMotherId) {
        return { ok: false, message: 'Cha và mẹ không thể là cùng một người.' };
    }

    const peopleById = await loadPeopleByIds(connection, parentIds);
    for (const parentId of parentIds) {
        const parent = peopleById.get(parentId);
        if (!parent || Number(parent.clan_id) !== Number(clanId)) {
            return { ok: false, message: 'Cha/mẹ phải là người trong cùng dòng họ hoặc ID không tồn tại.' };
        }
    }

    if (nextFatherId && Number(peopleById.get(nextFatherId)?.gender) === 2) {
        return { ok: false, message: 'Không thể chọn người có giới tính nữ làm cha.' };
    }

    if (nextMotherId && Number(peopleById.get(nextMotherId)?.gender) === 1) {
        return { ok: false, message: 'Không thể chọn người có giới tính nam làm mẹ.' };
    }

    if (nextFatherId || nextMotherId) {
        const [duplicates] = await connection.query(
            `
            SELECT id
            FROM families
            WHERE clan_id = ?
              AND (father_id <=> ?)
              AND (mother_id <=> ?)
              AND (? IS NULL OR id <> ?)
            LIMIT 1
            `,
            [clanId, nextFatherId, nextMotherId, excludeFamilyId, excludeFamilyId]
        );
        if (duplicates.length) {
            return {
                ok: false,
                level: 'error',
                code: 'DUPLICATE_SPOUSE_FAMILY',
                message: 'Không được tạo duplicate spouse/family theo chiều ngược hoặc trùng cặp.',
            };
        }
    }

    return { ok: true, parentsById: peopleById };
};

const getParentGeneration = (parents) => {
    const generations = parents
        .map((parent) => Number(parent?.generation))
        .filter((generation) => Number.isFinite(generation) && generation > 0);
    const unique = [...new Set(generations)];
    if (!unique.length) return { ok: true, generation: null };
    if (unique.length > 1) {
        return { ok: false, message: 'Cha và mẹ phải cùng đời để gán đời cho con.' };
    }
    return { ok: true, generation: unique[0] };
};

const validateChildAgainstParents = async({ connection = db, clanId, childId, fatherId, motherId, forceSaveHistoricalRelation = false }) => {
    const nextChildId = toPositiveId(childId);
    const parentIds = uniquePositiveIds([fatherId, motherId]);
    if (!nextChildId || !parentIds.length) {
        return { ok: false, message: 'Cần có con và ít nhất một cha/mẹ để tạo quan hệ.' };
    }
    if (parentIds.includes(nextChildId)) {
        return { ok: false, message: 'Thành viên không thể là cha/mẹ của chính mình.' };
    }

    const peopleById = await loadPeopleByIds(connection, [nextChildId, ...parentIds]);
    const child = peopleById.get(nextChildId);
    if (!child || Number(child.clan_id) !== Number(clanId)) {
        return { ok: false, message: 'Con phải là người trong cùng dòng họ.' };
    }

    const parents = parentIds.map((parentId) => peopleById.get(parentId));
    if (parents.some((parent) => !parent || Number(parent.clan_id) !== Number(clanId))) {
        return { ok: false, message: 'Cha/mẹ phải là người trong cùng dòng họ hoặc ID không tồn tại.' };
    }

    const familyValidation = await validateFamilyParents({ connection, clanId, fatherId, motherId });
    if (!familyValidation.ok && familyValidation.code !== 'DUPLICATE_SPOUSE_FAMILY') {
        return familyValidation;
    }

    const spouseConflict = await validateParentChildSpouseConflict({
        connection,
        clanId,
        childId: nextChildId,
        parentIds,
        forceSaveHistoricalRelation,
    });
    if (!spouseConflict.ok) return spouseConflict;

    const descendants = await getDescendantIds(connection, nextChildId, clanId);
    if (parentIds.some((parentId) => descendants.has(parentId))) {
        return { ok: false, message: 'Không thể tạo vòng lặp tổ tiên - con cháu trong cây gia phả.' };
    }

    const childBirthTime = dateOnlyTime(child.birth_date);
    for (const parent of parents) {
        const parentBirthTime = dateOnlyTime(parent?.birth_date);
        if (parentBirthTime !== null && childBirthTime !== null && childBirthTime < parentBirthTime) {
            return { ok: false, message: 'Con không thể có ngày sinh trước cha hoặc mẹ.' };
        }
    }

    const parentGeneration = getParentGeneration(parents);
    if (!parentGeneration.ok) return parentGeneration;
    const childGeneration = parentGeneration.generation ? parentGeneration.generation + 1 : null;

    if (childGeneration) {
        const [existingChildren] = await connection.query(
            `
            SELECT p.generation
            FROM families f
            INNER JOIN children c ON c.family_id = f.id
            INNER JOIN people p ON p.id = c.person_id
            WHERE f.father_id = ? OR f.mother_id = ?
            `,
            [nextChildId, nextChildId]
        );
        if (existingChildren.some((row) => Number(row.generation) > 0 && Number(row.generation) <= childGeneration)) {
            return { ok: false, message: 'Con bắt buộc phải có đời sau cha/mẹ.' };
        }
    }

    return {
        ok: true,
        childGeneration,
    };
};

const validatePersonGenerationWithRelations = async(connection, personId, nextGeneration) => {
    const generation = Number(nextGeneration);
    if (!Number.isFinite(generation) || generation <= 0) {
        return { ok: true };
    }

    const [parentRows] = await connection.query(
        `
        SELECT p.generation
        FROM children c
        INNER JOIN families f ON f.id = c.family_id
        INNER JOIN people p ON p.id IN (f.father_id, f.mother_id)
        WHERE c.person_id = ?
        `,
        [personId]
    );
    if (parentRows.some((row) => Number(row.generation) > 0 && generation <= Number(row.generation))) {
        return { ok: false, message: 'Con bắt buộc phải có đời sau cha/mẹ.' };
    }

    const [childRows] = await connection.query(
        `
        SELECT cperson.generation
        FROM families f
        INNER JOIN children c ON c.family_id = f.id
        INNER JOIN people cperson ON cperson.id = c.person_id
        WHERE f.father_id = ? OR f.mother_id = ?
        `,
        [personId, personId]
    );
    if (childRows.some((row) => Number(row.generation) > 0 && Number(row.generation) <= generation)) {
        return { ok: false, message: 'Con bắt buộc phải có đời sau cha/mẹ.' };
    }

    return { ok: true };
};

const validatePersonGenderWithFamilyRole = async(connection, personId, nextGender) => {
    const gender = Number(nextGender);
    if (gender !== 1 && gender !== 2) return { ok: true };

    if (gender === 2) {
        const [fatherRows] = await connection.query('SELECT id FROM families WHERE father_id = ? LIMIT 1', [personId]);
        if (fatherRows.length) {
            return { ok: false, message: 'Không thể đặt giới tính nữ cho người đang là cha.' };
        }
    }

    if (gender === 1) {
        const [motherRows] = await connection.query('SELECT id FROM families WHERE mother_id = ? LIMIT 1', [personId]);
        if (motherRows.length) {
            return { ok: false, message: 'Không thể đặt giới tính nam cho người đang là mẹ.' };
        }
    }

    return { ok: true };
};

const validatePersonBirthDateWithRelations = async(connection, personId, nextBirthDate) => {
    const birthTime = dateOnlyTime(nextBirthDate);
    if (birthTime === null) return { ok: true };

    const [parentRows] = await connection.query(
        `
        SELECT p.birth_date
        FROM children c
        INNER JOIN families f ON f.id = c.family_id
        INNER JOIN people p ON p.id IN (f.father_id, f.mother_id)
        WHERE c.person_id = ?
        `,
        [personId]
    );
    if (parentRows.some((row) => {
        const parentBirthTime = dateOnlyTime(row.birth_date);
        return parentBirthTime !== null && birthTime < parentBirthTime;
    })) {
        return { ok: false, message: 'Con không thể có ngày sinh trước cha hoặc mẹ.' };
    }

    const [childRows] = await connection.query(
        `
        SELECT cperson.birth_date
        FROM families f
        INNER JOIN children c ON c.family_id = f.id
        INNER JOIN people cperson ON cperson.id = c.person_id
        WHERE f.father_id = ? OR f.mother_id = ?
        `,
        [personId, personId]
    );
    if (childRows.some((row) => {
        const childBirthTime = dateOnlyTime(row.birth_date);
        return childBirthTime !== null && childBirthTime < birthTime;
    })) {
        return { ok: false, message: 'Con không thể có ngày sinh trước cha hoặc mẹ.' };
    }

    return { ok: true };
};


const validatePersonLifeDates = (birthDate, deathDate) => validateBirthDeathDates(birthDate, deathDate);

const assertCanDeleteTreePerson = async(personId) => {
    const [accountRows] = await db.query('SELECT id FROM accounts WHERE person_id = ? LIMIT 1', [personId]);
    if (accountRows.length) {
        return { ok: false, message: 'Không thể xóa người đang liên kết với tài khoản.' };
    }

    const [parentFamilyRows] = await db.query(
        'SELECT id FROM families WHERE father_id = ? OR mother_id = ? LIMIT 1',
        [personId, personId]
    );
    if (parentFamilyRows.length) {
        return { ok: false, message: 'Không thể xóa người còn liên kết vợ/chồng hoặc con.' };
    }

    const [childRows] = await db.query('SELECT family_id FROM children WHERE person_id = ? LIMIT 1', [personId]);
    if (childRows.length) {
        return { ok: false, message: 'Không thể xóa người còn liên kết cha/mẹ.' };
    }

    return { ok: true };
};

module.exports = {
    getDescendantIds,
    validateFamilyParents,
    getParentGeneration,
    validateChildAgainstParents,
    validatePersonGenerationWithRelations,
    validatePersonGenderWithFamilyRole,
    validatePersonBirthDateWithRelations,
    validatePersonLifeDates,
    assertCanDeleteTreePerson,
};
