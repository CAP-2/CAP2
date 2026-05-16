import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { createPortal } from "react-dom";
import { createPersonAPI, deletePersonAPI, linkRelationsAPI, saveTreeLayoutBatchAPI, saveTreeLayoutAPI, updatePersonAPI } from "../../../api/managerService";
import { onSocketEvent } from "../../../services/socket";
import { vietnamDateToIso } from "../../../shared/utils/dateFormat";
import TreeSearchPanel from "./TreeSearchPanel";
import TreeViewModeSelector from "./TreeViewModeSelector";
import TreeNodeCard from "./TreeNodeCard";
import { useLanguage } from "../../../i18n/LanguageContext";
import { useTreeSearch } from "../hooks/useTreeSearch";
import { useTreeViewMode } from "../hooks/useTreeViewMode";
import { useTreeRealtime } from "../hooks/useTreeRealtime";
import { validateTreeData } from "../utils/treeValidation";
import { CANVAS_PADDING, CARD_WIDTH } from "../utils/tree-editor/treeConstants";
import { asArray, extractCreatedPersonId, formatDisplayDate, fullName, normalizePerson, readCurrentAccount, snap, snapLine, clamp, toInt } from "../utils/tree-editor/treePersonUtils";
import { getCardSize, loadCardSizes, loadLineRoutes, normalizeCardSize, normalizeLayoutObject, normalizeLayoutSettings, saveCardSizes, saveLineRoutes } from "../utils/tree-editor/treeStorage";
import { dedupePeopleByAccount, remapChildrenByPeople, remapFamiliesByPeople } from "../utils/tree-editor/treeNormalize";
import { autoLayoutPeople, findFounderIds, mergeManualAndAutoLayout } from "../utils/tree-editor/treeLayout";
import { buildTreeLines } from "../utils/tree-editor/treeLines";
import { blankCreateForm, buildChildRelationPayload, findParentFamilyForChild, findSpouse, findSpouseFamily, getChildrenForFamily, getFamiliesForPerson, relationCandidates, relationLinkedIds } from "../utils/tree-editor/treeRelations";
import { downloadBlob, exportFileName, renderFamilyTreePngBlob } from "../utils/tree-editor/treeExport";
import { CenterNoticeDialog, CreatePersonDialog, PersonInspector, QuickCreateRelationDialog, RelationSelectDialog } from "./FamilyTreeEditorParts/index.js";
import "./FamilyTreeEditor.css";

const shouldSuppressInlineRelationError = (error) => Boolean(error?.__centeredNoticeShown);

const LAYOUT_BATCH_SIZE = 5;
const LAYOUT_FLUSH_DELAY_MS = 10000;

