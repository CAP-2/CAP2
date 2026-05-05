import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { createPortal } from "react-dom";
import { toBlob } from "html-to-image";
import {
  createPersonAPI,
  deletePersonAPI,
  linkRelationsAPI,
  saveTreeLayoutAPI,
  updatePersonAPI,
  updatePersonPositionAPI,
} from "../../api/managerService";
import { formatLunarFullFromSolar } from "../../utils/lunarCalendar";
import DateInput from "../common/DateInput";
import { formatDateVN, isoToVietnamDate, vietnamDateToIso } from "../../utils/dateFormat";
import "./FamilyTreeEditor.css";

const CARD_WIDTH = 170;
const CARD_HEIGHT = 185;
const MIN_CARD_WIDTH = 130;
const MIN_CARD_HEIGHT = 145;
const MAX_CARD_WIDTH = 360;
const MAX_CARD_HEIGHT = 360;
const LEVEL_HEIGHT = Math.round(CARD_HEIGHT * 1.5);
const X_GAP = Math.round(CARD_WIDTH * 0.9);
const SPOUSE_GAP = 20; 
const SIBLING_GAP = X_GAP;
const FAMILY_GAP = Math.round(CARD_WIDTH * 1.2);
const Y_GAP = LEVEL_HEIGHT;
const CANVAS_PADDING = 180;
const SNAP_SIZE = 20;
const EXPORT_BACKGROUND = "#f8edb2";
const EXPORT_MAX_CANVAS_EDGE = 14000;
const SOURCE_BRANCH_STEP = 10;
const BLOOD_LINE_COLORS = [
  "#1E3A8A",
  "#047857",
  "#7C3AED",
  "#991B1B",
  "#BE185D",
  "#374151",
  "#78350F",
];
const TRANSPARENT_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const LINE_ROUTE_STORAGE_PREFIX = "family-tree-line-routes:";
const CARD_SIZE_STORAGE_PREFIX = "family-tree-card-sizes:";

const toInt = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const snap = (value) => Math.round(toInt(value, 0) / SNAP_SIZE) * SNAP_SIZE;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getLineRouteStorageKey(clanId) {
  return `${LINE_ROUTE_STORAGE_PREFIX}${clanId || "default"}`;
}

function getCardSizeStorageKey(clanId) {
  return `${CARD_SIZE_STORAGE_PREFIX}${clanId || "default"}`;
}

function normalizeLayoutObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeLayoutSettings(settings) {
  return {
    line_routes: normalizeLayoutObject(settings?.line_routes || settings?.lineRoutes),
    card_sizes: normalizeLayoutObject(settings?.card_sizes || settings?.cardSizes),
  };
}

function mergeManualAndAutoLayout(sourcePeople, families = [], childRows = []) {
  const normalized = asArray(sourcePeople).map(normalizePerson);
  if (!normalized.length) return [];

  const hasAnyManualPosition = hasManualLayout(normalized);
  if (!hasAnyManualPosition) {
    return autoLayoutPeople(normalized, families, childRows);
  }

  const autoPeopleById = new Map(autoLayoutPeople(normalized, families, childRows).map((person) => [Number(person.id), person]));
  const merged = normalized.map((person) => {
    const hasManualPosition = toInt(person.tree_x, 0) !== 0 || toInt(person.tree_y, 0) !== 0;
    if (hasManualPosition) return person;
    const autoPerson = autoPeopleById.get(Number(person.id));
    return autoPerson ? { ...person, tree_x: autoPerson.tree_x, tree_y: autoPerson.tree_y, display_order: autoPerson.display_order } : person;
  });

  return assignDisplayOrder(merged);
}

function normalizeCardSize(size) {
  const width = clamp(toInt(size?.width, CARD_WIDTH), MIN_CARD_WIDTH, MAX_CARD_WIDTH);
  const height = clamp(toInt(size?.height, CARD_HEIGHT), MIN_CARD_HEIGHT, MAX_CARD_HEIGHT);
  return { width, height };
}

function getCardSize(cardSizes, personId) {
  return normalizeCardSize(cardSizes?.[Number(personId)]);
}

function loadCardSizes(clanId) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(getCardSizeStorageKey(clanId));
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, normalizeCardSize(value)])
        .filter(([key]) => Number.isFinite(Number(key))),
    );
  } catch {
    return {};
  }
}

function saveCardSizes(clanId, sizes) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getCardSizeStorageKey(clanId), JSON.stringify(sizes || {}));
  } catch {
  }
}

function findFounderIds(people, families, childRows) {
  const peopleIds = new Set(asArray(people).map((person) => Number(person.id)));
  const childIds = new Set(asArray(childRows).map((row) => Number(row.person_id)).filter((id) => peopleIds.has(id)));
  const roots = asArray(people).filter((person) => !childIds.has(Number(person.id)));
  const candidates = roots.length ? roots : asArray(people);
  if (!candidates.length) return new Set();
  const minGeneration = Math.min(...candidates.map((person) => toInt(person.generation, 1)));
  return new Set(candidates.filter((person) => toInt(person.generation, 1) === minGeneration).map((person) => Number(person.id)));
}

function loadLineRoutes(clanId) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(getLineRouteStorageKey(clanId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLineRoutes(clanId, routes) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getLineRouteStorageKey(clanId), JSON.stringify(routes || {}));
  } catch {
  }
}

const asArray = (value) => (Array.isArray(value) ? value : []);

const dateInput = (value) => isoToVietnamDate(value);

const formatDisplayDate = (value) => formatDateVN(value);

const birthTime = (person) => {
  const text = vietnamDateToIso(person?.birth_date);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? time : null;
};

const fullName = (person, fallback = "Chưa có tên") =>
  person?.display_name ||
  [person?.surname, person?.middle_name, person?.first_name].filter(Boolean).join(" ").trim() ||
  fallback;

