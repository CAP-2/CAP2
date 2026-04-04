import "../../pages/Member/member.css";

export function personTreeLabel(p) {
  return (
    p.display_name ||
    [p.surname, p.middle_name, p.first_name].filter(Boolean).join(" ").trim() ||
    "Thành viên"
  );
}

export function PhadoPersonCard({ person, isLeaf, onSelectPerson }) {
  const name = personTreeLabel(person);
  const hometown = (person.hometown && String(person.hometown).trim()) || "";
  return (
    <div
      className={`usr-phado-card ${isLeaf ? "usr-phado-card--leaf" : "usr-phado-card--scroll"}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelectPerson(person)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectPerson(person);
        }
      }}
    >
      {isLeaf ? (
        <>
          <span className="usr-phado-name">{name}</span>
          {hometown ? <span className="usr-phado-detail">{hometown}</span> : null}
          <span className="usr-phado-meta">Đời {person.generation ?? "—"}</span>
        </>
      ) : (
        <>
          <span className="usr-phado-scrollCap" aria-hidden="true" />
          <div className="usr-phado-cardBody">
            <span className="usr-phado-name">{name}</span>
            <span className="usr-phado-meta">Đời {person.generation ?? "—"}</span>
          </div>
          <span className="usr-phado-scrollCap usr-phado-scrollCap--right" aria-hidden="true" />
        </>
      )}
    </div>
  );
}

export function FamilyTreeNode({ node, onSelectPerson }) {
  const p = node.person;
  const spouse = node.spouse;
  const hasKids = node.children?.length > 0;
  const isLeaf = !hasKids;

  return (
    <li className={`usr-phado-branchItem ${isLeaf ? "usr-phado-branchItem--leaf" : ""}`}>
      <div className={spouse ? "usr-phado-coupleRow" : "usr-phado-singleRow"}>
        <PhadoPersonCard person={p} isLeaf={isLeaf} onSelectPerson={onSelectPerson} />
        {spouse ? (
          <>
            <div className="usr-phado-marriageTie" aria-hidden="true" title="Vợ / chồng" />
            <PhadoPersonCard person={spouse} isLeaf={isLeaf} onSelectPerson={onSelectPerson} />
          </>
        ) : null}
      </div>
      {hasKids ? (
        <>
          <div className="usr-phado-bloodVbar" aria-hidden="true" />
          <ul className="usr-phado-treeBranch usr-phado-treeBranch--blood" role="group">
            {node.children.map((ch) => (
              <FamilyTreeNode key={ch.person.id} node={ch} onSelectPerson={onSelectPerson} />
            ))}
          </ul>
        </>
      ) : null}
    </li>
  );
}
