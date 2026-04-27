import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { toBlob } from "html-to-image";
import {
  createPersonAPI,
  deletePersonAPI,
  linkRelationsAPI,
  updatePersonAPI,
  updatePersonPositionAPI,
} from "../../api/managerService";
import "./FamilyTreeEditor.css";

const CARD_WIDTH = 180;
const CARD_HEIGHT = 210;
const LEVEL_HEIGHT = Math.round(CARD_HEIGHT * 1.5);
const X_GAP = Math.round(CARD_WIDTH * 0.9);
const SPOUSE_GAP = X_GAP;
const SIBLING_GAP = X_GAP;
const FAMILY_GAP = Math.round(CARD_WIDTH * 1.2);
const Y_GAP = LEVEL_HEIGHT;
const CANVAS_PADDING = 180;
const SNAP_SIZE = 20;
const EXPORT_BACKGROUND = "#f8edb2";
const EXPORT_MAX_CANVAS_EDGE = 14000;
const TRANSPARENT_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const toInt = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const snap = (value) => Math.round(toInt(value, 0) / SNAP_SIZE) * SNAP_SIZE;

const asArray = (value) => (Array.isArray(value) ? value : []);

const dateInput = (value) => {
  if (!value) return "";
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
};

const fullName = (person, fallback = "Chưa có tên") =>
  person?.display_name ||
  [person?.surname, person?.middle_name, person?.first_name].filter(Boolean).join(" ").trim() ||
  fallback;

const normalizePerson = (person) => ({
  ...person,
  id: Number(person.id),
  account_id: person.account_id == null ? null : Number(person.account_id),
  tree_x: toInt(person.tree_x, 0),
  tree_y: toInt(person.tree_y, 0),
  display_order: toInt(person.display_order, 0),
  generation: toInt(person.generation, 1) || 1,
});

function personIdentityKey(person) {
  const accountId = Number(person?.account_id);
  return Number.isFinite(accountId) && accountId > 0 ? `account:${accountId}` : `person:${Number(person?.id)}`;
}

function dedupePeopleByAccount(sourcePeople) {
  const normalized = asArray(sourcePeople).map(normalizePerson).filter((person) => Number.isFinite(person.id));
  const canonicalByKey = new Map();

  normalized
    .slice()
    .sort((a, b) => {
      const manualA = toInt(a.tree_x, 0) !== 0 || toInt(a.tree_y, 0) !== 0 ? 0 : 1;
      const manualB = toInt(b.tree_x, 0) !== 0 || toInt(b.tree_y, 0) !== 0 ? 0 : 1;
      if (manualA !== manualB) return manualA - manualB;
      return personSort(a, b);
    })
    .forEach((person) => {
      const key = personIdentityKey(person);
      if (!canonicalByKey.has(key)) canonicalByKey.set(key, person);
    });

  const idMap = new Map();
  normalized.forEach((person) => {
    const canonical = canonicalByKey.get(personIdentityKey(person));
    idMap.set(Number(person.id), Number(canonical?.id || person.id));
  });

  const uniqueByPersonId = new Map();
  [...canonicalByKey.values()].sort(personSort).forEach((person) => {
    if (!uniqueByPersonId.has(Number(person.id))) uniqueByPersonId.set(Number(person.id), person);
  });

  return {
    people: [...uniqueByPersonId.values()],
    idMap,
  };
}

function remapFamiliesByPeople(families, idMap, people) {
  const peopleIds = new Set(asArray(people).map((person) => Number(person.id)));
  const seen = new Map();
  const familyIdMap = new Map();
  const remapped = [];

  asArray(families)
    .map((family) => ({
      ...family,
      father_id: family.father_id == null ? null : idMap.get(Number(family.father_id)) ?? Number(family.father_id),
      mother_id: family.mother_id == null ? null : idMap.get(Number(family.mother_id)) ?? Number(family.mother_id),
    }))
    .filter((family) => family.father_id || family.mother_id)
    .filter((family) => {
      if (family.father_id && !peopleIds.has(Number(family.father_id))) return false;
      if (family.mother_id && !peopleIds.has(Number(family.mother_id))) return false;
      const key = `${Number(family.father_id) || "null"}:${Number(family.mother_id) || "null"}`;
      const existingFamilyId = seen.get(key);
      if (existingFamilyId) {
        familyIdMap.set(Number(family.id), existingFamilyId);
        return false;
      }
      seen.set(key, Number(family.id));
      familyIdMap.set(Number(family.id), Number(family.id));
      remapped.push(family);
      return true;
    });

  return { families: remapped, familyIdMap };
}

