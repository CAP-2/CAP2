const fallbackTreeData = {
    id: 1,
    name: "THỦY TỔ NGUYỄN TRÍ",
    title: "Tổ Phúc Khánh",
    generation: "Đời 1",
    birth: "1800",
    death: "1875",
    children: [
        {
            id: 2,
            name: "NGUYỄN TRÍ CƯỜNG",
            title: "Cụ Ông",
            generation: "Đời 2",
            birth: "1830",
            death: "1908",
            children: [],
        },
        {
            id: 3,
            name: "NGUYỄN TRÍ NAM",
            title: "Cụ Ông",
            generation: "Đời 2",
            birth: "1850",
            death: "1920",
            children: [],
        },
    ],
};

export default function FamilyTree({ data, isLoggedIn = false, onEditNode, onDeleteNode }) {
    const treeData = data || fallbackTreeData;

    const renderNode = (node, isRoot = false) => {
        return (
            <div key={node.id} className={`tree-node ${isRoot ? "root-node" : ""}`}>
                <div className={`node-card ${isRoot ? "root-card" : "child-card"}`}>
                    <div className="node-avatar">
                        <span className="material-symbols-outlined">person</span>
                    </div>
                    <div className="node-content">
                        <h4>{node.name}</h4>
                        <p className="node-title">{node.title}</p>
                        {node.generation && <p className="node-generation">{node.generation}</p>}
                        {(node.birth || node.death) && (
                            <p className="node-dates">
                                {node.birth && `Sinh: ${node.birth}`}
                                {node.birth && node.death && " - "}
                                {node.death && `Mất: ${node.death}`}
                            </p>
                        )}

                        {(onEditNode || onDeleteNode) && (
                            <div className="node-actions">
                                {onEditNode && (
                                    <button type="button" onClick={() => onEditNode(node)}>
                                        Sửa
                                    </button>
                                )}
                                {onDeleteNode && !isRoot && (
                                    <button type="button" onClick={() => onDeleteNode(node.id)}>
                                        Xóa
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {node.children && node.children.length > 0 && (
                    <div className="tree-children">
                        <div className="tree-line" />
                        <div className="children-container">
                            {node.children.map((child) => renderNode(child))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="family-tree-container">
            {renderNode(treeData, true)}
        </div>
    );
}
