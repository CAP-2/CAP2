const asArray = (value) => (Array.isArray(value) ? value : []);

const toId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const birthTime = (person) => {
  const text = String(person?.birth_date || "");
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? time : null;
};

const isoDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const addYearsToIsoDate = (value, years) => {
  const text = isoDateOnly(value);
  if (!text) return null;
  const [year, month, day] = text.split("-").map(Number);
  const target = new Date(Date.UTC(year + years, month - 1, day));
  return Number.isNaN(target.getTime()) ? null : target.toISOString().slice(0, 10);
};

const parentIsLivingForAgeRule = (parent) => {
  if (!parent) return true;
  if (parent.is_living === undefined || parent.is_living === null || parent.is_living === "") {
    return !parent.death_date;
  }
  return Number(parent.is_living) === 1 && !parent.death_date;
};

const parentChildAgeGapMessage = (child, parent) => {
  const childBirth = isoDateOnly(child?.birth_date);
  const parentBirth = isoDateOnly(parent?.birth_date);
  if (!childBirth || !parentBirth) return null;

  const requiredYears = parentIsLivingForAgeRule(parent) ? 18 : 15;
  const minChildBirth = addYearsToIsoDate(parentBirth, requiredYears);
  if (!minChildBirth || childBirth >= minChildBirth) return null;

  return requiredYears === 18
    ? "Con phải nhỏ hơn cha/mẹ ít nhất 18 tuổi nếu cha/mẹ còn sống."
    : "Con phải nhỏ hơn cha/mẹ ít nhất 15 tuổi nếu cha/mẹ đã mất.";
};

function add(errors, personId, message) {
  const id = toId(personId);
  if (!id) return;
  if (!errors.has(id)) errors.set(id, []);
  errors.get(id).push(message);
}

export function validateTreeData(people = [], families = [], childRows = []) {
  const errors = new Map();
  const peopleById = new Map(asArray(people).map((person) => [Number(person.id), person]));
  const familyById = new Map(asArray(families).map((family) => [Number(family.id), family]));

  asArray(people).forEach((person) => {
    const name = person?.display_name || [person?.surname, person?.middle_name, person?.first_name].filter(Boolean).join(" ").trim();
    if (!String(name || "").trim()) add(errors, person.id, "Thiếu tên");
    if (![1, 2].includes(Number(person.gender))) add(errors, person.id, "Thiếu hoặc sai giới tính");
    if (Number(person.is_living) !== 0 && !toId(person.account_id)) add(errors, person.id, "Chưa liên kết tài khoản");
  });

  const childParentPairs = new Set();
  asArray(families).forEach((family) => {
    const father = peopleById.get(Number(family.father_id));
    const mother = peopleById.get(Number(family.mother_id));
    if (father && Number(father.gender) !== 1) add(errors, father.id, "Người đang ở vai trò cha nhưng giới tính không phải nam");
    if (mother && Number(mother.gender) !== 2) add(errors, mother.id, "Người đang ở vai trò mẹ nhưng giới tính không phải nữ");
  });

  asArray(childRows).forEach((row) => {
    const family = familyById.get(Number(row.family_id));
    const child = peopleById.get(Number(row.person_id));
    if (!family || !child) return;
    [family.father_id, family.mother_id].filter(Boolean).forEach((parentId) => {
      const parent = peopleById.get(Number(parentId));
      const key = `${Number(parentId)}:${Number(child.id)}`;
      if (childParentPairs.has(key)) add(errors, child.id, "Trùng quan hệ cha/mẹ - con");
      childParentPairs.add(key);
      const childBirth = birthTime(child);
      const parentBirth = birthTime(parent);
      const ageGapMessage = parentChildAgeGapMessage(child, parent);
      if (ageGapMessage) add(errors, child.id, ageGapMessage);
      if (childBirth != null && parentBirth != null && childBirth < parentBirth) {
        add(errors, child.id, "Con sinh trước cha/mẹ");
      }
    });
  });

  const graph = new Map();
  childParentPairs.forEach((pair) => {
    const [parentId, childId] = pair.split(":").map(Number);
    if (!graph.has(parentId)) graph.set(parentId, []);
    graph.get(parentId).push(childId);
  });
  const visiting = new Set();
  const visited = new Set();
  const dfs = (id, path = []) => {
    if (visiting.has(id)) {
      path.concat(id).forEach((nodeId) => add(errors, nodeId, "Có vòng lặp quan hệ"));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    asArray(graph.get(id)).forEach((nextId) => dfs(nextId, path.concat(id)));
    visiting.delete(id);
    visited.add(id);
  };
  asArray(people).forEach((person) => dfs(Number(person.id)));

  return errors;
}