function remapChildrenByPeople(childRows, idMap, familyIdMap, families, people) {
  const peopleIds = new Set(asArray(people).map((person) => Number(person.id)));
  const familyIds = new Set(asArray(families).map((family) => Number(family.id)));
  const seen = new Set();
  return asArray(childRows)
    .map((row) => ({
      ...row,
      family_id: familyIdMap.get(Number(row.family_id)) ?? Number(row.family_id),
      person_id: idMap.get(Number(row.person_id)) ?? Number(row.person_id),
    }))
    .filter((row) => familyIds.has(Number(row.family_id)) && peopleIds.has(Number(row.person_id)))
    .filter((row) => {
      const key = `${Number(row.family_id)}:${Number(row.person_id)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function personSort(a, b) {
  const orderDiff = toInt(a?.display_order, 0) - toInt(b?.display_order, 0);
  if (orderDiff) return orderDiff;
  return toInt(a?.tree_x, 0) - toInt(b?.tree_x, 0) || Number(a?.id || 0) - Number(b?.id || 0);
}

function generationY(generation) {
  return snap(CANVAS_PADDING + Math.max(0, toInt(generation, 1) - 1) * LEVEL_HEIGHT);
}

function simpleGenerationLayout(sourcePeople) {
  const people = asArray(sourcePeople).map(normalizePerson);
  const grouped = new Map();

  people
    .slice()
    .sort((a, b) => {
      const genDiff = toInt(a.generation, 1) - toInt(b.generation, 1);
      if (genDiff) return genDiff;
      const orderDiff = toInt(a.display_order, 0) - toInt(b.display_order, 0);
      if (orderDiff) return orderDiff;
      return a.id - b.id;
    })
    .forEach((person) => {
      const generation = toInt(person.generation, 1) || 1;
      if (!grouped.has(generation)) grouped.set(generation, []);
      grouped.get(generation).push(person);
    });

  const generations = [...grouped.keys()].sort((a, b) => a - b);
  const maxRowWidth = Math.max(
    1,
    ...generations.map((gen) => grouped.get(gen).length * CARD_WIDTH + Math.max(0, grouped.get(gen).length - 1) * X_GAP),
  );

  return people.map((person) => {
    const generation = toInt(person.generation, 1) || 1;
    const row = grouped.get(generation) || [];
    const index = row.findIndex((item) => item.id === person.id);
    const rowWidth = row.length * CARD_WIDTH + Math.max(0, row.length - 1) * X_GAP;
    const x = CANVAS_PADDING + Math.max(0, (maxRowWidth - rowWidth) / 2) + Math.max(0, index) * (CARD_WIDTH + X_GAP);
    const y = CANVAS_PADDING + Math.max(0, generation - 1) * Y_GAP;

    return {
      ...person,
      tree_x: snap(x),
      tree_y: snap(y),
      display_order: Math.max(0, index),
    };
  });
}

function autoLayoutPeople(sourcePeople, families = [], childRows = []) {
  const people = asArray(sourcePeople).map(normalizePerson);
  if (!people.length) return [];

  const peopleMap = new Map(people.map((person) => [Number(person.id), person]));
  const familyRows = asArray(families).filter((family) => Number(family.id));
  if (!familyRows.length) return simpleGenerationLayout(people);

  const childrenByFamily = new Map();
  const childIds = new Set();
  asArray(childRows).forEach((row) => {
    const familyId = Number(row.family_id);
    const childId = Number(row.person_id);
    if (!peopleMap.has(childId) || !Number.isFinite(familyId)) return;
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push(childId);
    childIds.add(childId);
  });

  const familyByParentId = new Map();
  familyRows.forEach((family) => {
    [family.father_id, family.mother_id].forEach((id) => {
      const parentId = Number(id);
      if (peopleMap.has(parentId) && !familyByParentId.has(parentId)) {
        familyByParentId.set(parentId, family);
      }
    });
  });

  const mergePositionMaps = (target, source, offsetX = 0) => {
    source.forEach((position, id) => {
      target.set(id, { ...position, x: position.x + offsetX });
    });
  };

  const layoutSingle = (person) => ({
    width: CARD_WIDTH,
    positions: new Map([[Number(person.id), { x: 0, y: generationY(person.generation) }]]),
  });

  const layoutFamily = (family, visitedFamilies = new Set()) => {
    const familyId = Number(family.id);
    if (visitedFamilies.has(familyId)) {
      const parent = peopleMap.get(Number(family.father_id)) || peopleMap.get(Number(family.mother_id));
      return parent ? layoutSingle(parent) : { width: CARD_WIDTH, positions: new Map() };
    }

    const nextVisited = new Set(visitedFamilies);
    nextVisited.add(familyId);

    const parents = [peopleMap.get(Number(family.father_id)), peopleMap.get(Number(family.mother_id))]
      .filter(Boolean)
      .sort((a, b) => toInt(a.gender, 0) - toInt(b.gender, 0) || personSort(a, b));
    const children = asArray(childrenByFamily.get(familyId))
      .map((id) => peopleMap.get(id))
      .filter(Boolean)
      .sort(personSort);

    const childUnits = children.map((child) => {
      const childFamily = familyByParentId.get(Number(child.id));
      return childFamily ? layoutFamily(childFamily, nextVisited) : layoutSingle(child);
    });
    const childrenWidth = childUnits.length
      ? childUnits.reduce((sum, unit) => sum + unit.width, 0) + Math.max(0, childUnits.length - 1) * SIBLING_GAP
      : 0;
    const parentWidth = parents.length
      ? parents.length * CARD_WIDTH + Math.max(0, parents.length - 1) * SPOUSE_GAP
      : CARD_WIDTH;
    const width = Math.max(parentWidth, childrenWidth, CARD_WIDTH);
    const positions = new Map();

    const parentStartX = (width - parentWidth) / 2;
    parents.forEach((parent, index) => {
      positions.set(Number(parent.id), {
        x: parentStartX + index * (CARD_WIDTH + SPOUSE_GAP),
        y: generationY(parent.generation),
      });
    });

    let childX = (width - childrenWidth) / 2;
    childUnits.forEach((unit) => {
      mergePositionMaps(positions, unit.positions, childX);
      childX += unit.width + SIBLING_GAP;
    });

    return { width, positions };
  };

  const rootFamilies = familyRows
    .filter((family) => {
      const parentIds = [Number(family.father_id), Number(family.mother_id)].filter((id) => peopleMap.has(id));
      return parentIds.length && parentIds.every((id) => !childIds.has(id));
    })
    .sort((a, b) => {
      const aParent = peopleMap.get(Number(a.father_id)) || peopleMap.get(Number(a.mother_id));
      const bParent = peopleMap.get(Number(b.father_id)) || peopleMap.get(Number(b.mother_id));
      return toInt(aParent?.generation, 1) - toInt(bParent?.generation, 1) || personSort(aParent || {}, bParent || {});
    });

  const positioned = new Map();
  let cursorX = CANVAS_PADDING;
  rootFamilies.forEach((family) => {
    const unit = layoutFamily(family);
    mergePositionMaps(positioned, unit.positions, cursorX);
    cursorX += unit.width + FAMILY_GAP;
  });

  const placedIds = new Set(positioned.keys());
  const leftovers = people.filter((person) => !placedIds.has(Number(person.id)));
  if (leftovers.length) {
    simpleGenerationLayout(leftovers).forEach((person) => {
      positioned.set(Number(person.id), {
        x: person.tree_x + Math.max(0, cursorX - CANVAS_PADDING),
        y: person.tree_y,
      });
    });
  }

  const laidOut = people.map((person) => {
    const position = positioned.get(Number(person.id));
    return {
      ...person,
      tree_x: snap(position?.x ?? person.tree_x),
      tree_y: snap(position?.y ?? generationY(person.generation)),
    };
  });

  return normalizeGenerationSpacing(assignDisplayOrder(laidOut));
}

function hasManualLayout(people) {
  return asArray(people).some((person) => toInt(person.tree_x, 0) !== 0 || toInt(person.tree_y, 0) !== 0);
}

function assignDisplayOrder(people) {
  const grouped = new Map();
  people.forEach((person) => {
    const generation = toInt(person.generation, 1) || 1;
    if (!grouped.has(generation)) grouped.set(generation, []);
    grouped.get(generation).push(person);
  });

  const orderById = new Map();
  grouped.forEach((members) => {
    members
      .slice()
      .sort((a, b) => a.tree_x - b.tree_x || a.tree_y - b.tree_y || a.id - b.id)
      .forEach((person, index) => orderById.set(person.id, index));
  });

  return people.map((person) => ({ ...person, display_order: orderById.get(person.id) ?? person.display_order ?? 0 }));
}

function normalizeGenerationSpacing(people) {
  const grouped = new Map();
  asArray(people).forEach((person) => {
    const generation = toInt(person.generation, 1) || 1;
    if (!grouped.has(generation)) grouped.set(generation, []);
    grouped.get(generation).push(person);
  });

  const generations = [...grouped.keys()].sort((a, b) => a - b);
  const rowPitch = CARD_WIDTH + X_GAP;
  const maxRowWidth = Math.max(
    CARD_WIDTH,
    ...generations.map((generation) => {
      const row = grouped.get(generation) || [];
      return row.length * CARD_WIDTH + Math.max(0, row.length - 1) * X_GAP;
    }),
  );

  const positioned = [];
  generations.forEach((generation) => {
    const row = (grouped.get(generation) || [])
      .slice()
      .sort((a, b) => toInt(a.tree_x, 0) - toInt(b.tree_x, 0) || personSort(a, b));
    const rowWidth = row.length * CARD_WIDTH + Math.max(0, row.length - 1) * X_GAP;
    const startX = CANVAS_PADDING + Math.max(0, (maxRowWidth - rowWidth) / 2);
    row.forEach((person, index) => {
      positioned.push({
        ...person,
        tree_x: snap(startX + index * rowPitch),
        tree_y: generationY(generation),
        display_order: index,
      });
    });
  });

  return positioned.sort((a, b) => toInt(a.generation, 1) - toInt(b.generation, 1) || personSort(a, b));
}

function centerOf(person) {
  return {
    x: toInt(person.tree_x, 0) + CARD_WIDTH / 2,
    y: toInt(person.tree_y, 0) + CARD_HEIGHT / 2,
  };
}

function getTreeExportBounds(people) {
  if (!people.length) {
    return { x: 0, y: 0, width: 1200, height: 800 };
  }

  const padding = 90;
  const titleMinX = 40;
  const titleMinY = 30;
  const minX = Math.min(titleMinX, ...people.map((person) => toInt(person.tree_x, 0))) - padding;
  const minY = Math.min(titleMinY, ...people.map((person) => toInt(person.tree_y, 0))) - padding;
  const maxX = Math.max(...people.map((person) => toInt(person.tree_x, 0) + CARD_WIDTH)) + padding;
  const maxY = Math.max(...people.map((person) => toInt(person.tree_y, 0) + CARD_HEIGHT)) + padding;

  return {
    x: Math.max(0, Math.floor(minX)),
    y: Math.max(0, Math.floor(minY)),
    width: Math.max(900, Math.ceil(maxX - Math.max(0, minX))),
    height: Math.max(620, Math.ceil(maxY - Math.max(0, minY))),
  };
}

function getExportPixelRatio(bounds) {
  const largestEdge = Math.max(bounds.width, bounds.height);
  if (!largestEdge) return 2;
  return Math.max(0.75, Math.min(2, EXPORT_MAX_CANVAS_EDGE / largestEdge));
}

function exportFileName(name) {
  return `${String(name || "gia-pha")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "gia-pha"}.png`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildTreeLines(people, families, childRows) {
  const peopleMap = new Map(people.map((person) => [Number(person.id), person]));
  const childrenByFamily = new Map();

  asArray(childRows).forEach((row) => {
    const familyId = Number(row.family_id);
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push(Number(row.person_id));
  });

  const lines = [];

  asArray(families).forEach((family) => {
    const father = peopleMap.get(Number(family.father_id));
    const mother = peopleMap.get(Number(family.mother_id));
    const parents = [father, mother].filter(Boolean);
    const children = asArray(childrenByFamily.get(Number(family.id)))
      .map((id) => peopleMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a.tree_x - b.tree_x || a.id - b.id);

    if (father && mother) {
      const left = toInt(father.tree_x, 0) <= toInt(mother.tree_x, 0) ? father : mother;
      const right = left === father ? mother : father;
      const leftEdge = toInt(left.tree_x, 0) + CARD_WIDTH;
      const rightEdge = toInt(right.tree_x, 0);
      const y = Math.round((centerOf(father).y + centerOf(mother).y) / 2);
      lines.push({
        type: "spouse",
        d: rightEdge > leftEdge ? `M ${leftEdge} ${y} H ${rightEdge}` : `M ${centerOf(father).x} ${y} H ${centerOf(mother).x}`,
      });
    }

    if (!parents.length || !children.length) return;

    const lineParent = father || parents[0];
    const parentX = Math.round(centerOf(lineParent).x);
    const parentBottomY = toInt(lineParent.tree_y, 0) + CARD_HEIGHT;
    const childCenters = children.map((child) => ({
      x: toInt(child.tree_x, 0) + CARD_WIDTH / 2,
      y: toInt(child.tree_y, 0),
    }));
    const busMinX = Math.min(parentX, ...childCenters.map((item) => item.x));
    const busMaxX = Math.max(parentX, ...childCenters.map((item) => item.x));
    const firstChildY = Math.min(...childCenters.map((item) => item.y));
    const middleY = Math.round(Math.max(parentBottomY + 40, firstChildY - 54));

    lines.push({ type: "blood", d: `M ${parentX} ${parentBottomY} V ${middleY}` });
    lines.push({ type: "blood", d: `M ${busMinX} ${middleY} H ${busMaxX}` });
    childCenters.forEach((child) => {
      lines.push({ type: "blood", d: `M ${child.x} ${middleY} V ${child.y}` });
    });
  });

  return lines;
}

function findParentFamilyForChild(personId, families, childRows) {
  const child = asArray(childRows).find((row) => Number(row.person_id) === Number(personId));
  if (!child) return null;
  return asArray(families).find((family) => Number(family.id) === Number(child.family_id)) || null;
}

function findFamilyForParent(personId, families) {
  return asArray(families).find(
    (family) => Number(family.father_id) === Number(personId) || Number(family.mother_id) === Number(personId),
  );
}

function findSpouse(person, families, people) {
  if (!person) return null;
  const family = findFamilyForParent(person.id, families);
  if (!family) return null;
  const spouseId = Number(family.father_id) === Number(person.id) ? Number(family.mother_id) : Number(family.father_id);
  return people.find((item) => Number(item.id) === spouseId) || null;
}

const relationLabels = {
  spouse: "vợ/chồng",
  child: "con",
  father: "cha",
  mother: "mẹ",
};

function relationCandidates(relation, selectedPerson, people, linkedIds = new Set()) {
  const selectedGeneration = toInt(selectedPerson?.generation, 1) || 1;
  return asArray(people)
    .filter((person) => Number(person.id) !== Number(selectedPerson?.id))
    .filter((person) => {
      if (linkedIds.has(Number(person.id))) return true;
      if (relation === "father") return Number(person.gender) !== 2;
      if (relation === "mother") return Number(person.gender) !== 1;
      if (relation === "spouse") {
        return !selectedPerson?.gender || !person.gender || Number(person.gender) !== Number(selectedPerson.gender);
      }
      return true;
    })
    .sort((a, b) => {
      const linkedDiff = Number(linkedIds.has(Number(b.id))) - Number(linkedIds.has(Number(a.id)));
      if (linkedDiff) return linkedDiff;
      if (relation === "father" || relation === "mother") {
        const genDiff = Math.abs(toInt(a.generation, 1) - Math.max(1, selectedGeneration - 1)) -
          Math.abs(toInt(b.generation, 1) - Math.max(1, selectedGeneration - 1));
        if (genDiff) return genDiff;
      }
      if (relation === "child") {
        const genDiff = Math.abs(toInt(a.generation, 1) - (selectedGeneration + 1)) -
          Math.abs(toInt(b.generation, 1) - (selectedGeneration + 1));
        if (genDiff) return genDiff;
      }
      return personSort(a, b);
    });
}

function relationLinkedIds(relation, selectedPerson, families, childRows) {
  if (!selectedPerson) return new Set();
  const selectedId = Number(selectedPerson.id);

  if (relation === "father" || relation === "mother") {
    const family = findParentFamilyForChild(selectedId, families, childRows);
    const id = relation === "father" ? Number(family?.father_id) : Number(family?.mother_id);
    return Number.isFinite(id) && id > 0 ? new Set([id]) : new Set();
  }

  const family = findFamilyForParent(selectedId, families);
  if (!family) return new Set();

  if (relation === "spouse") {
    const spouseId = Number(family.father_id) === selectedId ? Number(family.mother_id) : Number(family.father_id);
    return Number.isFinite(spouseId) && spouseId > 0 ? new Set([spouseId]) : new Set();
  }

  if (relation === "child") {
    return new Set(
      asArray(childRows)
        .filter((row) => Number(row.family_id) === Number(family.id))
        .map((row) => Number(row.person_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
  }

  return new Set();
}

function blankCreateForm(relation, selectedPerson, spouse) {
  const selectedGeneration = toInt(selectedPerson?.generation, 1) || 1;
  const selectedX = toInt(selectedPerson?.tree_x, CANVAS_PADDING);
  const selectedY = toInt(selectedPerson?.tree_y, CANVAS_PADDING);
  const relationGender =
    relation === "spouse"
      ? Number(selectedPerson?.gender) === 1
        ? "2"
        : "1"
      : relation === "mother"
        ? "2"
        : "1";
  const generation =
    relation === "child"
      ? selectedGeneration + 1
      : relation === "father" || relation === "mother"
        ? Math.max(1, selectedGeneration - 1)
        : selectedGeneration;
  const x =
    relation === "spouse"
      ? selectedX + CARD_WIDTH + X_GAP
      : relation === "child"
        ? selectedX
        : relation === "father" || relation === "mother"
          ? selectedX + (relation === "mother" ? CARD_WIDTH + X_GAP : 0)
          : CANVAS_PADDING;
  const y =
    relation === "child"
      ? selectedY + Y_GAP
      : relation === "father" || relation === "mother"
        ? Math.max(80, selectedY - Y_GAP)
        : relation === "spouse"
          ? selectedY
          : CANVAS_PADDING;

  return {
    display_name: "",
    surname: selectedPerson?.surname || spouse?.surname || "",
    middle_name: "",
    first_name: "",
    gender: relationGender,
    birth_date: "",
    death_date: "",
    is_living: "1",
    generation: String(generation),
    branch: selectedPerson?.branch != null ? String(selectedPerson.branch) : "",
    hometown: selectedPerson?.hometown || "",
    avatar_url: "",
    bio: "",
    note: "",
    tree_x: String(Math.round(x)),
    tree_y: String(Math.round(y)),
  };
}

function personToForm(person) {
  return {
    display_name: person?.display_name || "",
    surname: person?.surname || "",
    middle_name: person?.middle_name || "",
    first_name: person?.first_name || "",
    gender: person?.gender == null ? "" : String(person.gender),
    birth_date: dateInput(person?.birth_date),
    death_date: dateInput(person?.death_date),
    is_living: Number(person?.is_living) === 0 ? "0" : "1",
    generation: person?.generation != null ? String(person.generation) : "1",
    branch: person?.branch != null ? String(person.branch) : "",
    hometown: person?.hometown || "",
    address: person?.address || "",
    phone: person?.phone || "",
    email: person?.email || "",
    avatar_url: person?.avatar_url || "",
    bio: person?.bio || "",
    note: person?.note || "",
  };
}

function PersonCard({ person, selected, dragging, onPointerDown, onSelect }) {
  const name = fullName(person, `Người #${person.id}`);
  const years = `${person.birth_date ? String(person.birth_date).slice(0, 4) : "?"} - ${
    person.death_date ? String(person.death_date).slice(0, 4) : "nay"
  }`;
  const genderClass = Number(person.gender) === 1 ? "is-male" : Number(person.gender) === 2 ? "is-female" : "is-unknown";
  const genderText = Number(person.gender) === 1 ? "Nam" : Number(person.gender) === 2 ? "Nữ" : "?";
  const deceased = Number(person.is_living) === 0;

  return (
    <div
      className={`fte-personCard ${genderClass} ${deceased ? "is-deceased" : ""} ${selected ? "is-selected" : ""} ${dragging ? "is-dragging" : ""}`}
      style={{ left: person.tree_x, top: person.tree_y }}
      role="button"
      tabIndex={0}
      title={name}
      onPointerDown={(event) => onPointerDown(event, person)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(person.id);
        }
      }}
    >
      <div className="fte-cardBadges">
        <span className="fte-genderBadge">{genderText}</span>
        {deceased ? <span className="fte-lifeBadge" title="Đã mất">Đã mất</span> : null}
      </div>
      <div className="fte-avatar">
        {person.avatar_url ? <img src={person.avatar_url} alt={name} draggable="false" /> : <span>{name.charAt(0).toUpperCase()}</span>}
      </div>
      <div className="fte-cardName">{name}</div>
      <div className="fte-cardMeta">{years}</div>
      <div className="fte-cardGeneration">Đời {person.generation || "?"}</div>
    </div>
  );
}

