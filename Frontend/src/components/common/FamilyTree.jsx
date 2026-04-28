import "./FamilyTree.css";

export default function FamilyTree({ data, onNodeClick }) {
    if (!data || (!data.roots && !data.person)) return null;

    const renderMemberCard = (person, type = "primary") => {
        if (!person) return null;
        return (
            <div 
                className={`node-card ${type}`} 
                onClick={(e) => {
                    e.stopPropagation();
                    if (onNodeClick) onNodeClick({ person });
                }}
            >
                <div className="node-avatar">
                    {person.avatar_url ? (
                        <img src={person.avatar_url} alt={person.display_name} />
                    ) : (
                        <span className="material-symbols-outlined">
                            {person.gender === 2 ? "female" : "male"}
                        </span>
                    )}
                </div>
                <div className="node-info">
                    <h4>{person.display_name}</h4>
                    <p>Đời {person.generation}</p>
                </div>
            </div>
        );
    };

    const renderNode = (node) => {
        return (
            <div key={node.person.id} className="tree-node-wrapper">
                <div className="node-pair">
                    {renderMemberCard(node.person, "primary")}
                    {node.spouse && <div className="spouse-connector"></div>}
                    {node.spouse && renderMemberCard(node.spouse, "spouse")}
                </div>
                
                {node.children && node.children.length > 0 && (
                    <div className="node-children">
                        <div className="vertical-line"></div>
                        <div className="children-grid">
                            {node.children.map(child => renderNode(child))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // If it's the root container (from backend structure { roots: [...] })
    if (data.roots) {
        return (
            <div className="family-tree-canvas">
                {data.roots.map(root => renderNode(root))}
            </div>
        );
    }

    // If it's a single node structure
    return (
        <div className="family-tree-canvas">
            {renderNode(data)}
        </div>
    );
}
