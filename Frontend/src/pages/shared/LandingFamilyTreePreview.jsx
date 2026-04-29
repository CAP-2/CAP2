const sampleTree = [
  {
    name: "THỦY TỔ NGUYỄN TRÍ",
    title: "Tổ Phúc Khánh",
    generation: "Đời 1",
    dates: "Sinh: 1800 - Mất: 1875",
    type: "root",
  },
  {
    name: "NGUYỄN TRÍ CƯỜNG",
    title: "Cụ Ông",
    generation: "Đời 2",
    dates: "Sinh: 1830 - Mất: 1908",
    type: "child",
  },
  {
    name: "NGUYỄN TRÍ NAM",
    title: "Cụ Ông",
    generation: "Đời 2",
    dates: "Sinh: 1850 - Mất: 1920",
    type: "child",
  },
];

function TreeCard({ person }) {
  return (
    <div className="tree-node">
      <article className={`node-card ${person.type === "root" ? "root-card" : "child-card"}`}>
        <div className="node-avatar">
          <span className="material-symbols-outlined">person</span>
        </div>
        <div className="node-content">
          <h4>{person.name}</h4>
          <p className="node-title">{person.title}</p>
          <p className="node-generation">{person.generation}</p>
          <p className="node-dates">{person.dates}</p>
        </div>
      </article>
    </div>
  );
}

export default function LandingFamilyTreePreview() {
  return (
    <div className="family-tree-container landing-tree-preview" aria-label="Mẫu sơ đồ gia phả minh họa">
      <div className="tree-node">
        <TreeCard person={sampleTree[0]} />
        <div className="tree-children">
          <div className="tree-line" />
          <div className="children-container">
            <TreeCard person={sampleTree[1]} />
            <TreeCard person={sampleTree[2]} />
          </div>
        </div>
      </div>
    </div>
  );
}