function PersonInspector({
  person,
  spouse,
  onClose,
  onSave,
  onDelete,
  onCreateRelation,
  saving,
}) {
  const [form, setForm] = useState(() => personToForm(person));

  useEffect(() => {
    setForm(personToForm(person));
  }, [person?.id]);

  if (!person) {
    return null;
  }

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="fte-modalOverlay fte-inspectorOverlay" role="presentation" onMouseDown={onClose}>
      <aside className="fte-inspector" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <div className="fte-inspectorHeader">
        <div>
          <span>Thông tin thành viên</span>
          <h3>{fullName(person, `Người #${person.id}`)}</h3>
          <p>ID #{person.id}{spouse ? ` · Vợ/chồng: ${fullName(spouse)}` : ""}</p>
        </div>
        <button type="button" className="fte-iconButton" onClick={onClose} title="Đóng panel">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="fte-inspectorActions">
        <button type="button" onClick={() => onCreateRelation("spouse")}>
          <span className="material-symbols-outlined">favorite</span>
          Chọn vợ/chồng
        </button>
        <button type="button" onClick={() => onCreateRelation("child")}>
          <span className="material-symbols-outlined">person_add</span>
          Chọn con
        </button>
        <button type="button" onClick={() => onCreateRelation("father")}>
          <span className="material-symbols-outlined">man</span>
          Chọn cha
        </button>
        <button type="button" onClick={() => onCreateRelation("mother")}>
          <span className="material-symbols-outlined">woman</span>
          Chọn mẹ
        </button>
      </div>

      <div className="fte-formGrid">
        <label>
          Tên hiển thị
          <input value={form.display_name} onChange={(event) => setField("display_name", event.target.value)} />
        </label>
        <label>
          Họ
          <input value={form.surname} onChange={(event) => setField("surname", event.target.value)} />
        </label>
        <label>
          Tên đệm
          <input value={form.middle_name} onChange={(event) => setField("middle_name", event.target.value)} />
        </label>
        <label>
          Tên
          <input value={form.first_name} onChange={(event) => setField("first_name", event.target.value)} />
        </label>
        <label>
          Giới tính
          <select value={form.gender} onChange={(event) => setField("gender", event.target.value)}>
            <option value="">Không rõ</option>
            <option value="1">Nam</option>
            <option value="2">Nữ</option>
          </select>
        </label>
        <label>
          Tình trạng
          <select value={form.is_living} onChange={(event) => setField("is_living", event.target.value)}>
            <option value="1">Còn sống</option>
            <option value="0">Đã mất</option>
          </select>
        </label>
        <label>
          Ngày sinh
          <input type="date" value={form.birth_date} onChange={(event) => setField("birth_date", event.target.value)} />
        </label>
        <label>
          Ngày mất
          <input type="date" value={form.death_date} onChange={(event) => setField("death_date", event.target.value)} />
        </label>
        <label>
          Đời thứ
          <input type="number" min="1" value={form.generation} onChange={(event) => setField("generation", event.target.value)} />
        </label>
        <label>
          Chi nhánh
          <input value={form.branch} onChange={(event) => setField("branch", event.target.value)} />
        </label>
        <label className="is-wide">
          Quê quán
          <input value={form.hometown} onChange={(event) => setField("hometown", event.target.value)} />
        </label>
        <label className="is-wide">
          Địa chỉ
          <input value={form.address} onChange={(event) => setField("address", event.target.value)} />
        </label>
        <label>
          Điện thoại
          <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
        </label>
        <label className="is-wide">
          Ảnh đại diện URL
          <input value={form.avatar_url} onChange={(event) => setField("avatar_url", event.target.value)} />
        </label>
        <label className="is-wide">
          Giới thiệu
          <textarea rows={3} value={form.bio} onChange={(event) => setField("bio", event.target.value)} />
        </label>
        <label className="is-wide">
          Ghi chú
          <textarea rows={2} value={form.note} onChange={(event) => setField("note", event.target.value)} />
        </label>
      </div>

      <div className="fte-inspectorFooter">
        <button type="button" className="fte-primaryButton" disabled={saving} onClick={() => onSave(form)}>
          <span className="material-symbols-outlined">save</span>
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
        <button type="button" className="fte-dangerButton" disabled={saving} onClick={onDelete}>
          <span className="material-symbols-outlined">delete</span>
          Xóa
        </button>
      </div>
      </aside>
    </div>
  );
}

