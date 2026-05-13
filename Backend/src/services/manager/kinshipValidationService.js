const {
  db,
  dateOnlyTime,
  toPositiveId,
  uniquePositiveIds,
} = require('./commonService');

const ERROR_LEVEL = 'error';
const WARNING_LEVEL = 'warning';

const errorResult = (message, code = 'RELATION_VALIDATION_ERROR') => ({
  ok: false,
  level: ERROR_LEVEL,
  code,
  message,
});

const warningResult = (message, code = 'HISTORICAL_RELATION_WARNING') => ({
  ok: false,
  level: WARNING_LEVEL,
  code,
  requiresConfirmation: true,
  message,
});

const okResult = () => ({ ok: true, level: 'ok' });

const normalizeForceFlag = (value) =>
  value === true || value === 1 || value === '1' || String(value || '').toLowerCase() === 'true';

const validateBirthDeathDates = (birthDate, deathDate) => {
  const birthTime = dateOnlyTime(birthDate);
  const deathTime = dateOnlyTime(deathDate);
  if (birthTime !== null && deathTime !== null && deathTime < birthTime) {
    return errorResult('Ngày mất không được trước ngày sinh.', 'INVALID_LIFE_DATES');
  }
  return okResult();
};

const loadPeopleStatus = async (connection = db, ids = []) => {
  const cleanIds = uniquePositiveIds(ids);
  if (!cleanIds.length) return new Map();
  const [rows] = await connection.query(
    `
    SELECT
      p.id,
      p.clan_id,
      p.gender,
      p.birth_date,
      p.death_date,
      p.is_living,
      p.display_name,
      p.surname,
      p.middle_name,
      p.first_name,
      EXISTS(SELECT 1 FROM accounts a WHERE a.person_id = p.id) AS has_account
    FROM people p
    WHERE p.id IN (${cleanIds.map(() => '?').join(',')})
    `,
    cleanIds
  );
  return new Map(rows.map((row) => [Number(row.id), row]));
};

const isLivingOrHasAccount = (person) =>
  Boolean(person) && (Number(person.is_living) === 1 || Number(person.has_account) === 1);

const labelPerson = (person) => {
  if (!person) return 'Thành viên';
  const display = String(person.display_name || '').trim();
  if (display) return display;
  const parts = [person.surname, person.middle_name, person.first_name]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return parts.join(' ') || `Thành viên #${person.id}`;
};

const resolveConflictByHistoricalPolicy = async ({
  connection = db,
  clanId,
  personIds,
  message,
  forceSaveHistoricalRelation = false,
}) => {
  const peopleById = await loadPeopleStatus(connection, personIds);
  const people = uniquePositiveIds(personIds).map((id) => peopleById.get(id)).filter(Boolean);
  if (!people.length) return errorResult('Không tìm thấy người cần kiểm tra quan hệ.', 'PERSON_NOT_FOUND');

  const allStrict = people.every(isLivingOrHasAccount);
  if (allStrict) {
    return errorResult(message, 'STRICT_KINSHIP_CONFLICT');
  }

  if (!normalizeForceFlag(forceSaveHistoricalRelation)) {
    const names = people.map(labelPerson).join(' và ');
    return warningResult(
      `${message} Đây có thể là dữ liệu lịch sử liên quan đến ${names}. Bạn có chắc muốn tiếp tục lưu không?`
    );
  }

  // Với người đã mất hoặc dữ liệu lịch sử, manager được phép xác nhận tiếp tục lưu.
  void clanId;
  return okResult();
};

