const asArray = (value) => (Array.isArray(value) ? value : []);

function personName(person) {
  return person?.display_name || [person?.surname, person?.middle_name, person?.first_name].filter(Boolean).join(" ").trim() || "Thành viên";
}

export default function TreeSearchPanel({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  results = [],
  submittedQuery,
  onResultClick,
  onFindMe,
  findMeDisabled = false,
}) {
  const hasSubmitted = String(submittedQuery || "").trim().length > 0;

  return (
    <div className="fte-searchPanel">
      <form
        className="fte-searchForm"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.();
        }}
      >
        <label>
          <span>Tìm người</span>
          <input
            type="search"
            value={query}
            placeholder="Tên, đời, ngày sinh, năm sinh"
            onChange={(event) => onQueryChange?.(event.target.value)}
          />
        </label>
        <button type="submit">
          <span className="material-symbols-outlined">search</span>
          Tìm
        </button>
        <button type="button" onClick={onFindMe} disabled={findMeDisabled}>
          <span className="material-symbols-outlined">my_location</span>
          Tìm tôi
        </button>
        <button type="button" onClick={onClear}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </form>

      {hasSubmitted ? (
        <div className="fte-searchResults">
          {asArray(results).length ? (
            asArray(results).map((person) => (
              <button key={person.id} type="button" onClick={() => onResultClick?.(person)}>
                <strong>{personName(person)}</strong>
                <small>Đời {person.generation || 1}{person.birth_date ? ` - ${person.birth_date}` : ""}</small>
              </button>
            ))
          ) : (
            <span>Không tìm thấy người phù hợp.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

