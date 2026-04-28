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

export default function FamilyTree({ data, isLoggedIn = false, onEditNode, onDeleteNode, onClickNode }) {
    const treeData = data || fallbackTreeData;

    const renderNode = (node, isRoot = false) => {
        if (!node) return null;
        
        // Support both old structure { name, ... } and new structure { person: { display_name, ... }, children: [...] }
        const p = node.person || node;
        const name = p.display_name || p.name || "Chưa rõ";
        const generationText = p.generation ? `Đời ${p.generation}` : (node.generation || "");
        const title = p.title || (p.gender === 1 ? "Nam" : p.gender === 2 ? "Nữ" : "");
        const avatar = p.avatar_url || null;

        return (
            <div key={p.id || Math.random()} className={`tree-node ${isRoot ? "root-node" : ""}`}>
                <div 
                    className={`node-card ${isRoot ? "root-card" : "child-card"}`}
                    onClick={() => onClickNode && onClickNode(p)}
                    style={{ cursor: onClickNode ? "pointer" : "default" }}
                >
                    <div className="node-avatar">
                        {avatar ? (
                            <img src={avatar} alt={name} className="avatar-img" />
                        ) : (
                            <span className="material-symbols-outlined">person</span>
                        )}
                    </div>
                    <div className="node-content">
                        <h4>{name}</h4>
                        {title && <p className="node-title">{title}</p>}
                        {generationText && <p className="node-generation">{generationText}</p>}
                        
                        {(p.birth_date || p.death_date) && (
                            <p className="node-dates">
                                {p.birth_date && new Date(p.birth_date).getFullYear()}
                                {p.birth_date && p.death_date && " - "}
                                {p.death_date && new Date(p.death_date).getFullYear()}
                            </p>
                        )}

                        {(onEditNode || onDeleteNode) && (
                            <div className="node-actions" onClick={(e) => e.stopPropagation()}>
                                {onEditNode && (
                                    <button type="button" onClick={() => onEditNode(p)}>
                                        Sửa
                                    </button>
                                )}
                                {onDeleteNode && !isRoot && (
                                    <button type="button" onClick={() => onDeleteNode(p.id)}>
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
