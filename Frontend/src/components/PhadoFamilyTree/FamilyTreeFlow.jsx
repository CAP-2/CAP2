import { memo, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import "../../pages/Member/member.css";

const PERSON_WIDTH = 156;
const PERSON_HEIGHT = 88;
const SPOUSE_GAP = 72;
const SIBLING_GAP = 44;
const LEVEL_GAP = 172;
const ROOT_GAP = 120;

function FamilyPersonNode({ data }) {
  return (
    <div className={`usr-flowNode ${data.isRoot ? "isRoot" : ""}`}>
      <Handle type="target" position={Position.Top} className="usr-flowHandle usr-flowHandle--hidden" />
      <div className="usr-flowNodeName">{data.label}</div>
      <div className="usr-flowNodeMeta">{data.statusText || `Đời ${data.generation ?? "—"}`}</div>
      <Handle type="source" position={Position.Bottom} className="usr-flowHandle usr-flowHandle--red" />
      <Handle type="source" position={Position.Right} id="spouse" className="usr-flowHandle usr-flowHandle--gold" />
      <Handle type="target" position={Position.Left} id="spouse-target" className="usr-flowHandle usr-flowHandle--hidden" />
    </div>
  );
}

const MemoFamilyPersonNode = memo(FamilyPersonNode);

function FamilyHubNode() {
  return (
    <div className="usr-flowHub">
      <Handle type="target" position={Position.Top} className="usr-flowHandle usr-flowHandle--hidden" />
      <Handle type="source" position={Position.Bottom} className="usr-flowHandle usr-flowHandle--hidden" />
    </div>
  );
}

const nodeTypes = {
  person: MemoFamilyPersonNode,
  hub: FamilyHubNode,
};

function buildLayoutDataset(data) {
  const peopleMap = new Map((data.people || []).map((person) => [person.id, person]));
  const childRowsByFamily = new Map();
  const familiesByParent = new Map();
  const childIds = new Set();

  for (const row of data.children || []) {
    if (!childRowsByFamily.has(row.family_id)) childRowsByFamily.set(row.family_id, []);
    childRowsByFamily.get(row.family_id).push(row);
    childIds.add(row.person_id);
  }

  for (const rows of childRowsByFamily.values()) {
    rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  for (const family of data.families || []) {
    if (family.father_id) familiesByParent.set(family.father_id, family);
    if (family.mother_id && !familiesByParent.has(family.mother_id)) {
      familiesByParent.set(family.mother_id, family);
    }
  }

  const rootFamilies = (data.families || []).filter(
    (family) => !childIds.has(family.father_id) && !childIds.has(family.mother_id)
  );

  const familyRoots = rootFamilies.length > 0 ? rootFamilies : (data.families || []).slice(0, 1);
  const widthCache = new Map();

  function subtreeWidthForPerson(personId) {
    if (!personId) return PERSON_WIDTH;
    if (widthCache.has(personId)) return widthCache.get(personId);

    const family = familiesByParent.get(personId);
    const children = family ? (childRowsByFamily.get(family.id) || []).map((row) => row.person_id) : [];
    const coupleWidth = family?.father_id && family?.mother_id ? PERSON_WIDTH * 2 + SPOUSE_GAP : PERSON_WIDTH;

    if (children.length === 0) {
      widthCache.set(personId, coupleWidth);
      return coupleWidth;
    }

    const childrenWidth =
      children.reduce((sum, childId) => sum + subtreeWidthForPerson(childId), 0) +
      Math.max(0, children.length - 1) * SIBLING_GAP;
    const width = Math.max(coupleWidth, childrenWidth);
    widthCache.set(personId, width);
    return width;
  }

  function subtreeWidthForFamily(family) {
    if (!family) return PERSON_WIDTH;
    return subtreeWidthForPerson(family.father_id || family.mother_id);
  }

  const nodes = [];
  const edges = [];
  const placed = new Set();

  function addPersonNode(personId, centerX, y, isRoot = false) {
    const person = peopleMap.get(personId);
    if (!person) return;

    const position = {
      x: centerX - PERSON_WIDTH / 2,
      y,
    };

    if (placed.has(personId)) {
      const existing = nodes.find((node) => node.id === personId);
      if (existing) {
        existing.position = position;
        existing.data = { ...existing.data, isRoot: existing.data.isRoot || isRoot };
      }
      return;
    }

    nodes.push({
      id: person.id,
      type: "person",
      position,
      draggable: false,
      selectable: true,
      data: {
        label: person.full_name,
        statusText: person.status_text,
        generation: person.generation,
        isRoot,
      },
    });
    placed.add(person.id);
  }

  function addHubNode(hubId, centerX, y) {
    nodes.push({
      id: hubId,
      type: "hub",
      position: { x: centerX - 1, y },
      draggable: false,
      selectable: false,
      data: {},
    });
  }

  function layoutFamily(family, centerX, y, isRoot = false) {
    if (!family) return;

    const fatherId = family.father_id || null;
    const motherId = family.mother_id || null;
    const children = (childRowsByFamily.get(family.id) || []).map((row) => row.person_id);
    const hasCouple = fatherId && motherId;

    const fatherX = hasCouple ? centerX - (PERSON_WIDTH / 2 + SPOUSE_GAP / 2) : centerX;
    const motherX = hasCouple ? centerX + (PERSON_WIDTH / 2 + SPOUSE_GAP / 2) : centerX;
    const primaryParentId = fatherId || motherId;
    const primaryParentX = fatherId ? fatherX : motherX;

    if (fatherId) addPersonNode(fatherId, fatherX, y, isRoot);
    if (motherId) addPersonNode(motherId, motherX, y, isRoot);

    if (fatherId && motherId) {
      edges.push({
        id: `spouse-${family.id}`,
        source: fatherId,
        sourceHandle: "spouse",
        target: motherId,
        targetHandle: "spouse-target",
        type: "straight",
        animated: false,
        style: { stroke: "#f4cf62", strokeWidth: 3 },
      });
    }

    if (children.length === 0 || !primaryParentId) return;

    const hubId = `hub-${family.id}`;
    const hubY = y + PERSON_HEIGHT + 32;
    addHubNode(hubId, centerX, hubY);

    edges.push({
      id: `blood-parent-${family.id}`,
      source: primaryParentId,
      target: hubId,
      type: "straight",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#ff5b47" },
      style: { stroke: "#ff5b47", strokeWidth: 3 },
    });

    const totalChildrenWidth =
      children.reduce((sum, childId) => sum + subtreeWidthForPerson(childId), 0) +
      Math.max(0, children.length - 1) * SIBLING_GAP;
    let cursorX = centerX - totalChildrenWidth / 2;
    const childY = y + LEVEL_GAP;

    for (const childId of children) {
      const childWidth = subtreeWidthForPerson(childId);
      const childCenterX = cursorX + childWidth / 2;

      addPersonNode(childId, childCenterX, childY);
      edges.push({
        id: `blood-${family.id}-${childId}`,
        source: hubId,
        target: childId,
        type: "straight",
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#ff5b47" },
        style: { stroke: "#ff5b47", strokeWidth: 3 },
      });

      const childFamily = familiesByParent.get(childId);
      if (childFamily && childFamily.id !== family.id) {
        layoutFamily(childFamily, childCenterX, childY, false);
      }

      cursorX += childWidth + SIBLING_GAP;
    }
  }

  const totalRootWidth =
    familyRoots.reduce((sum, family) => sum + subtreeWidthForFamily(family), 0) +
    Math.max(0, familyRoots.length - 1) * ROOT_GAP;
  let rootCursorX = -totalRootWidth / 2;

  for (const family of familyRoots) {
    const width = subtreeWidthForFamily(family);
    const centerX = rootCursorX + width / 2;
    layoutFamily(family, centerX, 24, true);
    rootCursorX += width + ROOT_GAP;
  }

  return { nodes, edges };
}

function FamilyTreeFlowInner({ data, clanName = "Gia phả", showJson = true }) {
  const jsonText = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const flow = useMemo(() => buildLayoutDataset(data), [data]);

  return (
    <div className="usr-flowShell">
      <div className="usr-phado">
        <div className="usr-phado-frame usr-phado-frame--flow">
          <header className="usr-phado-header">
            <div className="usr-phado-ornament usr-phado-ornament--left" aria-hidden="true" />
            <div className="usr-phado-titleBlock">
              <div className="usr-phado-banner">GIA PHẢ</div>
              <div className="usr-phado-clan">{String(clanName).trim().toUpperCase()}</div>
            </div>
            <div className="usr-phado-ornament usr-phado-ornament--right" aria-hidden="true" />
          </header>

          <div className="usr-flowLegend">
            <span className="usr-flowLegendItem">
              <i className="usr-flowLegendLine isGold" />
              Vợ chồng
            </span>
            <span className="usr-flowLegendItem">
              <i className="usr-flowLegendLine isRed" />
              Bố xuống con
            </span>
          </div>

          <div className="usr-flowCanvas">
            <ReactFlow
              nodes={flow.nodes}
              edges={flow.edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.35}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              proOptions={{ hideAttribution: true }}
            >
              <Background color="rgba(244, 207, 98, 0.12)" gap={24} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </div>
      </div>

      {showJson ? (
        <section className="usr-panel usr-flowJsonPanel">
          <div className="usr-panelTitle">JSON people / families / children</div>
          <div className="usr-panelText">
            Dữ liệu dưới đây được trích từ phần ảnh nhìn thấy rõ và dùng trực tiếp để render bằng React Flow.
          </div>
          <pre className="usr-flowJson">{jsonText}</pre>
        </section>
      ) : null}
    </div>
  );
}

export default function FamilyTreeFlow(props) {
  return (
    <ReactFlowProvider>
      <FamilyTreeFlowInner {...props} />
    </ReactFlowProvider>
  );
}
