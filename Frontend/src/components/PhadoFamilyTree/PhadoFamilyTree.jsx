import "../../pages/Member/member.css";

export function personTreeLabel(person) {
  return (
    person?.display_name ||
    [person?.surname, person?.middle_name, person?.first_name].filter(Boolean).join(" ").trim() ||
    "Thành viên"
  );
}

function personSubLabel(person) {
  const hometown = (person?.hometown && String(person.hometown).trim()) || "";
  if (hometown) return hometown;
  return `Đời ${person?.generation ?? "—"}`;
}

export function PhadoPersonCard({ person, isLeaf, depth, onSelectPerson }) {
  const name = personTreeLabel(person);
  return (
    <div
      className={[
        "usr-phado-card",
        isLeaf ? "usr-phado-card--leaf" : "usr-phado-card--branch",
        depth === 0 ? "usr-phado-card--root" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      onClick={() => onSelectPerson(person)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectPerson(person);
        }
      }}
    >
      <div className="usr-phado-cardInner">
        <span className="usr-phado-name">{name}</span>
        <span className="usr-phado-detail">{personSubLabel(person)}</span>
      </div>
    </div>
  );
}

export function FamilyTreeNode({ node, onSelectPerson, depth = 0 }) {
  const person = node.person;
  const spouse = node.spouse;
  const hasChildren = node.children?.length > 0;
  const isLeaf = !hasChildren;

  return (
    <li className={`usr-phado-branchItem ${isLeaf ? "usr-phado-branchItem--leaf" : ""}`}>
      <div className={spouse ? "usr-phado-coupleRow" : "usr-phado-singleRow"}>
        <PhadoPersonCard person={person} isLeaf={isLeaf} depth={depth} onSelectPerson={onSelectPerson} />
        {spouse ? (
          <>
            <div className="usr-phado-marriageTie" aria-hidden="true" title="Vợ / chồng" />
            <PhadoPersonCard person={spouse} isLeaf={isLeaf} depth={depth} onSelectPerson={onSelectPerson} />
          </>
        ) : null}
      </div>
      {hasChildren ? (
        <>
          <div className="usr-phado-bloodVbar" aria-hidden="true" />
          <ul className="usr-phado-treeBranch usr-phado-treeBranch--blood" role="group">
            {node.children.map((child) => (
              <FamilyTreeNode key={child.person.id} node={child} onSelectPerson={onSelectPerson} depth={depth + 1} />
            ))}
          </ul>
        </>
      ) : null}
    </li>
  );
}