const normalizePerson = (person) => ({
  ...person,
  id: Number(person.id),
  account_id: person.account_id == null ? null : Number(person.account_id),
  role_id: person.role_id == null ? null : Number(person.role_id),
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
  const aBirth = birthTime(a);
  const bBirth = birthTime(b);
  if (aBirth != null && bBirth != null && aBirth !== bBirth) return aBirth - bBirth;
  const orderDiff = toInt(a?.display_order, 0) - toInt(b?.display_order, 0);
  if (orderDiff) return orderDiff;
  return toInt(a?.tree_x, 0) - toInt(b?.tree_x, 0) || Number(a?.id || 0) - Number(b?.id || 0);
}

function siblingSort(a, b) {
  const aBirth = birthTime(a?.person);
  const bBirth = birthTime(b?.person);
  if (aBirth != null && bBirth != null && aBirth !== bBirth) return aBirth - bBirth;

  const orderDiff = toInt(a?.sort_order, 0) - toInt(b?.sort_order, 0);
  if (orderDiff) return orderDiff;

  return personSort(a?.person || {}, b?.person || {});
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
    childrenByFamily.get(familyId).push({
      person_id: childId,
      sort_order: toInt(row.sort_order, 0),
    });
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
      .filter(Boolean);
    const children = asArray(childrenByFamily.get(familyId))
      .map((row) => ({
        ...row,
        person: peopleMap.get(Number(row.person_id)),
      }))
      .filter((row) => row.person)
      .sort(siblingSort)
      .map((row) => row.person);

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

  return normalizeGenerationSpacing(assignDisplayOrder(laidOut), familyRows);
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

function getSpouseAwareGenerationUnits(row, families = []) {
  const members = asArray(row).slice();
  const personById = new Map(members.map((person) => [Number(person.id), person]));
  const used = new Set();
  const units = [];

  asArray(families).forEach((family) => {
    const father = personById.get(Number(family.father_id));
    const mother = personById.get(Number(family.mother_id));
    if (!father || !mother) return;
    if (used.has(Number(father.id)) || used.has(Number(mother.id))) return;

    const fatherGeneration = toInt(father.generation, 1) || 1;
    const motherGeneration = toInt(mother.generation, 1) || 1;
    if (fatherGeneration !== motherGeneration) return;

    used.add(Number(father.id));
    used.add(Number(mother.id));
    units.push({
      members: [mother, father],
      x: Math.min(toInt(father.tree_x, 0), toInt(mother.tree_x, 0)),
      sortPerson: mother,
      isSpouseUnit: true,
    });
  });

  members.forEach((person) => {
    if (used.has(Number(person.id))) return;
    units.push({
      members: [person],
      x: toInt(person.tree_x, 0),
      sortPerson: person,
      isSpouseUnit: false,
    });
  });

  return units.sort((a, b) => a.x - b.x || personSort(a.sortPerson || {}, b.sortPerson || {}));
}

function getSpouseAwareGenerationRow(row, families = []) {
  return getSpouseAwareGenerationUnits(row, families).flatMap((unit) => unit.members);
}

function getGenerationUnitWidth(unit) {
  const members = asArray(unit?.members);
  if (!members.length) return 0;
  const innerGap = unit?.isSpouseUnit ? SPOUSE_GAP : X_GAP;
  return members.length * CARD_WIDTH + Math.max(0, members.length - 1) * innerGap;
}

function getGenerationUnitsWidth(units) {
  const safeUnits = asArray(units);
  if (!safeUnits.length) return CARD_WIDTH;
  return safeUnits.reduce((sum, unit) => sum + getGenerationUnitWidth(unit), 0) + Math.max(0, safeUnits.length - 1) * X_GAP;
}

function normalizeGenerationSpacing(people, families = []) {
  const grouped = new Map();
  asArray(people).forEach((person) => {
    const generation = toInt(person.generation, 1) || 1;
    if (!grouped.has(generation)) grouped.set(generation, []);
    grouped.get(generation).push(person);
  });

  const generations = [...grouped.keys()].sort((a, b) => a - b);
  const orderedUnits = new Map();

  generations.forEach((generation) => {
    const row = (grouped.get(generation) || [])
      .slice()
      .sort((a, b) => toInt(a.tree_x, 0) - toInt(b.tree_x, 0) || personSort(a, b));
    orderedUnits.set(generation, getSpouseAwareGenerationUnits(row, families));
  });

  const maxRowWidth = Math.max(
    CARD_WIDTH,
    ...generations.map((generation) => getGenerationUnitsWidth(orderedUnits.get(generation) || [])),
  );

  const positioned = [];
  generations.forEach((generation) => {
    const units = orderedUnits.get(generation) || [];
    const rowWidth = getGenerationUnitsWidth(units);
    let cursorX = CANVAS_PADDING + Math.max(0, (maxRowWidth - rowWidth) / 2);
    let displayOrder = 0;

    units.forEach((unit) => {
      const innerGap = unit.isSpouseUnit ? SPOUSE_GAP : X_GAP;
      unit.members.forEach((person, memberIndex) => {
        positioned.push({
          ...person,
          tree_x: snap(cursorX + memberIndex * (CARD_WIDTH + innerGap)),
          tree_y: generationY(generation),
          display_order: displayOrder,
        });
        displayOrder += 1;
      });
      cursorX += getGenerationUnitWidth(unit) + X_GAP;
    });
  });

  return positioned.sort((a, b) => toInt(a.generation, 1) - toInt(b.generation, 1) || personSort(a, b));
}

function centerOf(person, cardSizes = {}) {
  const size = getCardSize(cardSizes, person?.id);
  return {
    x: toInt(person.tree_x, 0) + size.width / 2,
    y: toInt(person.tree_y, 0) + size.height / 2,
  };
}

function bottomOf(person, cardSizes = {}) {
  const size = getCardSize(cardSizes, person?.id);
  return toInt(person.tree_y, 0) + size.height;
}

function rightOf(person, cardSizes = {}) {
  const size = getCardSize(cardSizes, person?.id);
  return toInt(person.tree_x, 0) + size.width;
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

function buildTreeLines(people, families, childRows, lineRoutes = {}, cardSizes = {}) {
  const peopleMap = new Map(people.map((person) => [Number(person.id), person]));
  const childrenByFamily = new Map();

  asArray(childRows).forEach((row) => {
    const familyId = Number(row.family_id);
    const childId = Number(row.person_id);
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push({
      person_id: childId,
      sort_order: toInt(row.sort_order, 0),
    });
  });

  const lines = [];
  const branchFamilyKeys = new Map();
  const familyRows = asArray(families);

  familyRows.forEach((family) => {
    const familyId = Number(family.id);
    const parents = [peopleMap.get(Number(family.father_id)), peopleMap.get(Number(family.mother_id))].filter(Boolean);
    const children = asArray(childrenByFamily.get(familyId)).filter((row) => peopleMap.has(Number(row.person_id)));
    if (!parents.length || !children.length) return;

    const lineParent = peopleMap.get(Number(family.father_id)) || parents[0];
    const parentGeneration = toInt(lineParent?.generation, 1);
    const groupKey = `${parentGeneration}:${familyId}`;
    const parentX = Math.min(...parents.map((parent) => toInt(parent.tree_x, 0)));

    if (!branchFamilyKeys.has(groupKey)) {
      branchFamilyKeys.set(groupKey, {
        generation: parentGeneration,
        minX: parentX,
      });
      return;
    }

    const current = branchFamilyKeys.get(groupKey);
    current.minX = Math.min(current.minX, parentX);
  });

  const branchTierByFamily = new Map();
  const colorIndexByFamily = new Map();
  const familyGroupsByGeneration = new Map();
  branchFamilyKeys.forEach((value, key) => {
    if (!familyGroupsByGeneration.has(value.generation)) familyGroupsByGeneration.set(value.generation, []);
    familyGroupsByGeneration.get(value.generation).push({ key, ...value });
  });
  familyGroupsByGeneration.forEach((groups) => {
    groups
      .slice()
      .sort((a, b) => a.minX - b.minX || String(a.key).localeCompare(String(b.key)))
      .forEach((group, index) => {
        branchTierByFamily.set(group.key, index);
        colorIndexByFamily.set(group.key, index);
      });
  });

  familyRows.forEach((family) => {
    const familyId = Number(family.id);
    if (!Number.isFinite(familyId)) return;

    const father = peopleMap.get(Number(family.father_id));
    const mother = peopleMap.get(Number(family.mother_id));
    const parents = [father, mother].filter(Boolean);
    const children = asArray(childrenByFamily.get(Number(family.id)))
      .map((row) => ({
        ...row,
        person: peopleMap.get(Number(row.person_id)),
      }))
      .filter((row) => row.person)
      .sort(siblingSort)
      .map((row) => row.person)
      .sort((a, b) => a.tree_x - b.tree_x || personSort(a, b));

    let coupleJoinPoint = null;

    if (father && mother) {
      const left = toInt(father.tree_x, 0) <= toInt(mother.tree_x, 0) ? father : mother;
      const right = left === father ? mother : father;
      const leftEdge = rightOf(left, cardSizes);
      const rightEdge = toInt(right.tree_x, 0);
      const y = Math.round((centerOf(father, cardSizes).y + centerOf(mother, cardSizes).y) / 2);
      const startX = rightEdge > leftEdge ? leftEdge : Math.round(centerOf(left, cardSizes).x);
      const endX = rightEdge > leftEdge ? rightEdge : Math.round(centerOf(right, cardSizes).x);
      coupleJoinPoint = {
        x: Math.round((startX + endX) / 2),
        y,
      };
      const savedSpouseY = Number(lineRoutes?.[familyId]?.spouseY);
      const spouseMinY = Math.min(toInt(father.tree_y, 0), toInt(mother.tree_y, 0)) + 24;
      const spouseMaxY = Math.max(bottomOf(father, cardSizes), bottomOf(mother, cardSizes)) - 24;
      const spouseY = snap(clamp(Number.isFinite(savedSpouseY) ? savedSpouseY : y, spouseMinY, spouseMaxY));
      coupleJoinPoint.y = spouseY;

      lines.push({
        id: `family-${familyId}-spouse`,
        familyId,
        routeKey: "spouseY",
        type: "spouse",
        dragAxis: "y",
        minY: spouseMinY,
        maxY: spouseMaxY,
        d: `M ${startX} ${spouseY} H ${endX}`,
      });
    }

    if (!parents.length || !children.length) return;

    const lineParent = father || parents[0];
    const parentX = coupleJoinPoint ? coupleJoinPoint.x : Math.round(centerOf(lineParent, cardSizes).x);
    const parentBottomY = coupleJoinPoint ? coupleJoinPoint.y : bottomOf(lineParent, cardSizes);
    const childCenters = children.map((child) => ({
      x: centerOf(child, cardSizes).x,
      y: toInt(child.tree_y, 0),
    }));
    const busMinX = Math.min(parentX, ...childCenters.map((item) => item.x));
    const busMaxX = Math.max(parentX, ...childCenters.map((item) => item.x));
    const firstChildY = Math.min(...childCenters.map((item) => item.y));
    const familyKey = `${toInt(lineParent.generation, 1)}:${Number(family.id)}`;
    const sourceTier = branchTierByFamily.get(familyKey) || 0;
    const minBranchY = parentBottomY + 38;
    const maxBranchY = Math.max(minBranchY, firstChildY - 32);
    const naturalBaseY = Math.round(Math.min(Math.max(minBranchY, firstChildY - 72) + sourceTier * SOURCE_BRANCH_STEP, maxBranchY));
    const savedBaseY = Number(lineRoutes?.[familyId]?.baseY);
    const baseY = snap(clamp(Number.isFinite(savedBaseY) ? savedBaseY : naturalBaseY, minBranchY, maxBranchY));
    const colorIndex = colorIndexByFamily.get(familyKey) || 0;
    const color = BLOOD_LINE_COLORS[colorIndex % BLOOD_LINE_COLORS.length];
    const lineId = `family-${familyId}`;

    const bloodDragMeta = { familyId, routeKey: "baseY", dragAxis: "y", minY: minBranchY, maxY: maxBranchY };
    lines.push({ id: `${lineId}-parent`, ...bloodDragMeta, type: "blood", color, d: `M ${parentX} ${parentBottomY} V ${baseY}` });
    lines.push({ id: `${lineId}-bus`, ...bloodDragMeta, type: "blood", color, d: `M ${busMinX} ${baseY} H ${busMaxX}` });
    childCenters.forEach((child) => {
      lines.push({ id: `${lineId}-child-${child.x}`, ...bloodDragMeta, type: "blood", color, d: `M ${child.x} ${baseY} V ${child.y}` });
    });

    lines.push({
      id: `${lineId}-control`,
      familyId,
      routeKey: "baseY",
      dragAxis: "y",
      type: "route-control",
      color,
      x: (busMinX + busMaxX) / 2,
      y: baseY,
      minY: minBranchY,
      maxY: maxBranchY,
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

  account_email: "",
  account_password: "",
};
}

function LunarDateHint({ value, label = "Âm lịch" }) {
  const text = formatLunarFullFromSolar(value);
  if (!text) return null;
  return <small className="fte-lunarHint">{label}: {text}</small>;
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
    role_id: person?.role_id == null ? "" : String(person.role_id),
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

function extractCreatedPersonId(response) {
  const candidates = [
    response?.id,
    response?.person_id,
    response?.person?.id,
    response?.data?.id,
    response?.data?.person_id,
    response?.data?.person?.id,
    response?.result?.id,
    response?.result?.person_id,
    response?.result?.person?.id,
  ];

  for (const value of candidates) {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) return id;
  }

  return null;
}

function PersonCard({
  person,
  selected,
  dragging,
  canDrag = true,
  canEdit = false,
  canEditRole = false,
  canDelete = false,
  founder = false,
  size = { width: CARD_WIDTH, height: CARD_HEIGHT },
  onPointerDown,
  onResizePointerDown,
  onEdit,
  onDelete,
  onQuickCreate,
}) {
  const name = fullName(person, `Người #${person.id}`);
  const genderClass =
    Number(person.gender) === 1
      ? "is-male"
      : Number(person.gender) === 2
      ? "is-female"
      : "is-unknown";

  const birthText = formatDisplayDate(person.birth_date);
  const deathText = formatDisplayDate(person.death_date);
  const deceased = Number(person.is_living) === 0;
  const isClanChief = Number(person.role_id) === 2;

  const lifeParts = [];
  if (birthText) lifeParts.push(`Sinh: ${birthText}`);
  if (deceased && deathText) lifeParts.push(`Mất: ${deathText}`);
  const lifeText = lifeParts.join(" - ");

  const stopActionPointer = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className={`fte-personCard ${genderClass} ${founder ? "is-founder" : ""} ${
        deceased ? "is-deceased" : ""
      } ${selected ? "is-selected" : ""} ${dragging ? "is-dragging" : ""}`}
      style={{ left: person.tree_x, top: person.tree_y, width: size.width, height: size.height }}
      role="group"
      tabIndex={0}
      title={name}
      onPointerDown={(event) => onPointerDown(event, person)}
      data-static={!canDrag}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(person);
        }
      }}
    >
      {canEdit || canDelete ? (
        <div className="fte-cardHoverActions" aria-label="Thao tác thành viên">
          {canEdit ? (
            <button
              type="button"
              className="is-create"
              title="Thêm người liên kết với thành viên này"
              onPointerDown={stopActionPointer}
              onClick={(event) => {
                event.stopPropagation();
                onQuickCreate?.(person);
              }}
            >
              <span className="material-symbols-outlined">add</span>
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              title="Sửa thành viên"
              onPointerDown={stopActionPointer}
              onClick={(event) => {
                event.stopPropagation();
                onEdit(person);
              }}
            >
              <span className="material-symbols-outlined">edit</span>
            </button>
          ) : null}

          {canDelete ? (
            <button
              type="button"
              className="is-danger"
              title="Xóa thành viên"
              onPointerDown={stopActionPointer}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(person);
              }}
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {isClanChief ? <div className="fte-chiefBadge">Tộc trưởng</div> : null}

      <div className={`fte-ancestorIcon ${person.avatar_url ? "has-photo" : ""}`} aria-hidden="true">
        {person.avatar_url ? (
          <img className="fte-mainPhoto" src={person.avatar_url} alt={name} draggable="false" />
        ) : (
          <span className="material-symbols-outlined">person</span>
        )}
      </div>

      <div className="fte-cardName">{String(name).toUpperCase()}</div>
      <div className="fte-cardGeneration">ĐỜI {person.generation || "?"}</div>
      {lifeText ? <div className="fte-cardMeta">{lifeText}</div> : null}

      {canDrag ? (
        <span
          className="fte-resizeHandle"
          title="Kéo để đổi kích thước ô"
          onPointerDown={(event) => onResizePointerDown?.(event, person)}
        />
      ) : null}
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
  canEdit = false,
  canEditRole = false,
  canEditRelations = false,
  canDelete = false,
  notice = "",
}) {
  const [form, setForm] = useState(() => personToForm(person));

  useEffect(() => {
    setForm(personToForm(person));
  }, [person?.id]);

  if (!person) {
    return null;
  }

  const setField = (field, value) =>
    setForm((current) => {
      if (field === "is_living" && value === "1") {
        return { ...current, is_living: value, death_date: "" };
      }
      return { ...current, [field]: value };
    });

  const handleFullNameChange = (e) => {
    const fullNameValue = e.target.value;
    const parts = fullNameValue.trim().split(/\s+/);

    let surname = "";
    let middle_name = "";
    let first_name = "";

    if (parts.length === 1 && parts[0] !== "") {
      first_name = parts[0];
    } else if (parts.length === 2) {
      surname = parts[0];
      first_name = parts[1];
    } else if (parts.length >= 3) {
      surname = parts[0];
      first_name = parts[parts.length - 1];
      middle_name = parts.slice(1, parts.length - 1).join(" ");
    }

    setForm((current) => ({
      ...current,
      display_name: fullNameValue,
      surname,
      middle_name,
      first_name,
    }));
  };

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

        {canEditRelations ? (
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
        ) : null}

        {notice ? <div className="fte-readOnlyNote">{notice}</div> : null}

        <div className="fte-formGrid">
          <label>
            Tên hiển thị
            <input value={form.display_name} onChange={handleFullNameChange} disabled={!canEdit} />
          </label>

          <label>
            Họ
            <input value={form.surname} onChange={(event) => setField("surname", event.target.value)} disabled={!canEdit} />
          </label>

          <label>
            Tên đệm
            <input value={form.middle_name} onChange={(event) => setField("middle_name", event.target.value)} disabled={!canEdit} />
          </label>

          <label>
            Tên
            <input value={form.first_name} onChange={(event) => setField("first_name", event.target.value)} disabled={!canEdit} />
          </label>

          <label>
            Giới tính
            <select value={form.gender} onChange={(event) => setField("gender", event.target.value)} disabled={!canEdit}>
              <option value="">Không rõ</option>
              <option value="1">Nam</option>
              <option value="2">Nữ</option>
            </select>
          </label>

          <label>
            Vai trò
            <select
              value={form.role_id}
              onChange={(event) => setField("role_id", event.target.value)}
              disabled={!canEditRole || !person.account_id}
            >
              <option value="">Chưa có tài khoản</option>
              <option value="2">Tộc trưởng</option>
              <option value="3">Thành viên</option>
            </select>
          </label>

          <label>
            Tình trạng
            <select value={form.is_living} onChange={(event) => setField("is_living", event.target.value)} disabled={!canEdit}>
              <option value="1">Còn sống</option>
              <option value="0">Đã mất</option>
            </select>
          </label>

          <label>
            Ngày sinh
            <DateInput
              value={form.birth_date}
              onChange={(event) => setField("birth_date", event.target.value)}
              disabled={!canEdit}
            />
            <LunarDateHint value={form.birth_date} label="Ngày sinh âm lịch" />
          </label>

          <label>
            Ngày mất
            <DateInput
              value={form.death_date}
              onChange={(event) => setField("death_date", event.target.value)}
              disabled={!canEdit || form.is_living === "1"}
            />
            <LunarDateHint value={form.death_date} label="Ngày mất âm lịch" />
          </label>

          <label>
            Đời thứ
            <input
              type="number"
              min="1"
              value={form.generation}
              onChange={(event) => setField("generation", event.target.value)}
              disabled={!canEdit}
            />
          </label>

          <label>
            Chi nhánh
            <input value={form.branch} onChange={(event) => setField("branch", event.target.value)} disabled={!canEdit} />
          </label>

          <label className="is-wide">
            Quê quán
            <input value={form.hometown} onChange={(event) => setField("hometown", event.target.value)} disabled={!canEdit} />
          </label>

          <label className="is-wide">
            Địa chỉ
            <input value={form.address} onChange={(event) => setField("address", event.target.value)} disabled={!canEdit} />
          </label>

          <label>
            Điện thoại
            <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} disabled={!canEdit} />
          </label>

          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} disabled={!canEdit} />
          </label>

          <label className="is-wide">
            Ảnh đại diện URL
            <input value={form.avatar_url} onChange={(event) => setField("avatar_url", event.target.value)} disabled={!canEdit} />
          </label>

          <label className="is-wide">
            Giới thiệu
            <textarea rows={3} value={form.bio} onChange={(event) => setField("bio", event.target.value)} disabled={!canEdit} />
          </label>

          <label className="is-wide">
            Ghi chú
            <textarea rows={2} value={form.note} onChange={(event) => setField("note", event.target.value)} disabled={!canEdit} />
          </label>
        </div>

        {canEdit ? (
          <div className="fte-inspectorFooter">
            <button type="button" className="fte-primaryButton" disabled={saving} onClick={() => onSave(form)}>
              <span className="material-symbols-outlined">save</span>
              {saving ? "Đang lưu..." : "Lưu"}
            </button>

            {canDelete ? (
              <button type="button" className="fte-dangerButton" disabled={saving} onClick={onDelete}>
                <span className="material-symbols-outlined">delete</span>
                Xóa
              </button>
            ) : null}
          </div>
        ) : null}
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
  onPickOnTree,
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
          <button type="button" className="fte-pickOnTreeButton" disabled={saving} onClick={onPickOnTree}>
            <span className="material-symbols-outlined">account_tree</span>
            Chọn trực tiếp trên cây phả hệ
          </button>
          <div className="fte-relationDivider"><span>hoặc</span></div>
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

function QuickCreateRelationDialog({
  sourcePerson,
  onChoose,
  onCancel,
}) {
  if (!sourcePerson) return null;

  return (
    <div className="fte-modalOverlay" role="presentation" onMouseDown={onCancel}>
      <div
        className="fte-modal fte-quickCreateModal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="fte-modalHeader">
          <div>
            <span>{fullName(sourcePerson)}</span>
            <h3>Chọn loại liên kết cần tạo</h3>
          </div>
          <button type="button" className="fte-iconButton" onClick={onCancel} title="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="fte-quickCreateChoices">
          <button
            type="button"
            className="fte-quickCreateChoice"
            onClick={() => onChoose("spouse")}
          >
            <span className="material-symbols-outlined">favorite</span>
            <strong>Tạo vợ/chồng</strong>
            <small>Tạo thành viên mới và liên kết vợ/chồng với người này</small>
          </button>

          <button
            type="button"
            className="fte-quickCreateChoice"
            onClick={() => onChoose("child")}
          >
            <span className="material-symbols-outlined">person_add</span>
            <strong>Tạo con</strong>
            <small>Tạo thành viên mới và tự nối làm con của người này</small>
          </button>
        </div>

        <div className="fte-modalFooter">
          <button type="button" className="fte-ghostButton" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
function CreatePersonDialog({ relation, form, selectedPerson, onChange, onCancel, onSubmit, saving }) {
  if (!relation || !form) return null;

  const titleMap = {
    person: "Thêm người",
    spouse: "Thêm vợ/chồng",
    child: "Thêm con",
    father: "Thêm cha",
    mother: "Thêm mẹ",
  };

  const relationTextMap = {
    spouse: "vợ/chồng",
    child: "con",
    father: "cha",
    mother: "mẹ",
  };

  const dialogTitle =
    relation !== "person" && selectedPerson
      ? `${titleMap[relation] || "Thêm người"} cho ${fullName(selectedPerson)}`
      : titleMap[relation] || "Thêm người";

  const setField = (field, value) => {
    if (field === "is_living" && value === "1") {
      onChange({
        ...form,
        is_living: value,
        death_date: "",
      });
      return;
    }

    if (field === "is_living" && value === "0") {
      onChange({
        ...form,
        is_living: value,
        account_email: "",
        account_password: "",
      });
      return;
    }

    onChange({
      ...form,
      [field]: value,
    });
  };

  const handleFullNameChange = (event) => {
    const fullNameValue = event.target.value;
    const parts = fullNameValue.trim().split(/\s+/);

    let surname = "";
    let middle_name = "";
    let first_name = "";

    if (parts.length === 1 && parts[0] !== "") {
      first_name = parts[0];
    } else if (parts.length === 2) {
      surname = parts[0];
      first_name = parts[1];
    } else if (parts.length >= 3) {
      surname = parts[0];
      first_name = parts[parts.length - 1];
      middle_name = parts.slice(1, parts.length - 1).join(" ");
    }

    onChange({
      ...form,
      display_name: fullNameValue,
      surname,
      middle_name,
      first_name,
    });
  };

  return (
    <div className="fte-modalOverlay" role="presentation" onMouseDown={onCancel}>
      <div className="fte-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="fte-modalHeader">
          <div>
            <span>
              {relation !== "person" && selectedPerson
                ? `Tạo ${relationTextMap[relation] || "quan hệ"} mới`
                : "Gia phả"}
            </span>
            <h3>{dialogTitle}</h3>
          </div>

          <button type="button" className="fte-iconButton" onClick={onCancel} title="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="fte-formGrid fte-formGrid--modal">
          <label className="is-wide">
            Tên hiển thị
            <input
              autoFocus
              value={form.display_name || ""}
              onChange={handleFullNameChange}
              placeholder="Ví dụ: Hà Văn Hải Đăng"
            />
          </label>

          <label>
            Họ
            <input
              value={form.surname || ""}
              onChange={(event) => setField("surname", event.target.value)}
            />
          </label>

          <label>
            Tên đệm
            <input
              value={form.middle_name || ""}
              onChange={(event) => setField("middle_name", event.target.value)}
            />
          </label>

          <label>
            Tên
            <input
              value={form.first_name || ""}
              onChange={(event) => setField("first_name", event.target.value)}
            />
          </label>

          <label>
            Giới tính
            <select value={form.gender || ""} onChange={(event) => setField("gender", event.target.value)}>
              <option value="1">Nam</option>
              <option value="2">Nữ</option>
              <option value="">Không rõ</option>
            </select>
          </label>

          <label>
            Đời thứ
            <input
              type="number"
              min="1"
              value={form.generation || "1"}
              onChange={(event) => setField("generation", event.target.value)}
            />
          </label>

          <label>
            Tình trạng
            <select value={form.is_living || "1"} onChange={(event) => setField("is_living", event.target.value)}>
              <option value="1">Còn sống</option>
              <option value="0">Đã mất</option>
            </select>
          </label>

          {form.is_living === "1" ? (
            <div className="fte-accountCreateBox is-wide">
              <div className="fte-accountCreateTitle">
                <span className="material-symbols-outlined">manage_accounts</span>
                Tạo tài khoản đăng nhập cho người này
              </div>

              <label>
                Email đăng nhập
                <input
                  type="email"
                  value={form.account_email || ""}
                  onChange={(event) => setField("account_email", event.target.value)}
                  placeholder="example@gmail.com"
                  autoComplete="new-email"
                />
              </label>

              <label>
                Mật khẩu đăng nhập
                <input
                  type="password"
                  value={form.account_password || ""}
                  onChange={(event) => setField("account_password", event.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                />
              </label>
            </div>
          ) : null}

          <label>
            Ngày sinh
            <DateInput
              value={form.birth_date || ""}
              onChange={(event) => setField("birth_date", event.target.value)}
            />
            <LunarDateHint value={form.birth_date} label="Ngày sinh âm lịch" />
          </label>

          <label>
            Ngày mất
            <DateInput
              value={form.death_date || ""}
              onChange={(event) => setField("death_date", event.target.value)}
              disabled={form.is_living === "1"}
            />
            <LunarDateHint value={form.death_date} label="Ngày mất âm lịch" />
          </label>

          <label className="is-wide">
            Quê quán
            <input
              value={form.hometown || ""}
              onChange={(event) => setField("hometown", event.target.value)}
            />
          </label>

          <label className="is-wide">
            Ảnh đại diện URL
            <input
              value={form.avatar_url || ""}
              onChange={(event) => setField("avatar_url", event.target.value)}
            />
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
  layoutSettings,
  permission,
  readOnly = false,
}) {
  const treeRef = useRef(null);
  const scaleRef = useRef(0.85);
  const [currentScale, setCurrentScale] = useState(0.85);
  const lastDragRef = useRef(null);
  const lineDragRef = useRef(null);
  const [people, setPeople] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [draggingLineId, setDraggingLineId] = useState(null);
  const [lineRoutes, setLineRoutes] = useState(() => ({ ...loadLineRoutes(clan?.id), ...normalizeLayoutSettings(layoutSettings).line_routes }));
  const [cardSizes, setCardSizes] = useState(() => ({ ...loadCardSizes(clan?.id), ...normalizeLayoutSettings(layoutSettings).card_sizes }));
  const [status, setStatus] = useState("");
  const [billingWarning, setBillingWarning] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [relationDialog, setRelationDialog] = useState(null);
  const [quickCreateDialog, setQuickCreateDialog] = useState(null);
  const [treeRelationPicker, setTreeRelationPicker] = useState(null);
  const [dialogSaving, setDialogSaving] = useState(false);

  useEffect(() => {
    const normalizedSettings = normalizeLayoutSettings(layoutSettings);
    setLineRoutes({ ...loadLineRoutes(clan?.id), ...normalizedSettings.line_routes });
    setCardSizes({ ...loadCardSizes(clan?.id), ...normalizedSettings.card_sizes });
  }, [clan?.id, layoutSettings]);
  const resolvedPermission = useMemo(() => {
    if (permission) {
      return {
        canEdit: permission.canEdit === true,
        editScope: permission.editScope || "none",
        allowedNodeIds: asArray(permission.allowedNodeIds).map((id) => Number(id)).filter((id) => Number.isFinite(id)),
      };
    }
    if (readOnly) {
      return { canEdit: false, editScope: "none", allowedNodeIds: [] };
    }
    return { canEdit: true, editScope: "all", allowedNodeIds: [] };
  }, [permission, readOnly]);
  const canEditAll = resolvedPermission.canEdit && resolvedPermission.editScope === "all";
  const canEditLimited = resolvedPermission.canEdit && resolvedPermission.editScope === "limited";
  const allowedNodeSet = useMemo(() => new Set(resolvedPermission.allowedNodeIds.map((id) => Number(id))), [resolvedPermission.allowedNodeIds]);

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
    const nextPeople = mergeManualAndAutoLayout(canonicalTree.people, canonicalTree.families, canonicalTree.childRows);
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
  const dialogSourcePerson = useMemo(
  () =>
    people.find((person) => Number(person.id) === Number(dialog?.sourcePersonId)) ||
    selectedPerson ||
    null,
  [people, dialog?.sourcePersonId, selectedPerson]
);

const dialogSourceSpouse = useMemo(
  () => findSpouse(dialogSourcePerson, canonicalTree.families, people),
  [dialogSourcePerson, canonicalTree.families, people]
);

const quickCreateSourcePerson = useMemo(
  () =>
    people.find((person) => Number(person.id) === Number(quickCreateDialog?.sourcePersonId)) ||
    null,
  [people, quickCreateDialog?.sourcePersonId]
);
  const treeRelationSource = useMemo(
    () => people.find((person) => Number(person.id) === Number(treeRelationPicker?.sourcePersonId)) || null,
    [people, treeRelationPicker?.sourcePersonId],
  );
  const canEditPerson = useCallback(
    (personId) => canEditAll || (canEditLimited && allowedNodeSet.has(Number(personId))),
    [allowedNodeSet, canEditAll, canEditLimited],
  );
  const lines = useMemo(
    () => buildTreeLines(people, canonicalTree.families, canonicalTree.childRows, lineRoutes, cardSizes),
    [people, canonicalTree.families, canonicalTree.childRows, lineRoutes, cardSizes],
  );

  const persistFullLayout = useCallback(async (nextPeople = people, nextLineRoutes = lineRoutes, nextCardSizes = cardSizes) => {
    if (!canEditAll) return false;
    try {
      await saveTreeLayoutAPI(nextPeople, clan?.id, {
        lineRoutes: nextLineRoutes,
        cardSizes: nextCardSizes,
      });
      saveLineRoutes(clan?.id, nextLineRoutes);
      saveCardSizes(clan?.id, nextCardSizes);
      return true;
    } catch (error) {
      setStatus(error?.message || "Không thể lưu bố cục cây vào database.");
      return false;
    }
  }, [canEditAll, cardSizes, clan?.id, lineRoutes, people]);

  const applyAutoLayoutAndSave = useCallback(async () => {
    if (!canEditAll) return;
    const ok = window.confirm("Tự động sắp xếp lại sẽ ghi đè vị trí thủ công hiện tại. Bạn có chắc muốn tiếp tục?");
    if (!ok) return;
    setSaving(true);
    setStatus("");
    const nextPeople = autoLayoutPeople(canonicalTree.people, canonicalTree.families, canonicalTree.childRows);
    try {
      setPeople(nextPeople);
      const saved = await persistFullLayout(nextPeople, lineRoutes, cardSizes);
      setStatus(saved ? "Đã tự động sắp xếp và lưu bố cục mới vào database." : "Không thể lưu bố cục mới.");
      await onReload?.();
    } finally {
      setSaving(false);
    }
  }, [canEditAll, canonicalTree, persistFullLayout, lineRoutes, cardSizes, onReload]);

  const canvasSize = useMemo(() => {
    const maxX = Math.max(2400, ...people.map((person) => toInt(person.tree_x, 0) + getCardSize(cardSizes, person.id).width + CANVAS_PADDING));
    const maxY = Math.max(1400, ...people.map((person) => toInt(person.tree_y, 0) + getCardSize(cardSizes, person.id).height + CANVAS_PADDING));
    return { width: maxX, height: maxY };
  }, [people, cardSizes]);

  const beginDrag = useCallback((event, person) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
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
          const nextPeople = people.map((item) => (Number(item.id) === Number(person.id) ? { ...item, ...finalPosition } : item));
          if (canEditAll) {
            await persistFullLayout(nextPeople, lineRoutes, cardSizes);
            setStatus("Đã lưu vị trí và bố cục cây vào database.");
          } else {
            await updatePersonPositionAPI(person.id, finalPosition);
            setStatus("Đã lưu vị trí.");
          }
        } catch (error) {
          setStatus(error?.message || "Không thể lưu vị trí.");
        }
      }
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
  }, [canEditAll, cardSizes, lineRoutes, people, persistFullLayout]);

  const openPersonEditor = useCallback((person) => {
    if (!person) return;
    setSelectedId(person.id);
  }, []);

  const handleDeletePersonByCard = useCallback(async (person) => {
    if (!person || !canEditAll) {
      setStatus("Bạn không có quyền xóa node trong chế độ hiện tại.");
      return;
    }
    const ok = window.confirm(`Xóa ${fullName(person)} khỏi cây gia phả?`);
    if (!ok) return;
    setSaving(true);
    setStatus("");
    try {
      await deletePersonAPI(person.id);
      setPeople((current) => current.filter((item) => item.id !== person.id));
      setSelectedId((current) => (Number(current) === Number(person.id) ? null : current));
      setStatus("Đã xóa thành viên khỏi cây.");
      await onReload?.();
    } catch (error) {
      setStatus(error?.message || "Không thể xóa thành viên.");
    } finally {
      setSaving(false);
    }
  }, [canEditAll, onReload]);

  const linkRelationTarget = useCallback(async (relation, sourcePerson, targetId) => {
    if (!canEditAll || !sourcePerson || !targetId) return false;
    const sourceId = Number(sourcePerson.id);
    const nextTargetId = Number(targetId);
    if (!Number.isFinite(sourceId) || !Number.isFinite(nextTargetId) || sourceId === nextTargetId) {
      setStatus("Không thể liên kết thành viên này.");
      return false;
    }

    setDialogSaving(true);
    setStatus("");
    try {
      if (relation === "spouse") {
        await linkRelationsAPI({ person_id: sourceId, spouse_person_id: nextTargetId });
      }

      if (relation === "child") {
        const family = findFamilyForParent(sourceId, canonicalTree.families);
        const existingChildren = family
          ? asArray(canonicalTree.childRows)
              .filter((row) => Number(row.family_id) === Number(family.id))
              .map((row) => Number(row.person_id))
          : [];
        const childrenIds = Array.from(new Set([...existingChildren, nextTargetId])).filter(
          (id) => Number(id) !== sourceId,
        );
        await linkRelationsAPI({
          person_id: sourceId,
          children_person_ids: childrenIds,
        });
      }

      if (relation === "father" || relation === "mother") {
        const currentParents = findParentFamilyForChild(sourceId, canonicalTree.families, canonicalTree.childRows);
        await linkRelationsAPI({
          person_id: sourceId,
          father_person_id: relation === "father" ? nextTargetId : currentParents?.father_id || null,
          mother_person_id: relation === "mother" ? nextTargetId : currentParents?.mother_id || null,
        });
      }

      setRelationDialog(null);
      setTreeRelationPicker(null);
      setStatus(`Đã liên kết ${relationLabels[relation] || "quan hệ"}.`);
      await onReload?.();
      return true;
    } catch (error) {
      setStatus(error?.message || "Không thể liên kết quan hệ.");
      return false;
    } finally {
      setDialogSaving(false);
    }
  }, [canEditAll, canonicalTree.families, canonicalTree.childRows, onReload]);

  const submitTreeRelationPick = useCallback((targetPerson) => {
    if (!treeRelationPicker || !targetPerson) return;
    const relation = treeRelationPicker.relation;
    const sourcePerson = people.find((item) => Number(item.id) === Number(treeRelationPicker.sourcePersonId));
    if (!sourcePerson) {
      setTreeRelationPicker(null);
      setStatus("Không tìm thấy thành viên gốc để liên kết.");
      return;
    }
    const linkedIds = relationLinkedIds(relation, sourcePerson, canonicalTree.families, canonicalTree.childRows);
    if (linkedIds.has(Number(targetPerson.id))) {
      setStatus("Thành viên này đã được liên kết với quan hệ đang chọn.");
      return;
    }
    const candidates = relationCandidates(relation, sourcePerson, people, linkedIds);
    const allowed = candidates.some((item) => Number(item.id) === Number(targetPerson.id));
    if (!allowed) {
      setStatus("Thành viên này không phù hợp hoặc đã được liên kết. Hãy chọn thành viên khác trên cây.");
      return;
    }
    linkRelationTarget(relation, sourcePerson, targetPerson.id);
  }, [canonicalTree.families, canonicalTree.childRows, linkRelationTarget, people, treeRelationPicker]);

  const handleCardPointerDown = useCallback(
    (event, person) => {
      if (treeRelationPicker) {
        event.preventDefault();
        event.stopPropagation();
        submitTreeRelationPick(person);
        return;
      }
      if (!canEditPerson(person.id)) {
        event.preventDefault();
        event.stopPropagation();
        setSelectedId(person.id);
        if (resolvedPermission.editScope === "limited") {
          setStatus("Bạn chỉ được chỉnh sửa node thuộc đời hiện tại, trên 1 đời và dưới 1 đời.");
        }
        return;
      }
      beginDrag(event, person);
    },
    [beginDrag, canEditPerson, resolvedPermission.editScope, submitTreeRelationPick, treeRelationPicker],
  );

  const beginLineDrag = useCallback((event, controlLine) => {
    if (!canEditAll || (event.button != null && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();

    const familyId = Number(controlLine.familyId);
    if (!Number.isFinite(familyId)) return;

    const routeKey = controlLine.routeKey || "baseY";
    const startY = event.clientY;
    const originY = Number(controlLine.y ?? lineRoutes?.[familyId]?.[routeKey]);
    const minY = Number(controlLine.minY);
    const maxY = Number(controlLine.maxY);
    setDraggingLineId(`${familyId}:${routeKey}`);
    lineDragRef.current = { familyId, routeKey, value: originY };

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      const scale = scaleRef.current || 1;
      const nextValue = snap(clamp(originY + (moveEvent.clientY - startY) / scale, minY, maxY));
      lineDragRef.current = { familyId, routeKey, value: nextValue };
      setLineRoutes((current) => ({
        ...current,
        [familyId]: { ...(current?.[familyId] || {}), [routeKey]: nextValue },
      }));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setDraggingLineId(null);
      const finalRoute = lineDragRef.current;
      lineDragRef.current = null;
      setLineRoutes((current) => {
        const next = {
          ...current,
          [familyId]: { ...(current?.[familyId] || {}), [routeKey]: finalRoute?.value ?? originY },
        };
        saveLineRoutes(clan?.id, next);
        if (canEditAll) {
          persistFullLayout(people, next, cardSizes).then((saved) => {
            setStatus(saved ? "Đã lưu đường liên kết vào database." : "Không thể lưu đường liên kết vào database.");
          });
        } else {
          setStatus("Đã lưu vị trí đường liên kết trên trình duyệt.");
        }
        return next;
      });
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
  }, [canEditAll, clan?.id, lineRoutes, people, cardSizes, persistFullLayout]);

  const resetLineRoutes = useCallback(() => {
    setLineRoutes({});
    saveLineRoutes(clan?.id, {});
    if (canEditAll) {
      persistFullLayout(people, {}, cardSizes).then((saved) => {
        setStatus(saved ? "Đã reset và lưu đường liên kết vào database." : "Không thể lưu reset đường liên kết.");
      });
    } else {
      setStatus("Đã đưa đường liên kết về mặc định.");
    }
  }, [canEditAll, cardSizes, clan?.id, people, persistFullLayout]);

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
    if (!selectedPerson || !canEditPerson(selectedPerson.id)) {
      setStatus("Node này nằm ngoài phạm vi chỉnh sửa của bạn.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const payload = {
        ...form,
        gender: form.gender === "" ? null : Number(form.gender),
        is_living: form.is_living === "1" ? 1 : 0,
        generation: Number(form.generation) || 1,
        branch: String(form.branch || "").trim() === "" ? null : Number(form.branch),
        birth_date: vietnamDateToIso(form.birth_date) || null,
        death_date: form.is_living === "1" ? null : vietnamDateToIso(form.death_date) || null,
      };

      // Người đã mất/người được thêm thủ công có thể chưa có tài khoản.
      // Không gửi role_id rỗng lên backend, nếu không backend sẽ hiểu là đang đổi vai trò
      // và chặn việc lưu ngày sinh/ngày mất với lỗi "Vai trò chỉ hỗ trợ...".
      delete payload.role_id;
      delete payload.account_email;
      delete payload.account_password;

      if (canEditAll && selectedPerson.account_id && (form.role_id === "2" || form.role_id === "3")) {
        payload.role_id = Number(form.role_id);
      }
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
    if (!selectedPerson || !canEditAll) {
      setStatus("Bạn không có quyền xóa node trong chế độ hiện tại.");
      return;
    }
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

  const openQuickCreateDialog = (person) => {
  setBillingWarning(null);

  if (!canEditAll) {
    setStatus("Temporary edit key không cho phép tạo node hoặc đổi quan hệ.");
    return;
  }

  if (!person?.id) {
    setStatus("Không xác định được thành viên nguồn.");
    return;
  }

  setSelectedId(person.id);
  setQuickCreateDialog({ sourcePersonId: person.id });
};

const openCreateDialogFromQuickRelation = (relation) => {
  const sourcePerson = quickCreateSourcePerson;

  if (!sourcePerson) {
    setStatus("Không xác định được thành viên nguồn để tạo liên kết.");
    setQuickCreateDialog(null);
    return;
  }

  const spouse = findSpouse(sourcePerson, canonicalTree.families, people);

  setDialog({
    relation,
    sourcePersonId: sourcePerson.id,
    form: blankCreateForm(relation, sourcePerson, spouse),
  });

  setQuickCreateDialog(null);
};

  const openCreateDialog = (relation) => {
    setBillingWarning(null);
    if (!canEditAll) {
      setStatus("Temporary edit key không cho phép tạo node hoặc đổi quan hệ.");
      return;
    }
    if (relation !== "person" && !selectedPerson) {
      setStatus("Hãy chọn một thành viên trước.");
      return;
    }
    if (relation !== "person") {
      const currentIds = relationLinkedIds(relation, selectedPerson, canonicalTree.families, canonicalTree.childRows);
      setRelationDialog({ relation, personId: [...currentIds][0] || "" });
      setTreeRelationPicker(null);
      return;
    }
    setDialog({
      relation,
      form: blankCreateForm(relation, selectedPerson, selectedSpouse),
    });
  };

const submitCreateDialog = async () => {
  if (!canEditAll || !dialog) return;

  const form = dialog.form;
  const relation = dialog.relation;
  const sourcePersonId = dialog?.sourcePersonId ? Number(dialog.sourcePersonId) : null;

  const display = String(form.display_name || "").trim();
  const parts = [form.surname, form.middle_name, form.first_name].filter(Boolean).join(" ").trim();

  if (!display && !parts) {
    setStatus("Cần nhập tên thành viên mới.");
    return;
  }

  if (form.is_living === "1") {
    const email = String(form.account_email || "").trim();
    const password = String(form.account_password || "");

    if (!email) {
      setStatus("Người còn sống cần có email để tạo tài khoản.");
      return;
    }

    if (!password || password.length < 6) {
      setStatus("Mật khẩu tài khoản tối thiểu 6 ký tự.");
      return;
    }
  }

  setDialogSaving(true);
  setStatus("");

  try {
    const createdResponse = await createPersonAPI({
      ...form,
      clan_id: clan?.id,
      gender: form.gender === "" ? null : Number(form.gender),
      is_living: form.is_living === "1" ? 1 : 0,
      generation: Number(form.generation) || 1,
      branch: String(form.branch || "").trim() === "" ? null : Number(form.branch),
      birth_date: vietnamDateToIso(form.birth_date) || null,
      death_date: form.is_living === "1" ? null : vietnamDateToIso(form.death_date) || null,
      tree_x: Number(form.tree_x) || 0,
      tree_y: Number(form.tree_y) || 0,
      account_email: form.is_living === "1" ? String(form.account_email || "").trim() : null,
      account_password: form.is_living === "1" ? String(form.account_password || "") : null,
    });

    const newPersonId = extractCreatedPersonId(createdResponse);

    if (sourcePersonId && relation !== "person") {
      if (!newPersonId) {
        throw new Error("Đã tạo người mới nhưng không lấy được ID để liên kết quan hệ.");
      }

      if (relation === "spouse") {
        await linkRelationsAPI({
          person_id: sourcePersonId,
          spouse_person_id: newPersonId,
        });
      }

      if (relation === "child") {
        const family = findFamilyForParent(sourcePersonId, canonicalTree.families);
        const existingChildren = family
          ? asArray(canonicalTree.childRows)
              .filter((row) => Number(row.family_id) === Number(family.id))
              .map((row) => Number(row.person_id))
          : [];

        const childrenIds = Array.from(new Set([...existingChildren, newPersonId])).filter(
          (id) => Number(id) !== Number(sourcePersonId)
        );

        await linkRelationsAPI({
          person_id: sourcePersonId,
          children_person_ids: childrenIds,
        });
      }

      if (relation === "father" || relation === "mother") {
        const currentParents = findParentFamilyForChild(
          sourcePersonId,
          canonicalTree.families,
          canonicalTree.childRows
        );

        await linkRelationsAPI({
          person_id: sourcePersonId,
          father_person_id:
            relation === "father" ? newPersonId : currentParents?.father_id || null,
          mother_person_id:
            relation === "mother" ? newPersonId : currentParents?.mother_id || null,
        });
      }
    }

    setDialog(null);

    if (sourcePersonId && relation !== "person") {
      setStatus(`Đã tạo thành viên mới và liên kết ${relationLabels[relation] || "quan hệ"} thành công.`);
    } else {
      setStatus("Đã tạo thành viên mới.");
    }

    await onReload?.();
  } catch (error) {
    const errorCode = error?.code || error?.data?.code;
    const billing = error?.billing || error?.data?.billing;

    if (errorCode === "PERSON_LIMIT_REACHED") {
      const currentPeople = billing?.current_people;
      const personLimit = billing?.person_limit;
      const planName = billing?.plan_name || "gói hiện tại";
      const message =
        currentPeople != null && personLimit != null
          ? `Dòng họ đã đạt giới hạn ${currentPeople}/${personLimit} người của ${planName}. Vui lòng nâng cấp gói để thêm tiếp.`
          : "Dòng họ đã đạt giới hạn số người của gói hiện tại. Vui lòng nâng cấp gói để thêm tiếp.";

      setBillingWarning({ message });
      setStatus(message);
      return;
    }

    if (errorCode === "SUBSCRIPTION_EXPIRED") {
      const message = "Gói sử dụng đã hết hạn. Vui lòng gia hạn để tiếp tục thêm người.";
      setBillingWarning({ message });
      setStatus(message);
      return;
    }

    setStatus(error?.message || "Không thể tạo thành viên.");
  } finally {
    setDialogSaving(false);
  }
};

  const submitRelationDialog = async () => {
    if (!canEditAll || !relationDialog || !selectedPerson || !relationDialog.personId) return;
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
    if (!canEditAll || !relationDialog || !selectedPerson) return;
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

  const founderIds = useMemo(
    () => findFounderIds(people, canonicalTree.families, canonicalTree.childRows),
    [people, canonicalTree.families, canonicalTree.childRows],
  );

  const beginCardResize = useCallback((event, person) => {
    if (!canEditPerson(person.id) || (event.button != null && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();

    const personId = Number(person.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = getCardSize(cardSizes, personId);
    let latest = origin;

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      const scale = scaleRef.current || 1;
      latest = normalizeCardSize({
        width: snap(origin.width + (moveEvent.clientX - startX) / scale),
        height: snap(origin.height + (moveEvent.clientY - startY) / scale),
      });
      setCardSizes((current) => ({ ...current, [personId]: latest }));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setCardSizes((current) => {
        const next = { ...current, [personId]: latest };
        saveCardSizes(clan?.id, next);
        if (canEditAll) {
          persistFullLayout(people, lineRoutes, next).then((saved) => {
            setStatus(saved ? "Đã lưu kích thước ô vào database." : "Không thể lưu kích thước ô vào database.");
          });
        } else {
          setStatus("Đã lưu kích thước ô thành viên trên trình duyệt.");
        }
        return next;
      });
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
  }, [canEditPerson, cardSizes, clan?.id, canEditAll, people, lineRoutes, persistFullLayout]);

  const selectedCanEdit = selectedPerson ? canEditPerson(selectedPerson.id) : false;
  const selectedNotice = selectedPerson
    ? canEditAll
      ? ""
      : selectedCanEdit
        ? "Bạn có quyền chỉnh sửa tạm thời trong phạm vi cho phép. Không thể tạo, xóa hoặc đổi quan hệ node."
        : canEditLimited
          ? "Node này nằm ngoài phạm vi chỉnh sửa tạm thời của bạn."
          : "Chế độ chỉ xem. Thành viên không có quyền chỉnh sửa cây gia phả."
    : "";

  const [treeFullscreen, setTreeFullscreen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("fte-bodyFullscreen", treeFullscreen);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setTreeFullscreen(false);
      }
    };

    if (treeFullscreen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.classList.remove("fte-bodyFullscreen");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [treeFullscreen]);

  const treeEditorShell = (
    <section className={`fte-shell ${treeFullscreen ? "is-fullscreen" : ""}`}>
      <TransformWrapper
        initialScale={0.85}
        minScale={0.35}
        maxScale={2.6}
        centerOnInit={true}
        limitToBounds={false}
        panning={{ disabled: draggingId !== null || draggingLineId !== null, velocityDisabled: false }}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.055, smoothStep: 0.004, wheelDisabled: false }}
        pinch={{ step: 5 }}
        velocityAnimation={{ sensitivity: 1.05, animationTime: 260 }}
        alignmentAnimation={{ sizeX: 0, sizeY: 0, animationTime: 220 }}
        onInit={(_, state) => {
          const scale = state?.scale || 0.85;
          scaleRef.current = scale;
          setCurrentScale(scale);
        }}
        onTransformed={(_, state) => {
          const scale = state?.scale || 1;
          scaleRef.current = scale;
          setCurrentScale(scale);
        }}
      >
        {({ zoomIn, zoomOut, resetTransform, centerView }) => (
          <>
            <div className="fte-toolbar">
              <div className="fte-toolbarGroup fte-toolbarGroup--edit">
                <button
                  type="button"
                  onClick={() => openCreateDialog("person")}
                  disabled={!canEditAll || loading || saving}
                  title={canEditAll ? "Thêm người vào cây gia phả" : "Chỉ quản trị viên dòng họ mới được thêm người"}
                >
                  <span className="material-symbols-outlined">person_add</span>
                  Thêm người
                </button>
                <button
                  type="button"
                  disabled={!canEditAll || !selectedPerson || loading || saving}
                  onClick={() => openCreateDialog("spouse")}
                  title={canEditAll ? "Chọn vợ/chồng cho người đang chọn" : "Thành viên chỉ được xem quan hệ"}
                >
                  <span className="material-symbols-outlined">favorite</span>
                  Chọn vợ/chồng
                </button>
                <button
                  type="button"
                  disabled={!canEditAll || !selectedPerson || loading || saving}
                  onClick={() => openCreateDialog("child")}
                  title={canEditAll ? "Chọn con cho người đang chọn" : "Thành viên chỉ được xem quan hệ"}
                >
                  <span className="material-symbols-outlined">escalator_warning</span>
                  Chọn con
                </button>
              </div>
              {canEditLimited ? (
                <div className="fte-toolbarGroup fte-toolbarGroup--notice">
                  <span className="fte-readOnlyBadge">Chỉnh sửa tạm thời: đời hiện tại ±1</span>
                </div>
              ) : null}
              <div className="fte-toolbarGroup fte-toolbarGroup--actions">
                <button
                  type="button"
                  onClick={applyAutoLayoutAndSave}
                  disabled={!canEditAll || loading || saving}
                  title={canEditAll ? "Tự động sắp xếp lại và lưu vào database" : "Thành viên chỉ được xem, không được tự sắp xếp"}
                >
                  <span className="material-symbols-outlined">auto_fix_high</span>
                  Tự sắp xếp
                </button>
                <button
                  type="button"
                  onClick={resetLineRoutes}
                  disabled={!canEditAll || loading || saving}
                  title={canEditAll ? "Đưa các đường liên kết về vị trí tự động" : "Thành viên chỉ được xem, không được reset đường nối"}
                >
                  <span className="material-symbols-outlined">polyline</span>
                  Reset đường nối
                </button>
                <button type="button" onClick={handleExport} disabled={loading || saving}>
                  <span className="material-symbols-outlined">download</span>
                  Export PNG
                </button>
              </div>
              <div className="fte-toolbarGroup fte-toolbarGroup--icons">
                <button type="button" onClick={() => zoomIn(0.16, 180)} title="Phóng to mượt">
                  <span className="material-symbols-outlined">zoom_in</span>
                </button>
                <span className="fte-zoomValue">{Math.round(currentScale * 100)}%</span>
                <button type="button" onClick={() => zoomOut(0.16, 180)} title="Thu nhỏ mượt">
                  <span className="material-symbols-outlined">zoom_out</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextFullscreen = !treeFullscreen;
                    setTreeFullscreen(nextFullscreen);
                    if (nextFullscreen) {
                      window.setTimeout(() => {
                        if (centerView) {
                          centerView(0.95, 260);
                        } else {
                          resetTransform(260);
                        }
                      }, 80);
                    }
                  }}
                  title={treeFullscreen ? "Thoát toàn màn hình" : "Phóng toàn màn hình cây"}
                  className={treeFullscreen ? "is-active" : ""}
                >
                  <span className="material-symbols-outlined">{treeFullscreen ? "close_fullscreen" : "open_in_full"}</span>
                </button>
              </div>
            </div>

            {billingWarning ? (
              <div className="fte-billingWarning">
                <div>
                  <strong>Đã đạt giới hạn gói sử dụng</strong>
                  <p>{billingWarning.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/manager/billing";
                  }}
                >
                  <span className="material-symbols-outlined">workspace_premium</span>
                  Xem gói nâng cấp
                </button>
              </div>
            ) : null}

            {status ? <div className="fte-status">{status}</div> : null}
            {treeRelationPicker ? (
              <div className="fte-treePickBanner">
                <span className="material-symbols-outlined">account_tree</span>
                <strong>Đang chọn {relationLabels[treeRelationPicker.relation] || "quan hệ"}</strong>
                <span>cho {treeRelationSource ? fullName(treeRelationSource) : "thành viên đã chọn"}. Bấm trực tiếp vào một ô thành viên trên cây để liên kết.</span>
                <button type="button" onClick={() => setTreeRelationPicker(null)}>Hủy chọn</button>
              </div>
            ) : null}

            <div className="fte-workspace">
              <div className="fte-viewport">
                {loading ? (
                  <div className="fte-loading">Đang tải cây gia phả...</div>
                ) : (
                  <TransformComponent wrapperClass="fte-transformWrapper" contentClass="fte-transformContent">
                    <div
                      id="family-tree"
                      ref={treeRef}
                      className={`fte-canvas ${treeRelationPicker ? "is-relation-picking" : ""}`}
                      style={{ width: canvasSize.width, height: canvasSize.height }}
                    >
                      <div className="fte-canvasTitle">
                        <span>Gia phả</span>
                        <strong>{String(clan?.clan_name || "Dòng họ").toUpperCase()}</strong>
                      </div>
                      <svg className="fte-lines" width={canvasSize.width} height={canvasSize.height} aria-hidden={false}>
                        {lines.filter((line) => line.type !== "route-control").map((line, index) => (
                          <path
                            key={line.id || `${line.type}-${index}`}
                            className={`fte-line is-${line.type} ${canEditAll && line.dragAxis ? "is-draggable" : ""} ${draggingLineId === `${Number(line.familyId)}:${line.routeKey || "baseY"}` ? "is-dragging" : ""}`}
                            d={line.d}
                            style={line.color ? { "--line-color": line.color } : undefined}
                            onPointerDown={canEditAll && line.dragAxis ? (event) => beginLineDrag(event, line) : undefined}
                          />
                        ))}
                        {canEditAll ? lines.filter((line) => line.type === "route-control").map((line) => (
                          <g
                            key={line.id}
                            className={`fte-lineControl ${draggingLineId === `${Number(line.familyId)}:${line.routeKey || "baseY"}` ? "is-dragging" : ""}`}
                            transform={`translate(${line.x}, ${line.y})`}
                            onPointerDown={(event) => beginLineDrag(event, line)}
                          >
                            <line x1="-28" y1="0" x2="28" y2="0" />
                            <circle cx="0" cy="0" r="12" />
                            <path d="M -5 -3 L 0 -8 L 5 -3 M -5 3 L 0 8 L 5 3" />
                          </g>
                        )) : null}
                      </svg>
                      {people.map((person) => (
                        <PersonCard
                        key={person.id}
                        person={person}
                        selected={selectedId === person.id}
                        dragging={draggingId === person.id}
                        canDrag={canEditPerson(person.id)}
                        canEdit={canEditPerson(person.id)}
                        canDelete={canEditAll && canEditPerson(person.id)}
                        founder={founderIds.has(Number(person.id))}
                        size={getCardSize(cardSizes, person.id)}
                        onPointerDown={handleCardPointerDown}
                        onResizePointerDown={beginCardResize}
                        onEdit={openPersonEditor}
                        onDelete={handleDeletePersonByCard}
                        onQuickCreate={openQuickCreateDialog}
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
        canEdit={selectedCanEdit}
        canEditRole={canEditAll && selectedCanEdit}
        canEditRelations={canEditAll && selectedCanEdit}
        canDelete={canEditAll && selectedCanEdit}
        notice={selectedNotice}
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
        onPickOnTree={() => {
          if (!selectedPerson) return;
          const relation = relationDialog?.relation;
          setTreeRelationPicker({ relation, sourcePersonId: selectedPerson.id });
          setRelationDialog(null);
          setSelectedId(null);
          setStatus(`Đang chọn ${relationLabels[relation] || "quan hệ"} cho ${fullName(selectedPerson)}. Hãy bấm vào một thành viên trên cây.`);
        }}
      />
      
      <QuickCreateRelationDialog
        sourcePerson={quickCreateSourcePerson}
        onChoose={openCreateDialogFromQuickRelation}
        onCancel={() => !dialogSaving && setQuickCreateDialog(null)}
      />

        <CreatePersonDialog
          relation={dialog?.relation}
            form={dialog?.form}
            selectedPerson={dialogSourcePerson}
            saving={dialogSaving}
            onChange={(form) => setDialog((current) => (current ? { ...current, form } : current))}
            onCancel={() => !dialogSaving && setDialog(null)}
            onSubmit={submitCreateDialog}
          />
    </section>
  );

  return treeFullscreen ? createPortal(treeEditorShell, document.body) : treeEditorShell;
}