function RelationSelectDialog({
  relation,
  selectedPerson,
  people,
  families,
  childRows,
  value,
  onChange,
  onCancel,
  onSubmit,
  onUnlink,
  saving,
}) {
  const [query, setQuery] = useState("");
  if (!relation || !selectedPerson) return null;

  const linkedIds = relationLinkedIds(relation, selectedPerson, families, childRows);
  const candidates = relationCandidates(relation, selectedPerson, people, linkedIds);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = candidates.filter((person) => {
    if (!normalizedQuery) return true;
    return `${fullName(person)} ${person.email || ""} ${person.phone || ""}`.toLowerCase().includes(normalizedQuery);
  });
  const title = `Chọn ${relationLabels[relation] || "quan hệ"}`;
  const selectedLinked = linkedIds.has(Number(value));
  const canUnlink = linkedIds.size > 0 && (relation !== "child" || selectedLinked);

  return (
    <div className="fte-modalOverlay" role="presentation" onMouseDown={onCancel}>
      <div className="fte-modal fte-relationModal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="fte-modalHeader">
          <div>
            <span>{fullName(selectedPerson)}</span>
            <h3>{title}</h3>
          </div>
          <button type="button" className="fte-iconButton" onClick={onCancel} title="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="fte-relationPicker">
          <label>
            Tìm trong thành viên đã có
            <input
              autoFocus
              value={query}
              placeholder="Nhập tên, email hoặc số điện thoại"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="fte-relationList">
            {filtered.length ? (
              filtered.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={`fte-relationOption ${Number(value) === Number(person.id) ? "is-selected" : ""} ${
                    linkedIds.has(Number(person.id)) ? "is-linked" : ""
                  }`}
                  onClick={() => onChange(person.id)}
                >
                  <span className="fte-relationAvatar">
                    {person.avatar_url ? <img src={person.avatar_url} alt={fullName(person)} /> : fullName(person).charAt(0).toUpperCase()}
                  </span>
                  <span>
                    <strong>{fullName(person, `Người #${person.id}`)}</strong>
                    <small>
                      ID #{person.id} · Đời {person.generation || "?"}
                      {person.gender ? ` · ${Number(person.gender) === 1 ? "Nam" : "Nữ"}` : ""}
                      {person.account_id ? ` · TK #${person.account_id}` : ""}
                    </small>
                  </span>
                  {linkedIds.has(Number(person.id)) ? <em>Đang liên kết</em> : null}
                </button>
              ))
            ) : (
              <div className="fte-relationEmpty">Không có thành viên phù hợp.</div>
            )}
          </div>
        </div>

        <div className="fte-modalFooter">
          <button type="button" className="fte-dangerButton" disabled={saving || !canUnlink} onClick={onUnlink}>
            <span className="material-symbols-outlined">link_off</span>
            Bỏ liên kết
          </button>
          <button type="button" className="fte-primaryButton" disabled={saving || !value} onClick={onSubmit}>
            <span className="material-symbols-outlined">link</span>
            {saving ? "Đang liên kết..." : "Liên kết"}
          </button>
          <button type="button" className="fte-ghostButton" disabled={saving} onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatePersonDialog({ relation, form, selectedPerson, onChange, onCancel, onSubmit, saving }) {
  if (!relation) return null;

  const titleMap = {
    person: "Thêm người",
    spouse: "Thêm vợ/chồng",
    child: "Thêm con",
    father: "Thêm cha",
    mother: "Thêm mẹ",
  };

  const setField = (field, value) => onChange({ ...form, [field]: value });

  return (
    <div className="fte-modalOverlay" role="presentation" onMouseDown={onCancel}>
      <div className="fte-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="fte-modalHeader">
          <div>
            <span>{selectedPerson ? fullName(selectedPerson) : "Gia phả"}</span>
            <h3>{titleMap[relation] || "Thêm người"}</h3>
          </div>
          <button type="button" className="fte-iconButton" onClick={onCancel} title="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="fte-formGrid fte-formGrid--modal">
          <label className="is-wide">
            Tên hiển thị
            <input autoFocus value={form.display_name} onChange={(event) => setField("display_name", event.target.value)} />
          </label>
          <label>
            Họ
            <input value={form.surname} onChange={(event) => setField("surname", event.target.value)} />
          </label>
          <label>
            Tên đệm
            <input value={form.middle_name} onChange={(event) => setField("middle_name", event.target.value)} />
          </label>
          <label>
            Tên
            <input value={form.first_name} onChange={(event) => setField("first_name", event.target.value)} />
          </label>
          <label>
            Giới tính
            <select value={form.gender} onChange={(event) => setField("gender", event.target.value)}>
              <option value="1">Nam</option>
              <option value="2">Nữ</option>
              <option value="">Không rõ</option>
            </select>
          </label>
          <label>
            Đời thứ
            <input type="number" min="1" value={form.generation} onChange={(event) => setField("generation", event.target.value)} />
          </label>
          <label>
            Ngày sinh
            <input type="date" value={form.birth_date} onChange={(event) => setField("birth_date", event.target.value)} />
          </label>
          <label>
            Ngày mất
            <input type="date" value={form.death_date} onChange={(event) => setField("death_date", event.target.value)} />
          </label>
          <label className="is-wide">
            Quê quán
            <input value={form.hometown} onChange={(event) => setField("hometown", event.target.value)} />
          </label>
          <label className="is-wide">
            Ảnh đại diện URL
            <input value={form.avatar_url} onChange={(event) => setField("avatar_url", event.target.value)} />
          </label>
        </div>

        <div className="fte-modalFooter">
          <button type="button" className="fte-primaryButton" disabled={saving} onClick={onSubmit}>
            <span className="material-symbols-outlined">person_add</span>
            {saving ? "Đang tạo..." : "Tạo"}
          </button>
          <button type="button" className="fte-ghostButton" disabled={saving} onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FamilyTreeEditor({
  clan,
  people: initialPeople = [],
  families = [],
  children: childRows = [],
  loading = false,
  onReload,
}) {
  const treeRef = useRef(null);
  const scaleRef = useRef(0.75);
  const lastDragRef = useRef(null);
  const [people, setPeople] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [relationDialog, setRelationDialog] = useState(null);
  const [dialogSaving, setDialogSaving] = useState(false);

  const canonicalTree = useMemo(() => {
    const { people: uniquePeople, idMap } = dedupePeopleByAccount(initialPeople);
    const familyData = remapFamiliesByPeople(families, idMap, uniquePeople);
    return {
      people: uniquePeople,
      families: familyData.families,
      childRows: remapChildrenByPeople(childRows, idMap, familyData.familyIdMap, familyData.families, uniquePeople),
    };
  }, [initialPeople, families, childRows]);

  useEffect(() => {
    const normalized = canonicalTree.people;
    const nextPeople = autoLayoutPeople(normalized, canonicalTree.families, canonicalTree.childRows);
    setPeople(nextPeople);
    setSelectedId((current) => (current && nextPeople.some((person) => person.id === current) ? current : null));
  }, [canonicalTree]);

  const selectedPerson = useMemo(
    () => people.find((person) => Number(person.id) === Number(selectedId)) || null,
    [people, selectedId],
  );
  const selectedSpouse = useMemo(
    () => findSpouse(selectedPerson, canonicalTree.families, people),
    [canonicalTree.families, people, selectedPerson],
  );
  const lines = useMemo(
    () => buildTreeLines(people, canonicalTree.families, canonicalTree.childRows),
    [people, canonicalTree.families, canonicalTree.childRows],
  );

  const canvasSize = useMemo(() => {
    const maxX = Math.max(2400, ...people.map((person) => toInt(person.tree_x, 0) + CARD_WIDTH + CANVAS_PADDING));
    const maxY = Math.max(1400, ...people.map((person) => toInt(person.tree_y, 0) + CARD_HEIGHT + CANVAS_PADDING));
    return { width: maxX, height: maxY };
  }, [people]);

  const beginDrag = useCallback((event, person) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(person.id);
    setDraggingId(person.id);

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = toInt(person.tree_x, 0);
    const originY = toInt(person.tree_y, 0);
    lastDragRef.current = { tree_x: originX, tree_y: originY };

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      const scale = scaleRef.current || 1;
      const nextPosition = {
        tree_x: snap(originX + (moveEvent.clientX - startX) / scale),
        tree_y: snap(originY + (moveEvent.clientY - startY) / scale),
      };
      lastDragRef.current = nextPosition;
      setPeople((current) =>
        current.map((item) => (item.id === person.id ? { ...item, ...nextPosition } : item)),
      );
    };

    const handleUp = async () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setDraggingId(null);
      const finalPosition = lastDragRef.current;
      if (!finalPosition) return;
      if (finalPosition.tree_x !== originX || finalPosition.tree_y !== originY) {
        try {
          await updatePersonPositionAPI(person.id, finalPosition);
          setStatus("Đã lưu vị trí.");
        } catch (error) {
          setStatus(error?.message || "Không thể lưu vị trí.");
        }
      }
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
  }, []);

  const handleExport = async () => {
    if (!treeRef.current) return;
    setSaving(true);
    setStatus("");
    let exportHost = null;
    try {
      const bounds = getTreeExportBounds(people);
      const clonedTree = treeRef.current.cloneNode(true);
      clonedTree.style.transform = `translate(${-bounds.x}px, ${-bounds.y}px)`;
      clonedTree.style.transformOrigin = "top left";
      clonedTree.style.position = "absolute";
      clonedTree.style.left = "0";
      clonedTree.style.top = "0";
      clonedTree.style.background = EXPORT_BACKGROUND;
      clonedTree.querySelectorAll(".is-selected, .is-dragging").forEach((node) => {
        node.classList.remove("is-selected", "is-dragging");
      });

      exportHost = document.createElement("div");
      exportHost.style.position = "fixed";
      exportHost.style.left = "0";
      exportHost.style.top = "0";
      exportHost.style.width = `${bounds.width}px`;
      exportHost.style.height = `${bounds.height}px`;
      exportHost.style.overflow = "hidden";
      exportHost.style.background = EXPORT_BACKGROUND;
      exportHost.style.pointerEvents = "none";
      exportHost.style.zIndex = "-1";
      exportHost.appendChild(clonedTree);
      document.body.appendChild(exportHost);

      const blob = await toBlob(exportHost, {
        pixelRatio: getExportPixelRatio(bounds),
        cacheBust: true,
        backgroundColor: EXPORT_BACKGROUND,
        imagePlaceholder: TRANSPARENT_IMAGE_DATA_URL,
        skipFonts: true,
        onImageErrorHandler: () => null,
        width: bounds.width,
        height: bounds.height,
        style: {
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
        },
      });

      if (!blob) {
        throw new Error("Không thể tạo file PNG.");
      }

      downloadBlob(blob, exportFileName(clan?.clan_name));
      setStatus("Đã xuất PNG.");
    } catch (error) {
      console.error("Export PNG failed:", error);
      setStatus(`Không thể xuất PNG${error?.message ? `: ${error.message}` : "."}`);
    } finally {
      exportHost?.remove();
      setSaving(false);
    }
  };

  const handleSavePerson = async (form) => {
    if (!selectedPerson) return;
    setSaving(true);
    setStatus("");
    try {
      const payload = {
        ...form,
        gender: form.gender === "" ? null : Number(form.gender),
        is_living: form.is_living === "1" ? 1 : 0,
        generation: Number(form.generation) || 1,
        branch: String(form.branch || "").trim() === "" ? null : Number(form.branch),
        birth_date: form.birth_date || null,
        death_date: form.death_date || null,
      };
      const result = await updatePersonAPI(selectedPerson.id, payload);
      if (result.person) {
        setPeople((current) =>
          current.map((person) =>
            person.id === selectedPerson.id ? normalizePerson({ ...person, ...result.person }) : person,
          ),
        );
      }
      setStatus("Đã lưu thông tin thành viên.");
      await onReload?.();
    } catch (error) {
      setStatus(error?.message || "Không thể lưu thông tin.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePerson = async () => {
    if (!selectedPerson) return;
    const ok = window.confirm(`Xóa ${fullName(selectedPerson)} khỏi cây gia phả?`);
    if (!ok) return;
    setSaving(true);
    setStatus("");
    try {
      await deletePersonAPI(selectedPerson.id);
      setPeople((current) => current.filter((person) => person.id !== selectedPerson.id));
      setSelectedId(null);
      setStatus("Đã xóa thành viên khỏi cây.");
      await onReload?.();
    } catch (error) {
      setStatus(error?.message || "Không thể xóa thành viên.");
    } finally {
      setSaving(false);
    }
  };

  const openCreateDialog = (relation) => {
    if (relation !== "person" && !selectedPerson) {
      setStatus("Hãy chọn một thành viên trước.");
      return;
    }
    if (relation !== "person") {
      const currentIds = relationLinkedIds(relation, selectedPerson, canonicalTree.families, canonicalTree.childRows);
      setRelationDialog({ relation, personId: [...currentIds][0] || "" });
      return;
    }
    setDialog({
      relation,
      form: blankCreateForm(relation, selectedPerson, selectedSpouse),
    });
  };

  const submitCreateDialog = async () => {
    if (!dialog) return;
    const form = dialog.form;
    const display = String(form.display_name || "").trim();
    const parts = [form.surname, form.middle_name, form.first_name].filter(Boolean).join(" ").trim();
    if (!display && !parts) {
      setStatus("Cần nhập tên thành viên mới.");
      return;
    }

    setDialogSaving(true);
    setStatus("");
    try {
      await createPersonAPI({
        ...form,
        clan_id: clan?.id,
        gender: form.gender === "" ? null : Number(form.gender),
        is_living: form.is_living === "1" ? 1 : 0,
        generation: Number(form.generation) || 1,
        branch: String(form.branch || "").trim() === "" ? null : Number(form.branch),
        birth_date: form.birth_date || null,
        death_date: form.death_date || null,
        tree_x: Number(form.tree_x) || 0,
        tree_y: Number(form.tree_y) || 0,
      });

      setDialog(null);
      setStatus("Đã tạo thành viên mới.");
      await onReload?.();
    } catch (error) {
      setStatus(error?.message || "Không thể tạo thành viên.");
    } finally {
      setDialogSaving(false);
    }
  };

  const submitRelationDialog = async () => {
    if (!relationDialog || !selectedPerson || !relationDialog.personId) return;
    const relation = relationDialog.relation;
    const targetId = Number(relationDialog.personId);

    setDialogSaving(true);
    setStatus("");
    try {
      if (relation === "spouse") {
        await linkRelationsAPI({ person_id: selectedPerson.id, spouse_person_id: targetId });
      }

      if (relation === "child") {
        const family = findFamilyForParent(selectedPerson.id, canonicalTree.families);
        const existingChildren = family
          ? asArray(canonicalTree.childRows)
              .filter((row) => Number(row.family_id) === Number(family.id))
              .map((row) => Number(row.person_id))
          : [];
        const childrenIds = Array.from(new Set([...existingChildren, targetId])).filter(
          (id) => Number(id) !== Number(selectedPerson.id),
        );
        await linkRelationsAPI({
          person_id: selectedPerson.id,
          children_person_ids: childrenIds,
        });
      }

      if (relation === "father" || relation === "mother") {
        const currentParents = findParentFamilyForChild(selectedPerson.id, canonicalTree.families, canonicalTree.childRows);
        await linkRelationsAPI({
          person_id: selectedPerson.id,
          father_person_id: relation === "father" ? targetId : currentParents?.father_id || null,
          mother_person_id: relation === "mother" ? targetId : currentParents?.mother_id || null,
        });
      }

      setRelationDialog(null);
      setStatus(`Đã liên kết ${relationLabels[relation] || "quan hệ"}.`);
      await onReload?.();
    } catch (error) {
      setStatus(error?.message || "Không thể liên kết quan hệ.");
    } finally {
      setDialogSaving(false);
    }
  };

  const unlinkRelationDialog = async () => {
    if (!relationDialog || !selectedPerson) return;
    const relation = relationDialog.relation;
    const targetId = Number(relationDialog.personId);

    setDialogSaving(true);
    setStatus("");
    try {
      if (relation === "spouse") {
        await linkRelationsAPI({ person_id: selectedPerson.id, spouse_person_id: null });
      }

      if (relation === "child") {
        const family = findFamilyForParent(selectedPerson.id, canonicalTree.families);
        const existingChildren = family
          ? asArray(canonicalTree.childRows)
              .filter((row) => Number(row.family_id) === Number(family.id))
              .map((row) => Number(row.person_id))
          : [];
        const childrenIds = existingChildren.filter((id) => Number(id) !== targetId);
        await linkRelationsAPI({
          person_id: selectedPerson.id,
          children_person_ids: childrenIds,
        });
      }

      if (relation === "father" || relation === "mother") {
        const currentParents = findParentFamilyForChild(selectedPerson.id, canonicalTree.families, canonicalTree.childRows);
        await linkRelationsAPI({
          person_id: selectedPerson.id,
          father_person_id: relation === "father" ? null : currentParents?.father_id || null,
          mother_person_id: relation === "mother" ? null : currentParents?.mother_id || null,
        });
      }

      setRelationDialog(null);
      setStatus(`Đã bỏ liên kết ${relationLabels[relation] || "quan hệ"}.`);
      await onReload?.();
    } catch (error) {
      setStatus(error?.message || "Không thể bỏ liên kết quan hệ.");
    } finally {
      setDialogSaving(false);
    }
  };

  return (
    <section className="fte-shell">
      <TransformWrapper
        initialScale={0.62}
        initialPositionX={24}
        initialPositionY={28}
        minScale={0.25}
        maxScale={2}
        centerOnInit={false}
        limitToBounds={false}
        panning={{ disabled: draggingId !== null }}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.12 }}
        onTransformed={(_, state) => {
          scaleRef.current = state?.scale || 1;
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="fte-toolbar">
              <div className="fte-toolbarGroup">
                <button type="button" onClick={() => openCreateDialog("person")}>
                  <span className="material-symbols-outlined">person_add</span>
                  Thêm người
                </button>
                <button type="button" disabled={!selectedPerson} onClick={() => openCreateDialog("spouse")}>
                  <span className="material-symbols-outlined">favorite</span>
                  Chọn vợ/chồng
                </button>
                <button type="button" disabled={!selectedPerson} onClick={() => openCreateDialog("child")}>
                  <span className="material-symbols-outlined">escalator_warning</span>
                  Chọn con
                </button>
              </div>
              <div className="fte-toolbarGroup">
                <button type="button" onClick={handleExport} disabled={loading || saving}>
                  <span className="material-symbols-outlined">download</span>
                  Export PNG
                </button>
              </div>
              <div className="fte-toolbarGroup fte-toolbarGroup--icons">
                <button type="button" onClick={() => zoomIn()} title="Zoom +">
                  <span className="material-symbols-outlined">zoom_in</span>
                </button>
                <button type="button" onClick={() => zoomOut()} title="Zoom -">
                  <span className="material-symbols-outlined">zoom_out</span>
                </button>
                <button type="button" onClick={() => resetTransform()} title="Reset view">
                  <span className="material-symbols-outlined">center_focus_strong</span>
                </button>
              </div>
            </div>

            {status ? <div className="fte-status">{status}</div> : null}

            <div className="fte-workspace">
              <div className="fte-viewport">
                {loading ? (
                  <div className="fte-loading">Đang tải cây gia phả...</div>
                ) : (
                  <TransformComponent wrapperClass="fte-transformWrapper" contentClass="fte-transformContent">
                    <div
                      id="family-tree"
                      ref={treeRef}
                      className="fte-canvas"
                      style={{ width: canvasSize.width, height: canvasSize.height }}
                    >
                      <div className="fte-canvasTitle">
                        <span>Gia phả</span>
                        <strong>{String(clan?.clan_name || "Dòng họ").toUpperCase()}</strong>
                      </div>
                      <svg className="fte-lines" width={canvasSize.width} height={canvasSize.height} aria-hidden="true">
                        {lines.map((line, index) => (
                          <path key={`${line.type}-${index}`} className={`fte-line is-${line.type}`} d={line.d} />
                        ))}
                      </svg>
                      {people.map((person) => (
                        <PersonCard
                          key={person.id}
                          person={person}
                          selected={selectedId === person.id}
                          dragging={draggingId === person.id}
                          onPointerDown={beginDrag}
                          onSelect={setSelectedId}
                        />
                      ))}
                    </div>
                  </TransformComponent>
                )}
              </div>
            </div>
          </>
        )}
      </TransformWrapper>

      <PersonInspector
        person={selectedPerson}
        spouse={selectedSpouse}
        saving={saving}
        onClose={() => setSelectedId(null)}
        onSave={handleSavePerson}
        onDelete={handleDeletePerson}
        onCreateRelation={openCreateDialog}
      />

      <RelationSelectDialog
        relation={relationDialog?.relation}
        selectedPerson={selectedPerson}
        people={people}
        families={canonicalTree.families}
        childRows={canonicalTree.childRows}
        value={relationDialog?.personId}
        saving={dialogSaving}
        onChange={(personId) => setRelationDialog((current) => (current ? { ...current, personId } : current))}
        onCancel={() => !dialogSaving && setRelationDialog(null)}
        onSubmit={submitRelationDialog}
        onUnlink={unlinkRelationDialog}
      />

      <CreatePersonDialog
        relation={dialog?.relation}
        form={dialog?.form}
        selectedPerson={selectedPerson}
        saving={dialogSaving}
        onChange={(form) => setDialog((current) => (current ? { ...current, form } : current))}
        onCancel={() => !dialogSaving && setDialog(null)}
        onSubmit={submitCreateDialog}
      />
    </section>
  );
}
