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

function formatNodeStatus(person) {
  if (person?.death_date || person?.is_living === 0) return "Đã mất";
  if (person?.hometown) return person.hometown;
  return `Đời ${person?.generation ?? "—"}`;
}

function labelForPerson(person) {
  return (
    person?.display_name ||
    [person?.surname, person?.middle_name, person?.first_name].filter(Boolean).join(" ").trim() ||
    "Thành viên"
  );
}

function FamilyPersonNode({ data }) {
  return (
    <div className={`usr-flowNode ${data.isRoot ? "isRoot" : ""}`}>
      <Handle type="target" position={Position.Top} className="usr-flowHandle usr-flowHandle--hidden" />
      <div className="usr-flowNodeName">{data.label}</div>
      <div className="usr-flowNodeMeta">{data.statusText}</div>
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

function buildFlowFromRoots(roots) {
  const rootNodes = Array.isArray(roots) ? roots : [];
  const widthCache = new WeakMap();
  const nodes = [];
  const edges = [];
  const placed = new Set();

  function subtreeWidth(node) {
    if (!node) return PERSON_WIDTH;
    if (widthCache.has(node)) return widthCache.get(node);

    const hasSpouse = Boolean(node.spouse);
    const coupleWidth = hasSpouse ? PERSON_WIDTH * 2 + SPOUSE_GAP : PERSON_WIDTH;
    const children = Array.isArray(node.children) ? node.children : [];

    if (children.length === 0) {
      widthCache.set(node, coupleWidth);
      return coupleWidth;
    }

    const childrenWidth =
      children.reduce((sum, child) => sum + subtreeWidth(child), 0) +
      Math.max(0, children.length - 1) * SIBLING_GAP;
    const width = Math.max(coupleWidth, childrenWidth);
    widthCache.set(node, width);
    return width;
  }

  function addPersonNode(person, centerX, y, isRoot = false) {
    if (!person) return;

    const position = { x: centerX - PERSON_WIDTH / 2, y };

    if (placed.has(person.id)) {
      const existing = nodes.find((node) => node.id === String(person.id));
      if (existing) {
        existing.position = position;
        existing.data = { ...existing.data, isRoot: existing.data.isRoot || isRoot };
      }
      return;
    }

    nodes.push({
      id: String(person.id),
      type: "person",
      position,
      draggable: false,
      selectable: true,
      data: {
        label: labelForPerson(person),
        statusText: formatNodeStatus(person),
        isRoot,
        person,
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

  function layoutNode(treeNode, centerX, y, isRoot = false) {
    if (!treeNode?.person) return;

    const person = treeNode.person;
    const spouse = treeNode.spouse || null;
    const children = Array.isArray(treeNode.children) ? treeNode.children : [];
    const hasSpouse = Boolean(spouse);

    const personX = hasSpouse ? centerX - (PERSON_WIDTH / 2 + SPOUSE_GAP / 2) : centerX;
    const spouseX = hasSpouse ? centerX + (PERSON_WIDTH / 2 + SPOUSE_GAP / 2) : centerX;

    addPersonNode(person, personX, y, isRoot);
    if (spouse) addPersonNode(spouse, spouseX, y, isRoot);

    if (spouse) {
      edges.push({
        id: `spouse-${person.id}-${spouse.id}`,
        source: String(person.id),
        sourceHandle: "spouse",
        target: String(spouse.id),
        targetHandle: "spouse-target",
        type: "straight",
        animated: false,
        style: { stroke: "#f4cf62", strokeWidth: 3 },
      });
    }

    if (children.length === 0) return;

    const hubId = `hub-${person.id}`;
    const hubY = y + PERSON_HEIGHT + 32;
    addHubNode(hubId, centerX, hubY);

    edges.push({
      id: `blood-parent-${person.id}`,
      source: String(person.id),
      target: hubId,
      type: "straight",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#ff5b47" },
      style: { stroke: "#ff5b47", strokeWidth: 3 },
    });

    const totalChildrenWidth =
      children.reduce((sum, child) => sum + subtreeWidth(child), 0) +
      Math.max(0, children.length - 1) * SIBLING_GAP;
    let cursorX = centerX - totalChildrenWidth / 2;
    const childY = y + LEVEL_GAP;

    for (const child of children) {
      const childWidth = subtreeWidth(child);
      const childCenterX = cursorX + childWidth / 2;

      edges.push({
        id: `blood-${person.id}-${child.person.id}`,
        source: hubId,
        target: String(child.person.id),
        type: "straight",
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#ff5b47" },
        style: { stroke: "#ff5b47", strokeWidth: 3 },
      });

      layoutNode(child, childCenterX, childY, false);
      cursorX += childWidth + SIBLING_GAP;
    }
  }

  const totalRootWidth =
    rootNodes.reduce((sum, root) => sum + subtreeWidth(root), 0) +
    Math.max(0, rootNodes.length - 1) * ROOT_GAP;
  let rootCursorX = -totalRootWidth / 2;

  for (const root of rootNodes) {
    const width = subtreeWidth(root);
    const centerX = rootCursorX + width / 2;
    layoutNode(root, centerX, 24, true);
    rootCursorX += width + ROOT_GAP;
  }

  return { nodes, edges };
}

function FamilyTreeFlowLiveInner({ roots = [], clanName = "Gia phả", onSelectPerson }) {
  const flow = useMemo(() => buildFlowFromRoots(roots), [roots]);

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
              onNodeClick={(_, node) => onSelectPerson?.(node.data?.person || null)}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="rgba(244, 207, 98, 0.12)" gap={24} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FamilyTreeFlowLive(props) {
  return (
    <ReactFlowProvider>
      <FamilyTreeFlowLiveInner {...props} />
    </ReactFlowProvider>
  );
}
