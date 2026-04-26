import { useCallback, useEffect, useState } from "react";
import { getManagerTree } from "../../api/managerService";
import FamilyTree from "../../components/common/FamilyTree";
import { mapTreeNode } from "./managerData";
import "./manager.css";

export default function GenealogySection() {
  const [treeData, setTreeData] = useState(null);
  const [people, setPeople] = useState([]);
  const [clan, setClan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState("");

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getManagerTree();
      const roots = data.familyTree?.roots || [];
      const mappedRoots = roots.map(mapTreeNode);
      const nextTree =
        mappedRoots.length === 1
          ? mappedRoots[0]
          : mappedRoots.length > 1
            ? {
                id: "clan-root",
                name: data.clan?.clan_name || "Dòng họ",
                title: `${mappedRoots.length} nhánh gốc`,
                generation: `${data.treeMembers?.length || 0} thành viên`,
                children: mappedRoots,
              }
            : null;
      setTreeData(nextTree);
      setPeople(Array.isArray(data.treeMembers) ? data.treeMembers : []);
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

  return (
    <section className="manager-genealogy-page">
      <div className="manager-data-header">
        <div>
          <h2>{clan?.clan_name || "Cây gia phả"}</h2>
          <p>Toàn bộ cây, thành viên và quan hệ được lấy từ bảng people, families và children.</p>
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
            <h2>Cây gia phả từ database</h2>
            <span>{people.length} thành viên</span>
          </div>
          <div className="tree-container">
            {loading ? (
              <div className="mgr-empty">Đang tải cây gia phả...</div>
            ) : treeData ? (
              <FamilyTree data={treeData} isLoggedIn />
            ) : (
              <div className="mgr-empty">Database chưa có người nào trong dòng họ này.</div>
            )}
          </div>
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
            <div className="tree-container tree-container--fullscreen">
              {loading ? (
                <div className="mgr-empty">Đang tải cây gia phả...</div>
              ) : treeData ? (
                <FamilyTree data={treeData} isLoggedIn />
              ) : (
                <div className="mgr-empty">Database chưa có người nào trong dòng họ này.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