export default function FamilyTreeEditor({
  clan,
  people: initialPeople = [],
  families = [],
  children: childRows = [],
  loading = false,
  onReload,
  layoutSettings,
  permission,
  editPermission,
  readOnly = false,
  enableRealtime = true,
}) {
  const { t } = useLanguage();
  const treeRef = useRef(null);
  const viewportRef = useRef(null);
  const transformApiRef = useRef(null);
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
  const [constraintNotice, setConstraintNotice] = useState("");
  const [billingWarning, setBillingWarning] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [relationDialog, setRelationDialog] = useState(null);
  const [quickCreateDialog, setQuickCreateDialog] = useState(null);
  const [treeRelationPicker, setTreeRelationPicker] = useState(null);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState(() => new Map());
  const [selfPersonId, setSelfPersonId] = useState(null);
  const currentAccount = useMemo(readCurrentAccount, []);
  const layoutClientIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `layout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const pendingLayoutRef = useRef({
    nodes: new Map(),
    lineRoutes: new Map(),
    cardSizes: new Map(),
  });
  const layoutFlushTimerRef = useRef(null);
  const layoutFlushInFlightRef = useRef(false);

  const getPendingLayoutChangeCount = useCallback(() => {
    const pending = pendingLayoutRef.current;
    return pending.nodes.size + pending.lineRoutes.size + pending.cardSizes.size;
  }, []);

  const flushLayoutChanges = useCallback(async () => {
    if (layoutFlushInFlightRef.current) return false;
    const pending = pendingLayoutRef.current;
    if (!pending.nodes.size && !pending.lineRoutes.size && !pending.cardSizes.size) return true;

    if (layoutFlushTimerRef.current) {
      window.clearTimeout(layoutFlushTimerRef.current);
      layoutFlushTimerRef.current = null;
    }

    const nodes = Array.from(pending.nodes.values());
    const lineRoutes = {};
    pending.lineRoutes.forEach((item) => {
      const familyId = Number(item.family_id);
      if (!Number.isFinite(familyId)) return;
      const routeKey = item.route_key || "baseY";
      lineRoutes[familyId] = { ...(lineRoutes[familyId] || {}), [routeKey]: item.value };
    });
    const cardSizesPayload = Object.fromEntries(pending.cardSizes.entries());
    pendingLayoutRef.current = {
      nodes: new Map(),
      lineRoutes: new Map(),
      cardSizes: new Map(),
    };

    layoutFlushInFlightRef.current = true;
    try {
      await saveTreeLayoutBatchAPI({
        clan_id: clan?.id,
        client_layout_id: layoutClientIdRef.current,
        nodes,
        line_routes: lineRoutes,
        card_sizes: cardSizesPayload,
      });
      return true;
    } catch (error) {
      const current = pendingLayoutRef.current;
      nodes.forEach((node) => {
        const key = Number(node.person_id);
        if (!current.nodes.has(key)) current.nodes.set(key, node);
      });
      Object.entries(lineRoutes).forEach(([familyId, routes]) => {
        Object.entries(routes || {}).forEach(([routeKey, value]) => {
          const key = `${familyId}:${routeKey}`;
          if (!current.lineRoutes.has(key)) {
            current.lineRoutes.set(key, { family_id: Number(familyId), route_key: routeKey, value });
          }
        });
      });
      Object.entries(cardSizesPayload).forEach(([personId, size]) => {
        if (!current.cardSizes.has(String(personId))) current.cardSizes.set(String(personId), size);
      });
      setStatus(error?.message || t("tree.messages.saveLayoutError"));
      return false;
    } finally {
      layoutFlushInFlightRef.current = false;
      if (getPendingLayoutChangeCount() > 0 && !layoutFlushTimerRef.current) {
        layoutFlushTimerRef.current = window.setTimeout(() => {
          layoutFlushTimerRef.current = null;
          flushLayoutChanges();
        }, LAYOUT_FLUSH_DELAY_MS);
      }
    }
  }, [clan?.id, getPendingLayoutChangeCount, t]);

  const enqueueLayoutChanges = useCallback((changes = {}) => {
    const pending = pendingLayoutRef.current;

    asArray(changes.nodes).forEach((node) => {
      const personId = Number(node?.person_id ?? node?.id);
      if (!Number.isFinite(personId) || personId <= 0) return;
      pending.nodes.set(personId, {
        person_id: personId,
        tree_x: snap(node.tree_x),
        tree_y: snap(node.tree_y),
      });
    });

    asArray(changes.lineRoutes).forEach((route) => {
      const familyId = Number(route?.family_id ?? route?.familyId);
      const routeKey = route?.route_key || route?.routeKey || "baseY";
      const value = snapLine(route?.value);
      if (!Number.isFinite(familyId)) return;
      pending.lineRoutes.set(`${familyId}:${routeKey}`, {
        family_id: familyId,
        route_key: routeKey,
        value,
      });
    });

    asArray(changes.cardSizes).forEach((item) => {
      const personId = Number(item?.person_id ?? item?.personId ?? item?.id);
      if (!Number.isFinite(personId) || personId <= 0) return;
      pending.cardSizes.set(String(personId), normalizeCardSize(item));
    });

    if (getPendingLayoutChangeCount() >= LAYOUT_BATCH_SIZE) {
      flushLayoutChanges();
      return;
    }

    if (layoutFlushTimerRef.current) window.clearTimeout(layoutFlushTimerRef.current);
    layoutFlushTimerRef.current = window.setTimeout(() => {
      layoutFlushTimerRef.current = null;
      flushLayoutChanges();
    }, LAYOUT_FLUSH_DELAY_MS);
  }, [flushLayoutChanges, getPendingLayoutChangeCount]);

  const applyRemoteLayoutUpdate = useCallback((payload) => {
    const layout = payload?.layout;
    if (!layout || typeof layout !== "object") return;

    const nodeChanges = asArray(layout.nodes);
    if (nodeChanges.length) {
      setPeople((current) =>
        current.map((person) => {
          const change = nodeChanges.find((item) => Number(item.person_id ?? item.id) === Number(person.id));
          return change ? { ...person, tree_x: snap(change.tree_x), tree_y: snap(change.tree_y) } : person;
        }),
      );
    }

    const nextLineRoutesPatch = normalizeLayoutObject(layout.line_routes || layout.lineRoutes);
    if (layout.line_routes_full || Object.keys(nextLineRoutesPatch).length) {
      setLineRoutes((current) => {
        const next = layout.line_routes_full ? { ...nextLineRoutesPatch } : { ...current };
        if (!layout.line_routes_full) {
          Object.entries(nextLineRoutesPatch).forEach(([familyId, routes]) => {
            if (!routes || typeof routes !== "object" || Array.isArray(routes)) return;
            next[familyId] = { ...(next[familyId] || {}), ...routes };
          });
        }
        saveLineRoutes(clan?.id, next);
        return next;
      });
    }

    const nextCardSizesPatch = normalizeLayoutObject(layout.card_sizes || layout.cardSizes);
    if (layout.card_sizes_full || Object.keys(nextCardSizesPatch).length) {
      setCardSizes((current) => {
        const next = layout.card_sizes_full ? {} : { ...current };
        Object.entries(nextCardSizesPatch).forEach(([personId, size]) => {
          next[personId] = normalizeCardSize(size);
        });
        saveCardSizes(clan?.id, next);
        return next;
      });
    }
  }, [clan?.id]);

  useEffect(() => {
    const normalizedSettings = normalizeLayoutSettings(layoutSettings);
    setLineRoutes({ ...loadLineRoutes(clan?.id), ...normalizedSettings.line_routes });
    setCardSizes({ ...loadCardSizes(clan?.id), ...normalizedSettings.card_sizes });
  }, [clan?.id, layoutSettings]);

  useEffect(() => {
    if (!enableRealtime) return undefined;

    const offTreeUpdated = onSocketEvent("tree_updated", async (data) => {
      console.log("[FamilyTreeEditor] tree_updated:", data);

      if (data?.clan_id && clan?.id && Number(data.clan_id) !== Number(clan.id)) {
        return;
      }

      if (data?.action === "tree_layout_updated") {
        if (data?.client_layout_id && data.client_layout_id === layoutClientIdRef.current) {
          return;
        }
        applyRemoteLayoutUpdate(data);
        return;
      }

      await flushLayoutChanges();
      await onReload?.();
    });

    return () => {
      offTreeUpdated();
    };
  }, [applyRemoteLayoutUpdate, enableRealtime, clan?.id, flushLayoutChanges, onReload]);

  useEffect(() => {
    const flushPendingLayout = () => {
      flushLayoutChanges();
    };

    window.addEventListener("pagehide", flushPendingLayout);
    window.addEventListener("beforeunload", flushPendingLayout);

    return () => {
      window.removeEventListener("pagehide", flushPendingLayout);
      window.removeEventListener("beforeunload", flushPendingLayout);
      if (layoutFlushTimerRef.current) {
        window.clearTimeout(layoutFlushTimerRef.current);
        layoutFlushTimerRef.current = null;
      }
      flushLayoutChanges();
    };
  }, [flushLayoutChanges]);

  const resolvedPermission = useMemo(() => {
    const activePermission = permission || editPermission;
    if (activePermission) {
      return {
        canEdit: activePermission.canEdit === true,
        editScope: activePermission.editScope || "none",
        allowedNodeIds: asArray(activePermission.allowedNodeIds).map((id) => Number(id)).filter((id) => Number.isFinite(id)),
      };
    }
    if (readOnly) {
      return { canEdit: false, editScope: "none", allowedNodeIds: [] };
    }
    return { canEdit: true, editScope: "all", allowedNodeIds: [] };
  }, [editPermission, permission, readOnly]);
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
  const treeSearch = useTreeSearch(people);
  const treeViewMode = useTreeViewMode({
    people,
    families: canonicalTree.families,
    childRows: canonicalTree.childRows,
  });
  const treeRealtime = useTreeRealtime({
    clanId: clan?.id,
    enabled: enableRealtime,
  });
  const visiblePeople = treeViewMode.visibleData.people;
  const visibleFamilies = treeViewMode.visibleData.families;
  const visibleChildRows = treeViewMode.visibleData.childRows;
  const renderOffset = useMemo(() => {
    if (!visiblePeople.length) return { x: 0, y: 0 };
    const minX = Math.min(...visiblePeople.map((person) => toInt(person.tree_x, 0)));
    const minY = Math.min(...visiblePeople.map((person) => toInt(person.tree_y, 0)));
    return {
      x: Math.max(0, CANVAS_PADDING - minX),
      y: Math.max(0, CANVAS_PADDING - minY),
    };
  }, [visiblePeople]);
  const renderPeople = useMemo(
    () => visiblePeople.map((person) => ({
      ...person,
      tree_x: toInt(person.tree_x, 0) + renderOffset.x,
      tree_y: toInt(person.tree_y, 0) + renderOffset.y,
    })),
    [renderOffset.x, renderOffset.y, visiblePeople],
  );
  const renderPersonById = useMemo(
    () => new Map(renderPeople.map((person) => [Number(person.id), person])),
    [renderPeople],
  );
  const childCountByParentId = useMemo(() => {
    const counts = new Map();
    asArray(canonicalTree.childRows).forEach((row) => {
      const family = asArray(canonicalTree.families).find((item) => Number(item.id) === Number(row.family_id));
      if (!family) return;
      [family.father_id, family.mother_id].filter(Boolean).forEach((parentId) => {
        counts.set(Number(parentId), (counts.get(Number(parentId)) || 0) + 1);
      });
    });
    return counts;
  }, [canonicalTree.childRows, canonicalTree.families]);
  const lines = useMemo(
    () => buildTreeLines(renderPeople, visibleFamilies, visibleChildRows, lineRoutes, cardSizes),
    [renderPeople, visibleFamilies, visibleChildRows, lineRoutes, cardSizes],
  );

  const persistFullLayout = useCallback(async (nextPeople = people, nextLineRoutes = lineRoutes, nextCardSizes = cardSizes) => {
    if (!canEditAll) return false;
    try {
      await saveTreeLayoutAPI(nextPeople, clan?.id, {
        lineRoutes: nextLineRoutes,
        cardSizes: nextCardSizes,
        clientLayoutId: layoutClientIdRef.current,
      });
      saveLineRoutes(clan?.id, nextLineRoutes);
      saveCardSizes(clan?.id, nextCardSizes);
      return true;
    } catch (error) {
      setStatus(error?.message || t("tree.messages.saveLayoutError"));
      return false;
    }
  }, [canEditAll, cardSizes, clan?.id, lineRoutes, people]);

  const applyAutoLayoutAndSave = useCallback(async () => {
    if (!canEditAll) return;
    const ok = window.confirm(t("tree.messages.autoLayoutConfirm"));
    if (!ok) return;
    setSaving(true);
    setStatus("");
    const nextPeople = autoLayoutPeople(canonicalTree.people, canonicalTree.families, canonicalTree.childRows);
    try {
      setPeople(nextPeople);
      const saved = await persistFullLayout(nextPeople, lineRoutes, cardSizes);
      setStatus(saved ? t("tree.messages.autoLayoutSuccess") : t("tree.messages.autoLayoutError"));
      await onReload?.();
    } finally {
      setSaving(false);
    }
  }, [canEditAll, canonicalTree, persistFullLayout, lineRoutes, cardSizes, onReload, t]);

  const canvasSize = useMemo(() => {
    const maxX = Math.max(2400, ...renderPeople.map((person) => toInt(person.tree_x, 0) + getCardSize(cardSizes, person.id).width + CANVAS_PADDING));
    const maxY = Math.max(1400, ...renderPeople.map((person) => toInt(person.tree_y, 0) + getCardSize(cardSizes, person.id).height + CANVAS_PADDING));
    return { width: maxX, height: maxY };
  }, [renderPeople, cardSizes]);

  const focusPerson = useCallback((personId, options = {}) => {
    const id = Number(personId);
    if (!Number.isFinite(id) || id <= 0) return false;
    const target = renderPersonById.get(id) || people.find((person) => Number(person.id) === id);
    if (!target) return false;
    treeViewMode.expandPathToPerson(id);
    setSelectedId(id);
    if (options.search) treeSearch.markResult(id);
    if (options.self) setSelfPersonId(id);

    window.setTimeout(() => {
      const api = transformApiRef.current;
      const viewport = viewportRef.current;
      const size = getCardSize(cardSizes, id);
      if (api?.setTransform && viewport) {
        const rect = viewport.getBoundingClientRect();
        const nextScale = options.scale || 1.25;
        const targetCenterX = toInt(target.tree_x, 0) + size.width / 2;
        const targetCenterY = toInt(target.tree_y, 0) + size.height / 2;
        const nextX = rect.width / 2 - targetCenterX * nextScale;
        const nextY = rect.height / 2 - targetCenterY * nextScale;
        api.setTransform(nextX, nextY, nextScale, 320);
        return;
      }

      const element = document.getElementById(`fte-person-${id}`);
      if (element?.scrollIntoView) {
        element.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      }
    }, 120);
    return true;
  }, [cardSizes, people, renderPersonById, treeSearch, treeViewMode]);

  const handleFindMe = useCallback(() => {
    const accountId = Number(currentAccount?.account_id || currentAccount?.accountId || currentAccount?.id);
    const personIdFromAccount = Number(currentAccount?.person_id || currentAccount?.personId);
    const matched = Number.isFinite(personIdFromAccount) && personIdFromAccount > 0
      ? people.find((person) => Number(person.id) === personIdFromAccount)
      : people.find((person) => Number(person.account_id) === accountId);

    if (!matched) {
      setStatus(t("tree.messages.noAccountLinked"));
      return;
    }
    setStatus("");
    if (!visiblePeople.some((person) => Number(person.id) === Number(matched.id))) {
      treeViewMode.setFullMode();
    }
    focusPerson(matched.id, { self: true });
  }, [currentAccount, focusPerson, people, treeViewMode, visiblePeople]);

  const handleValidateTree = useCallback(() => {
    const errors = validateTreeData(people, canonicalTree.families, canonicalTree.childRows);
    setValidationErrors(errors);
    setStatus(errors.size ? t("tree.messages.validationErrorCount", { count: errors.size }) : t("tree.messages.validationSuccess"));
  }, [canonicalTree.childRows, canonicalTree.families, people, t]);

  useEffect(() => {
    if (!validationErrors.size) return;
    const errors = validateTreeData(people, canonicalTree.families, canonicalTree.childRows);
    setValidationErrors(errors);
    if (!errors.size) setStatus(t("tree.messages.validationFixed"));
  }, [canonicalTree.childRows, canonicalTree.families, people, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const validationIssueRows = useMemo(() => {
    if (!validationErrors.size) return [];
    const peopleById = new Map(people.map((person) => [Number(person.id), person]));
    return Array.from(validationErrors.entries()).flatMap(([personId, messages]) => {
      const person = peopleById.get(Number(personId));
      return asArray(messages).map((message) => ({
        personId: Number(personId),
        personName: fullName(person, t("tree.card.fallbackName")),
        generation: person?.generation || "",
        message,
      }));
    });
  }, [people, validationErrors]);

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
        enqueueLayoutChanges({
          nodes: [{ person_id: person.id, ...finalPosition }],
        });
      }
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
  }, [enqueueLayoutChanges]);

  const openPersonEditor = useCallback((person) => {
    if (!person) return;
    if (canEditPerson(person.id)) treeRealtime.startEditing(person.id);
    setSelectedId(person.id);
  }, [canEditPerson, treeRealtime]);

  const handleDeletePersonByCard = useCallback(async (person) => {
    if (!person || !canEditAll) {
      setStatus(t("tree.messages.noPermissionAction"));
      return;
    }
    const ok = window.confirm(t("tree.messages.deleteConfirm", { name: fullName(person) }));
    if (!ok) return;
    setSaving(true);
    setStatus("");
    try {
      await deletePersonAPI(person.id);
      setPeople((current) => current.filter((item) => item.id !== person.id));
      setSelectedId((current) => (Number(current) === Number(person.id) ? null : current));
      setStatus(t("tree.messages.deleteSuccess"));
      await onReload?.();
    } catch (error) {
      setStatus(error?.message || t("tree.messages.deleteError"));
    } finally {
      setSaving(false);
    }
  }, [canEditAll, onReload, t]);

  const linkRelationTarget = useCallback(async (relation, sourcePerson, targetId) => {
    if (!canEditAll || !sourcePerson || !targetId) return false;
    const sourceId = Number(sourcePerson.id);
    const nextTargetId = Number(targetId);
    if (!Number.isFinite(sourceId) || !Number.isFinite(nextTargetId) || sourceId === nextTargetId) {
      setConstraintNotice(t("tree.messages.linkTargetError"));
      return false;
    }

    setDialogSaving(true);
    setStatus("");
    try {
      if (relation === "spouse") {
        await linkRelationsAPI({ person_id: sourceId, spouse_person_id: nextTargetId });
      }

      if (relation === "child") {
        const childPayload = buildChildRelationPayload(
          sourceId,
          nextTargetId,
          canonicalTree.families,
          canonicalTree.childRows,
          people,
        );
        if (childPayload.error) {
          setConstraintNotice(t("tree.messages.multipleFamiliesError"));
          return false;
        }
        await linkRelationsAPI(childPayload.data);
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
      setStatus(t("tree.messages.linkSuccess", { relation: t(`tree.relations.${relation}`) }));
      await onReload?.();
      return true;
    } catch (error) {
      if (!shouldSuppressInlineRelationError(error)) setConstraintNotice(error?.message || t("tree.messages.linkError"));
      return false;
    } finally {
      setDialogSaving(false);
    }
  }, [canEditAll, canonicalTree.families, canonicalTree.childRows, onReload, people, t]);

  const submitTreeRelationPick = useCallback((targetPerson) => {
    if (!treeRelationPicker || !targetPerson) return;
    const relation = treeRelationPicker.relation;
    const sourcePerson = people.find((item) => Number(item.id) === Number(treeRelationPicker.sourcePersonId));
    if (!sourcePerson) {
      setTreeRelationPicker(null);
      setStatus(t("tree.messages.linkSourceNotFound"));
      return;
    }
    const linkedIds = relationLinkedIds(relation, sourcePerson, canonicalTree.families, canonicalTree.childRows);
    if (linkedIds.has(Number(targetPerson.id))) {
      setConstraintNotice(t("tree.messages.linkAlreadyExists"));
      return;
    }
    const candidates = relationCandidates(relation, sourcePerson, people, linkedIds, canonicalTree.families);
    const allowed = candidates.some((item) => Number(item.id) === Number(targetPerson.id));
    if (!allowed) {
      setConstraintNotice(t("tree.messages.linkNotAllowed"));
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
          setStatus(t("tree.toolbar.limitedEdit"));
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
      const nextValue = snapLine(clamp(originY + (moveEvent.clientY - startY) / scale, minY, maxY));
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
        enqueueLayoutChanges({
          lineRoutes: [{
            family_id: familyId,
            route_key: routeKey,
            value: finalRoute?.value ?? originY,
          }],
        });
        return next;
      });
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
  }, [canEditAll, clan?.id, enqueueLayoutChanges, lineRoutes]);

  const resetLineRoutes = useCallback(() => {
    setLineRoutes({});
    saveLineRoutes(clan?.id, {});
    if (canEditAll) {
      persistFullLayout(people, {}, cardSizes).then((saved) => {
        setStatus(saved ? t("tree.messages.autoLayoutSuccess") : t("tree.messages.saveLayoutError"));
      });
    } else {
      setStatus(t("tree.messages.saveSuccess"));
    }
  }, [canEditAll, cardSizes, clan?.id, people, persistFullLayout, t]);

  const handleExport = async () => {
    setSaving(true);
    setStatus("");
    const renderPeople = visiblePeople.length ? visiblePeople : people;
    try {
      const blob = await renderFamilyTreePngBlob({ people: renderPeople, lines, cardSizes, clan, t });
      downloadBlob(blob, exportFileName(clan?.clan_name));
      setStatus(t("tree.messages.exportSuccess"));
    } catch (error) {
      console.error("Export PNG failed:", error);
      setStatus(`${t("tree.messages.exportError")}${error?.message ? `: ${error.message}` : "."}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePerson = async (form) => {
    if (!selectedPerson || !canEditPerson(selectedPerson.id)) {
      setStatus(t("tree.messages.noPermissionAction"));
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
        let nextPeopleForValidation = null;
        let clearedAllValidationErrors = false;
        setPeople((current) =>
          {
            nextPeopleForValidation = current.map((person) =>
              person.id === selectedPerson.id ? normalizePerson({ ...person, ...result.person }) : person,
            );
            return nextPeopleForValidation;
          },
        );
        if (validationErrors.size && nextPeopleForValidation) {
          const errors = validateTreeData(nextPeopleForValidation, canonicalTree.families, canonicalTree.childRows);
          setValidationErrors(errors);
          clearedAllValidationErrors = !errors.size;
          if (clearedAllValidationErrors) setStatus(t("tree.messages.validationFixed"));
        }
        if (!clearedAllValidationErrors) setStatus(t("tree.messages.saveSuccess"));
      } else {
        setStatus(t("tree.messages.saveSuccess"));
      }
      await onReload?.();
    } catch (error) {
      if (!shouldSuppressInlineRelationError(error)) setConstraintNotice(error?.message || t("tree.messages.saveError"));
    } finally {
      treeRealtime.stopEditing(selectedPerson.id);
      setSaving(false);
    }
  };

  const handleDeletePerson = async () => {
    if (!selectedPerson || !canEditAll) {
      setStatus(t("tree.messages.noPermissionAction"));
      return;
    }
    const ok = window.confirm(t("tree.messages.deleteConfirm", { name: fullName(selectedPerson) }));
    if (!ok) return;
    setSaving(true);
    setStatus("");
    try {
      await deletePersonAPI(selectedPerson.id);
      setPeople((current) => current.filter((person) => person.id !== selectedPerson.id));
      setSelectedId(null);
      setStatus(t("tree.messages.deleteSuccess"));
      await onReload?.();
    } catch (error) {
      setStatus(error?.message || t("tree.messages.deleteError"));
    } finally {
      setSaving(false);
    }
  };

  const openQuickCreateDialog = (person) => {
  setBillingWarning(null);

  if (!canEditAll) {
    setStatus(t("tree.inspector.limitedNote"));
    return;
  }

  if (!person?.id) {
    setStatus(t("tree.messages.linkSourceNotFound"));
    return;
  }

  // Khi bấm icon thêm liên kết, chỉ mở bảng chọn loại liên kết.
  // Không chọn/mở panel thông tin thành viên phía sau.
  setSelectedId(null);
  setQuickCreateDialog({ sourcePersonId: person.id });
};

