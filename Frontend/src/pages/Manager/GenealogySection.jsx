import { useCallback, useEffect, useState } from "react";
import { getManagerTree } from "../../api/managerService";
import FamilyTreeEditor from "../../components/PhadoFamilyTree/FamilyTreeEditor";
import "./manager.css";

export default function GenealogySection() {
  const [people, setPeople] = useState([]);
  const [families, setFamilies] = useState([]);
  const [children, setChildren] = useState([]);
  const [clan, setClan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState("");

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getManagerTree();
      setPeople(Array.isArray(data.treeMembers) ? data.treeMembers : []);
      setFamilies(Array.isArray(data.families) ? data.families : []);
      setChildren(Array.isArray(data.children) ? data.children : []);
      setClan(data.clan || null);
    } catch (err) {
      setError(err?.message || "Không thể tải cây gia phả từ database");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const renderEditor = () => (
    <FamilyTreeEditor
      clan={clan}
      people={people}
      families={families}
      children={children}
      loading={loading}
      onReload={loadTree}
    />
  );

  return (
    <section className="manager-genealogy-page">
      <div className="manager-data-header">
        <div>
          <h2>{clan?.clan_name || "Cây gia phả"}</h2>
          <p>Quan hệ cha, mẹ, vợ/chồng và con được lấy trực tiếp từ bảng people, families và children.</p>
        </div>
        <div className="tree-panel-actions">
          <button className="mgr-btnGhost" type="button" onClick={loadTree} disabled={loading}>
            Tải lại
          </button>
          <button className="mgr-btnPrimary" type="button" onClick={() => setIsFullscreen(true)}>
            Phóng to
          </button>
        </div>
      </div>

      {error && <div className="manager-inline-error">{error}</div>}

      <div className="management-grid management-grid--single">
        <div className="panel-card tree-preview-panel">
          <div className="panel-header">
            <h2>Trình chỉnh sửa cây gia phả</h2>
            <span>{people.length} thành viên</span>
          </div>
          <div className="tree-container">{renderEditor()}</div>
        </div>
      </div>

      {isFullscreen && (
        <div className="tree-fullscreen-overlay" role="dialog" aria-modal="true">
          <div className="tree-fullscreen-panel">
            <div className="panel-header">
              <h2>{clan?.clan_name || "Cây gia phả"}</h2>
              <button className="mgr-btnGhost" type="button" onClick={() => setIsFullscreen(false)}>
                Thu nhỏ
              </button>
            </div>
            <div className="tree-container tree-container--fullscreen">{renderEditor()}</div>
          </div>
        </div>
      )}
    </section>
  );
}
