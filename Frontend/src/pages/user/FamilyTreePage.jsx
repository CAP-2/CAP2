import { useCallback, useEffect, useMemo, useState } from "react";
import { getMemberDashboard } from "../../api/memberService";
import { FamilyTreeNode, personTreeLabel } from "../../components/PhadoFamilyTree/PhadoFamilyTree";
import "../Member/MemberDashboard.css";

function formatDate(value) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("vi-VN");
}

export default function FamilyTreePage() {
  const [dashboard, setDashboard] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getMemberDashboard();
      setDashboard(response);
    } catch (err) {
      setError(err?.message || "Không thể tải cây gia phả.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const treeMembers = dashboard?.treeMembers || [];
  const roots = dashboard?.familyTree?.roots || [];
  const clanName = dashboard?.clan?.clan_name || "Gia phả";

  const filteredMembers = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return treeMembers;
    return treeMembers.filter((member) => {
      const haystack = [
        member.display_name,
        member.surname,
        member.middle_name,
        member.first_name,
        member.hometown,
        member.generation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(text);
    });
  }, [query, treeMembers]);

  if (loading) {
    return (
      <div className="member-portal-page">
        <section className="member-panel">
          <div className="member-empty">Đang tải cây gia phả...</div>
        </section>
      </div>
    );
  }

  return (
    <div className="member-portal-page">
      {error && <div className="member-alert is-error">{error}</div>}

      <section className="member-hero-panel">
        <div>
          <span className="member-kicker">Cây gia phả</span>
          <h1>{clanName}</h1>
          <p>Xem sơ đồ gia phả tương tác, phóng to thu nhỏ và chọn từng thành viên để xem chi tiết.</p>
        </div>
      </section>

      <div className="member-tree-layout">
        <section className="member-panel">
          {roots.length === 0 ? (
            <div className="member-empty">Chưa có dữ liệu cây gia phả để hiển thị.</div>
          ) : (
            <div className="usr-phado">
              <div className="usr-phado-frame">
                <header className="usr-phado-header">
                  <div className="usr-phado-ornament usr-phado-ornament--left" aria-hidden="true" />
                  <div className="usr-phado-titleBlock">
                    <div className="usr-phado-banner">GIA PHẢ</div>
                    <div className="usr-phado-clan">{String(clanName).trim().toUpperCase()}</div>
                  </div>
                  <div className="usr-phado-ornament usr-phado-ornament--right" aria-hidden="true" />
                </header>
                <div className="usr-phado-treeWrap usr-phado-treeWrap--bloodline">
                  <ul className="usr-phado-treeRoot">
                    {roots.map((root) => (
                      <FamilyTreeNode key={root.person.id} node={root} onSelectPerson={setSelectedPerson} />
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="member-panel member-tree-side">
          <div className="member-panel-header">
            <div>
              <h2>Tra cứu thành viên</h2>
              <p>{treeMembers.length} hồ sơ trong dòng họ.</p>
            </div>
          </div>
          <div className="member-form">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, quê quán, đời..." />
          </div>
          {filteredMembers.slice(0, 40).map((member) => (
            <button className="member-tree-person" type="button" key={member.id} onClick={() => setSelectedPerson(member)}>
              <strong>{personTreeLabel(member)}</strong>
              <span>Đời {member.generation || "chưa rõ"} · {member.hometown || "chưa cập nhật"}</span>
            </button>
          ))}
          {filteredMembers.length === 0 && <div className="member-empty">Không tìm thấy thành viên phù hợp.</div>}
        </aside>
      </div>

      {selectedPerson && (
        <div className="member-modal-backdrop" onClick={() => setSelectedPerson(null)}>
          <div className="member-modal" onClick={(event) => event.stopPropagation()}>
            <div className="member-modal-header">
              <h2>{personTreeLabel(selectedPerson)}</h2>
              <button className="member-modal-close" type="button" onClick={() => setSelectedPerson(null)}>
                ×
              </button>
            </div>
            <dl className="member-detail-list">
              <div>
                <dt>Đời</dt>
                <dd>{selectedPerson.generation || "Chưa cập nhật"}</dd>
              </div>
              <div>
                <dt>Quê quán</dt>
                <dd>{selectedPerson.hometown || "Chưa cập nhật"}</dd>
              </div>
              <div>
                <dt>Ngày sinh</dt>
                <dd>{formatDate(selectedPerson.birth_date)}</dd>
              </div>
              <div>
                <dt>Ngày mất</dt>
                <dd>{formatDate(selectedPerson.death_date)}</dd>
              </div>
              <div>
                <dt>Tiểu sử</dt>
                <dd>{selectedPerson.bio || "Chưa cập nhật"}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