const openCreateDialogFromQuickRelation = (relation) => {
  const sourcePerson = quickCreateSourcePerson;

  if (!sourcePerson) {
    setStatus(t("tree.messages.linkSourceNotFound"));
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
      setStatus(t("tree.inspector.limitedNote"));
      return;
    }
    if (relation !== "person" && !selectedPerson) {
      setStatus(t("tree.messages.linkSourceNotFound"));
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
    setStatus(t("tree.messages.genericError"));
    return;
  }

  if (form.is_living === "1") {
    const email = String(form.account_email || "").trim();
    const password = String(form.account_password || "");

    if (!email) {
      setStatus(t("tree.messages.genericError"));
      return;
    }

    if (!password || password.length < 6) {
      setStatus(t("tree.createModal.fields.passwordHint"));
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
        throw new Error(t("tree.messages.linkError"));
      }

      if (relation === "spouse") {
        await linkRelationsAPI({
          person_id: sourcePersonId,
          spouse_person_id: newPersonId,
        });
      }

      if (relation === "child") {
        const childPayload = buildChildRelationPayload(
          sourcePersonId,
          newPersonId,
          canonicalTree.families,
          canonicalTree.childRows,
          people,
        );
        if (childPayload.error) {
          throw new Error(t("tree.messages.multipleFamiliesError"));
        }
        await linkRelationsAPI(childPayload.data);
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
      setStatus(t("tree.messages.saveSuccess"));
    } else {
      setStatus(t("tree.messages.saveSuccess"));
    }

    await onReload?.();
  } catch (error) {
    const errorCode = error?.code || error?.data?.code;
    const billing = error?.billing || error?.data?.billing;

    if (errorCode === "PERSON_LIMIT_REACHED") {
      const currentPeople = billing?.current_people;
      const personLimit = billing?.person_limit;
      const planName = billing?.plan_name || t("common.currentPlan");
      const message =
        currentPeople != null && personLimit != null
          ? t("tree.messages.personLimitReached", { current: currentPeople, limit: personLimit, plan: planName })
          : t("tree.messages.personLimitReached", { current: currentPeople, limit: "?", plan: planName });

      setBillingWarning({ message });
      setStatus(message);
      return;
    }

    if (errorCode === "SUBSCRIPTION_EXPIRED") {
      const message = t("tree.messages.subscriptionExpired");
      setBillingWarning({ message });
      setStatus(message);
      return;
    }

    if (!shouldSuppressInlineRelationError(error)) setConstraintNotice(error?.message || t("tree.messages.saveError"));
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
        const childPayload = buildChildRelationPayload(
          selectedPerson.id,
          targetId,
          canonicalTree.families,
          canonicalTree.childRows,
          people,
        );
        if (childPayload.error) {
          setConstraintNotice(t("tree.messages.multipleFamiliesError"));
          return;
        }
        await linkRelationsAPI(childPayload.data);
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
      setStatus(t("tree.messages.linkSuccess", { relation: t(`tree.relations.${relation}`) }));
      await onReload?.();
    } catch (error) {
      if (!shouldSuppressInlineRelationError(error)) setConstraintNotice(error?.message || t("tree.messages.linkError"));
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
        const family = findSpouseFamily(selectedPerson.id, targetId, canonicalTree.families);
        await linkRelationsAPI({
          person_id: selectedPerson.id,
          family_id: family?.id || null,
          spouse_person_id: null,
        });
      }

      if (relation === "child") {
        const family = asArray(canonicalTree.families).find((item) =>
          asArray(canonicalTree.childRows).some(
            (row) => Number(row.family_id) === Number(item.id) && Number(row.person_id) === targetId,
          ) && (Number(item.father_id) === Number(selectedPerson.id) || Number(item.mother_id) === Number(selectedPerson.id))
        );
        if (!family) {
          setConstraintNotice(t("tree.messages.unlinkError"));
          return;
        }
        const existingChildren = getChildrenForFamily(family.id, canonicalTree.childRows);
        const childrenIds = existingChildren.filter((id) => Number(id) !== targetId);
        await linkRelationsAPI({
          person_id: selectedPerson.id,
          family_id: family.id,
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
      setStatus(t("tree.messages.unlinkSuccess", { relation: t(`tree.relations.${relation}`) }));
      await onReload?.();
    } catch (error) {
      if (!shouldSuppressInlineRelationError(error)) setConstraintNotice(error?.message || t("tree.messages.unlinkError"));
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
        enqueueLayoutChanges({
          cardSizes: [{ person_id: personId, ...latest }],
        });
        return next;
      });
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
  }, [canEditPerson, cardSizes, clan?.id, enqueueLayoutChanges]);

  const selectedCanEdit = selectedPerson ? canEditPerson(selectedPerson.id) : false;
  const selectedNotice = selectedPerson
    ? canEditAll
      ? ""
      : selectedCanEdit
        ? t("tree.inspector.limitedNote")
        : canEditLimited
          ? t("tree.toolbar.limitedEdit")
          : t("tree.inspector.readOnlyNote")
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

        pinch={{ step: 5 }}
        velocityAnimation={{ sensitivity: 1.05, animationTime: 260 }}
        alignmentAnimation={{ sizeX: 0, sizeY: 0, animationTime: 220 }}
        onInit={(ref) => {
          transformApiRef.current = ref;
          const scale = ref?.state?.scale || 0.85;
          scaleRef.current = scale;
          setCurrentScale(scale);
        }}
        onZoom={(ref) => {
          const scale = ref?.state?.scale || 0.85;
          scaleRef.current = scale;
          setCurrentScale(scale);
        }}
        onTransformed={(ref) => {
          const scale = ref?.state?.scale || 0.85;
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
                  title={canEditAll ? t("tree.toolbar.addPerson") : t("tree.toolbar.addPersonAdminOnly")}
                  className="fte-iconButton"
                >
                  <span className="material-symbols-outlined">person_add</span>
                </button>
              </div>
              {canEditLimited ? (
                <div className="fte-toolbarGroup fte-toolbarGroup--notice">
                  <span className="fte-readOnlyBadge">{t("tree.toolbar.limitedEdit")}</span>
                </div>
              ) : null}
              <TreeViewModeSelector
                people={people}
                mode={treeViewMode.mode}
                rootPersonId={treeViewMode.rootPersonId}
                onFullMode={treeViewMode.setFullMode}
                onRootMode={(personId) => {
                  treeViewMode.setRootMode(personId);
                  focusPerson(personId);
                }}
              />
              <TreeSearchPanel
                query={treeSearch.query}
                onQueryChange={treeSearch.setQuery}
                onSubmit={treeSearch.submitSearch}
                onClear={treeSearch.clearSearch}
                submittedQuery={treeSearch.submittedQuery}
                results={treeSearch.results}
                onFindMe={handleFindMe}
                onResultClick={(person) => {
                  if (!visiblePeople.some((item) => Number(item.id) === Number(person.id))) {
                    treeViewMode.setFullMode();
                  }
                  focusPerson(person.id, { search: true });
                }}
              />
              <div className="fte-toolbarGroup fte-toolbarGroup--actions">
                <button
                  type="button"
                  onClick={applyAutoLayoutAndSave}
                  disabled={!canEditAll || loading || saving}
                  title={canEditAll ? t("tree.toolbar.autoLayout") : t("tree.toolbar.autoLayoutViewerHint")}
                  className="fte-iconButton"
                >
                  <span className="material-symbols-outlined">auto_fix_high</span>
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={loading || saving}
                  title={t("tree.toolbar.exportPng")}
                  className="fte-iconButton"
                >
                  <span className="material-symbols-outlined">download</span>
                </button>
                <button
                  type="button"
                  onClick={handleValidateTree}
                  disabled={loading || saving}
                  title={t("tree.toolbar.validate")}
                  className="fte-iconButton"
                >
                  <span className="material-symbols-outlined">rule</span>
                </button>
              </div>
              <div className="fte-toolbarGroup fte-toolbarGroup--icons">
                <button type="button" onClick={() => zoomIn(0.16, 180)} title={t("tree.toolbar.zoomIn")}>
                  <span className="material-symbols-outlined">zoom_in</span>
                </button>
                <span className="fte-zoomValue">{Math.round(currentScale * 100)}%</span>
                <button type="button" onClick={() => zoomOut(0.16, 180)} title={t("tree.toolbar.zoomOut")}>
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
                  title={treeFullscreen ? t("tree.toolbar.exitFullscreen") : t("tree.toolbar.fullscreen")}
                  className={treeFullscreen ? "is-active" : ""}
                >
                  <span className="material-symbols-outlined">{treeFullscreen ? "close_fullscreen" : "open_in_full"}</span>
                </button>
              </div>
            </div>

            {billingWarning ? (
              <div className="fte-billingWarning">
                <div>
                  <strong>{t("tree.messages.billingLimit")}</strong>
                  <p>{billingWarning.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/manager/billing";
                  }}
                >
                  <span className="material-symbols-outlined">workspace_premium</span>
                  {t("tree.messages.billingUpgrade")}
                </button>
              </div>
            ) : null}

            {status ? <div className="fte-status" role="status" aria-live="polite">{status}</div> : null}
            {validationIssueRows.length ? (
              <div className="fte-validationPanel" role="status" aria-live="polite">
                <div className="fte-validationPanelHead">
                  <strong>{t("tree.messages.validationTitle")}</strong>
                  <span>{t("tree.messages.validationSummary", { count: validationErrors.size })}</span>
                </div>
                <div className="fte-validationList">
                  {validationIssueRows.slice(0, 12).map((issue, index) => (
                    <button
                      key={`${issue.personId}-${index}-${issue.message}`}
                      type="button"
                      onClick={() => focusPerson(issue.personId, { scale: 1.2 })}
                    >
                      <span className="material-symbols-outlined">warning</span>
                      <strong>{issue.personName}{issue.generation ? ` - ${t("tree.card.generation", { count: issue.generation })}` : ""}</strong>
                      <small>{issue.message}</small>
                    </button>
                  ))}
                  {validationIssueRows.length > 12 ? (
                    <span className="fte-validationMore">{t("tree.messages.validationMore", { count: validationIssueRows.length - 12 })}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {constraintNotice ? <CenterNoticeDialog message={constraintNotice} onClose={() => setConstraintNotice("")} /> : null}
            {treeRelationPicker ? (
              <div className="fte-treePickFloating" role="status" aria-live="polite">
                <div>
                  <strong>{t("tree.messages.treePickHint", { relation: t(`tree.relations.${treeRelationPicker.relation}`), name: treeRelationSource ? fullName(treeRelationSource) : t("tree.card.fallbackName") })}</strong>
                </div>
                <button type="button" onClick={() => { setTreeRelationPicker(null); setStatus(""); }}>{t("common.cancel")}</button>
              </div>
            ) : null}

            <div className="fte-workspace">
              <div className="fte-viewport" ref={viewportRef}>
                {loading ? (
                  <div className="fte-loading">{t("tree.messages.loading")}</div>
                ) : (
                  <TransformComponent wrapperClass="fte-transformWrapper" contentClass="fte-transformContent">
                    <div
                      id="family-tree"
                      ref={treeRef}
                      className={`fte-canvas ${treeRelationPicker ? "is-relation-picking" : ""}`}
                      style={{ width: canvasSize.width, height: canvasSize.height }}
                    >
                      <div className="fte-canvasTitle">
                        <span>{t("tree.title")}</span>
                        <strong>{String(clan?.clan_name || t("tree.card.fallbackName")).toUpperCase()}</strong>
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
                      {visiblePeople.map((person) => {
                        const renderPerson = renderPersonById.get(Number(person.id)) || person;
                        return (
                        <TreeNodeCard
                        key={person.id}
                        person={renderPerson}
                        selected={selectedId === person.id}
                        dragging={draggingId === person.id}
                        canDrag={canEditPerson(person.id)}
                        canEdit={canEditPerson(person.id)}
                        canDelete={canEditAll && canEditPerson(person.id)}
                        founder={founderIds.has(Number(person.id))}
                        size={getCardSize(cardSizes, person.id)}
                        hasChildren={(childCountByParentId.get(Number(person.id)) || 0) > 0}
                        collapsed={treeViewMode.collapsedIds.has(Number(person.id))}
                        highlightOptions={{
                          onlinePersonIds: treeRealtime.onlinePersonIds,
                          editingPersonIds: treeRealtime.editingPersonIds,
                          searchPersonId: treeSearch.highlightedPersonId,
                          selfPersonId,
                          validationErrors,
                        }}
                        onPointerDown={(event) => handleCardPointerDown(event, person)}
                        onResizePointerDown={(event) => beginCardResize(event, person)}
                        onEdit={() => openPersonEditor(person)}
                        onDelete={() => handleDeletePersonByCard(person)}
                        onQuickCreate={() => openQuickCreateDialog(person)}
                        onToggleCollapse={treeViewMode.toggleCollapse}
                      />
                        );
                      })}
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
        onClose={() => {
          if (selectedPerson && selectedCanEdit) treeRealtime.stopEditing(selectedPerson.id);
          setSelectedId(null);
        }}
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
          setStatus("");
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