const getDescendantIds = async (connection = db, personId, clanId) => {
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

const areDirectParentChild = async (connection = db, clanId, aId, bId) => {
  const [rows] = await connection.query(
    `
    SELECT f.id
    FROM families f
    INNER JOIN children c ON c.family_id = f.id
    WHERE f.clan_id = ?
      AND (
        ((f.father_id = ? OR f.mother_id = ?) AND c.person_id = ?)
        OR
        ((f.father_id = ? OR f.mother_id = ?) AND c.person_id = ?)
      )
    LIMIT 1
    `,
    [clanId, aId, aId, bId, bId, bId, aId]
  );
  return rows.length > 0;
};

const areSpouses = async (connection = db, clanId, aId, bId) => {
  const [rows] = await connection.query(
    `
    SELECT id
    FROM families
    WHERE clan_id = ?
      AND (
        (father_id = ? AND mother_id = ?)
        OR (father_id = ? AND mother_id = ?)
      )
    LIMIT 1
    `,
    [clanId, aId, bId, bId, aId]
  );
  return rows.length > 0;
};

const getParentFamily = async (connection = db, clanId, personId) => {
  const [rows] = await connection.query(
    `
    SELECT f.id, f.father_id, f.mother_id
    FROM children c
    INNER JOIN families f ON f.id = c.family_id
    WHERE f.clan_id = ? AND c.person_id = ?
    ORDER BY f.id ASC
    LIMIT 1
    `,
    [clanId, personId]
  );
  return rows[0] || null;
};

const shareParent = async (connection = db, clanId, aId, bId) => {
  const famA = await getParentFamily(connection, clanId, aId);
  const famB = await getParentFamily(connection, clanId, bId);
  if (!famA || !famB) return { shared: false, sameFather: false, sameMother: false };
  const sameFather = Boolean(famA.father_id && famB.father_id && Number(famA.father_id) === Number(famB.father_id));
  const sameMother = Boolean(famA.mother_id && famB.mother_id && Number(famA.mother_id) === Number(famB.mother_id));
  return { shared: sameFather || sameMother, sameFather, sameMother };
};

const isAncestorDescendant = async (connection = db, clanId, aId, bId) => {
  const descendantsOfA = await getDescendantIds(connection, aId, clanId);
  if (descendantsOfA.has(Number(bId))) return true;
  const descendantsOfB = await getDescendantIds(connection, bId, clanId);
  return descendantsOfB.has(Number(aId));
};

const isSpouseOfParent = async (connection = db, clanId, personId, candidateId) => {
  const parentFamily = await getParentFamily(connection, clanId, personId);
  const parentIds = uniquePositiveIds([parentFamily?.father_id, parentFamily?.mother_id]);
  if (!parentIds.length) return false;
  const [rows] = await connection.query(
    `
    SELECT id
    FROM families
    WHERE clan_id = ?
      AND (
        (father_id IN (${parentIds.map(() => '?').join(',')}) AND mother_id = ?)
        OR
        (mother_id IN (${parentIds.map(() => '?').join(',')}) AND father_id = ?)
      )
    LIMIT 1
    `,
    [clanId, ...parentIds, candidateId, ...parentIds, candidateId]
  );
  return rows.length > 0;
};

const getSpouseIds = async (connection = db, clanId, personId) => {
  const [rows] = await connection.query(
    `
    SELECT father_id, mother_id
    FROM families
    WHERE clan_id = ? AND (father_id = ? OR mother_id = ?)
    `,
    [clanId, personId, personId]
  );
  return uniquePositiveIds(
    rows.map((row) => Number(row.father_id) === Number(personId) ? row.mother_id : row.father_id)
  );
};

const isChildOfAny = async (connection = db, clanId, childId, parentIds = []) => {
  const cleanParentIds = uniquePositiveIds(parentIds);
  if (!cleanParentIds.length) return false;
  const [rows] = await connection.query(
    `
    SELECT c.person_id
    FROM families f
    INNER JOIN children c ON c.family_id = f.id
    WHERE f.clan_id = ?
      AND c.person_id = ?
      AND (f.father_id IN (${cleanParentIds.map(() => '?').join(',')}) OR f.mother_id IN (${cleanParentIds.map(() => '?').join(',')}))
    LIMIT 1
    `,
    [clanId, childId, ...cleanParentIds, ...cleanParentIds]
  );
  return rows.length > 0;
};

const buildPolicyResult = async (params) => resolveConflictByHistoricalPolicy(params);

const validateSpouseKinshipConflict = async ({
  connection = db,
  clanId,
  personId,
  spouseId,
  forceSaveHistoricalRelation = false,
}) => {
  const aId = toPositiveId(personId);
  const bId = toPositiveId(spouseId);
  if (!aId || !bId) return okResult();

  if (aId === bId) {
    return errorResult('Vợ/chồng không thể trùng với chính thành viên.', 'SAME_PERSON_AS_SPOUSE');
  }

  if (await areDirectParentChild(connection, clanId, aId, bId)) {
    return buildPolicyResult({
      connection,
      clanId,
      personIds: [aId, bId],
      forceSaveHistoricalRelation,
      message: 'Không được tạo quan hệ vợ/chồng nếu hai người đang là cha/mẹ - con.',
    });
  }

  if (await isAncestorDescendant(connection, clanId, aId, bId)) {
    return buildPolicyResult({
      connection,
      clanId,
      personIds: [aId, bId],
      forceSaveHistoricalRelation,
      message: 'Không được kết hôn với tổ tiên hoặc hậu duệ trong cây gia phả.',
    });
  }

  const sibling = await shareParent(connection, clanId, aId, bId);
  if (sibling.shared) {
    const detail = sibling.sameFather && sibling.sameMother
      ? 'anh/chị/em ruột'
      : sibling.sameFather
        ? 'người cùng cha'
        : 'người cùng mẹ';
    return buildPolicyResult({
      connection,
      clanId,
      personIds: [aId, bId],
      forceSaveHistoricalRelation,
      message: `Không được kết hôn với ${detail}.`,
    });
  }

  if (await isSpouseOfParent(connection, clanId, aId, bId) || await isSpouseOfParent(connection, clanId, bId, aId)) {
    return buildPolicyResult({
      connection,
      clanId,
      personIds: [aId, bId],
      forceSaveHistoricalRelation,
      message: 'Không được kết hôn với vợ/chồng của cha/mẹ.',
    });
  }

  const spousesOfA = await getSpouseIds(connection, clanId, aId);
  const spousesOfB = await getSpouseIds(connection, clanId, bId);
  if (await isChildOfAny(connection, clanId, bId, spousesOfA) || await isChildOfAny(connection, clanId, aId, spousesOfB)) {
    return buildPolicyResult({
      connection,
      clanId,
      personIds: [aId, bId],
      forceSaveHistoricalRelation,
      message: 'Không được kết hôn với con riêng của vợ/chồng.',
    });
  }

  return okResult();
};

const validateParentChildSpouseConflict = async ({
  connection = db,
  clanId,
  childId,
  parentIds = [],
  forceSaveHistoricalRelation = false,
}) => {
  const cleanChildId = toPositiveId(childId);
  const cleanParentIds = uniquePositiveIds(parentIds);
  if (!cleanChildId || !cleanParentIds.length) return okResult();

  for (const parentId of cleanParentIds) {
    if (await areSpouses(connection, clanId, cleanChildId, parentId)) {
      return buildPolicyResult({
        connection,
        clanId,
        personIds: [cleanChildId, parentId],
        forceSaveHistoricalRelation,
        message: 'Không được tạo quan hệ cha/mẹ - con nếu hai người đang là vợ/chồng.',
      });
    }
  }

  return okResult();
};

module.exports = {
  ERROR_LEVEL,
  WARNING_LEVEL,
  errorResult,
  warningResult,
  okResult,
  normalizeForceFlag,
  validateBirthDeathDates,
  loadPeopleStatus,
  validateSpouseKinshipConflict,
  validateParentChildSpouseConflict,
};
