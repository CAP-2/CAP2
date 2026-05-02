import { useCallback, useEffect, useState } from "react";
import { getMemberDashboard, verifyTreeEditSession } from "../../api/memberService";
import FamilyTreeEditor from "../../components/PhadoFamilyTree/FamilyTreeEditor";
import { clearTreeEditSession, readTreeEditSession, saveTreeEditSession } from "../../services/treeEditSession";
import "../Member/MemberDashboard.css";

export default function FamilyTreePage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyStatus, setKeyStatus] = useState("");
  const [keyError, setKeyError] = useState("");
  const [permission, setPermission] = useState({
    canEdit: false,
    editScope: "none",
    allowedNodeIds: [],
    memberGeneration: null,
    allowedGenerations: [],
  });
  const [permissionExpiry, setPermissionExpiry] = useState("");

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

  const resetTemporaryPermission = useCallback((message = "") => {
    clearTreeEditSession();
    setPermission({
      canEdit: false,
      editScope: "none",
      allowedNodeIds: [],
      memberGeneration: null,
      allowedGenerations: [],
    });
    setPermissionExpiry("");
    if (message) setKeyStatus(message);
  }, []);

  const activateTemporaryPermission = useCallback(
    async (rawKey, options = {}) => {
      const key = String(rawKey || "").trim();
      const silent = options.silent === true;
      if (!key) {
        setKeyError("Vui lòng nhập temporary edit key.");
        return;
      }

      setKeySaving(true);
      if (!silent) {
        setKeyError("");
        setKeyStatus("");
      }

      try {
        const response = await verifyTreeEditSession(key, { activate: !silent });
        saveTreeEditSession({ key, expiresAt: response.expires_at });
        setPermission({
          canEdit: true,
          editScope: "limited",
          allowedNodeIds: Array.isArray(response.allowed_node_ids) ? response.allowed_node_ids : [],
          memberGeneration: response.member_generation ?? null,
          allowedGenerations: Array.isArray(response.allowed_generations) ? response.allowed_generations : [],
        });
        setPermissionExpiry(response.expires_at || "");
        setKeyInput(key);
        setKeyStatus("Bạn có quyền chỉnh sửa tạm thời đến khi temporary edit key hết hạn. Phạm vi: đời hiện tại, trên 1 đời và dưới 1 đời.");
        setKeyError("");
      } catch (err) {
        resetTemporaryPermission("");
        setKeyError(err?.message || "Temporary edit key không hợp lệ hoặc đã hết hạn.");
      } finally {
        setKeySaving(false);
      }
    },
    [resetTemporaryPermission],
  );

  useEffect(() => {
    const session = readTreeEditSession();
    if (!session?.key) return;
    setKeyInput(session.key);
    activateTemporaryPermission(session.key, { silent: true });
  }, [activateTemporaryPermission]);

  useEffect(() => {
    if (!permissionExpiry) return undefined;

    const syncExpiry = () => {
      if (Date.parse(permissionExpiry) <= Date.now()) {
        resetTemporaryPermission("Temporary edit key đã hết hạn. Cây gia phả đã quay về chế độ chỉ xem.");
      }
    };

    syncExpiry();
    const timer = window.setInterval(syncExpiry, 1000);
    return () => window.clearInterval(timer);
  }, [permissionExpiry, resetTemporaryPermission]);

  const treeMembers = Array.isArray(dashboard?.treeMembers) ? dashboard.treeMembers : [];
  const families = Array.isArray(dashboard?.families) ? dashboard.families : [];
  const children = Array.isArray(dashboard?.children) ? dashboard.children : [];
  const clan = dashboard?.clan || {};
  const clanName = clan?.clan_name || "Gia phả";

  const remainingMs = permissionExpiry ? Math.max(0, Date.parse(permissionExpiry) - Date.now()) : 0;
  const remainingText = permissionExpiry
    ? `${Math.floor(remainingMs / 60000)}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0")}`
    : "";
  const generationScopeText = permission.allowedGenerations?.length
    ? permission.allowedGenerations.map((generation) => `đời ${generation}`).join(", ")
    : "đời hiện tại ±1";

  const renderTreeInfoPanel = () => (
    <aside className="member-panel member-tree-side member-tree-side--compact">
      <div className="member-panel-header">
        <div>
          <h2>Thông tin cây</h2>
          <p>Member được xem đầy đủ và chỉ sửa khi có temporary edit key.</p>
        </div>
      </div>
      <div className="member-tree-keyCard">
        <label className="member-label">
          Temporary edit key
          <input value={keyInput} onChange={(event) => setKeyInput(event.target.value)} placeholder="Nhập key do manager cấp" />
        </label>
        <div className="member-tree-keyActions">
          <button className="member-btn member-btn-primary" type="button" onClick={() => activateTemporaryPermission(keyInput)} disabled={keySaving || !keyInput.trim()}>
            {keySaving ? "Đang xác thực..." : "Xác thực key"}
          </button>
          {permission.canEdit ? (
            <button className="member-btn member-btn-ghost" type="button" onClick={() => resetTemporaryPermission("Đã tắt quyền chỉnh sửa tạm thời.")}>
              Tắt quyền tạm thời
            </button>
          ) : null}
        </div>
        {permission.canEdit ? (
          <div className="member-tree-keyMeta">
            <strong>Đang bật editable mode</strong>
            <span>Đời của bạn: {permission.memberGeneration ? `đời ${permission.memberGeneration}` : "chưa xác định"}</span>
            <span>Phạm vi: {generationScopeText}</span>
            <span>Còn lại: {remainingText}</span>
          </div>
        ) : (
          <div className="member-tree-keyMeta">
            <span>Không lưu key vĩnh viễn. Quyền chỉnh sửa chỉ có hiệu lực đến thời điểm hết hạn của temporary edit key.</span>
          </div>
        )}
      </div>
      <div className="member-tree-summary">
        <div>
          <strong>{treeMembers.length}</strong>
          <span>Thành viên</span>
        </div>
        <div>
          <strong>{families.length}</strong>
          <span>Gia đình</span>
        </div>
        <div>
          <strong>{children.length}</strong>
          <span>Liên kết con</span>
        </div>
      </div>
      <div className="member-tree-note">
        Chọn một người trên cây để mở thông tin chi tiết. Khi có temporary edit key hợp lệ, bạn chỉ sửa được node thuộc đời của mình, trên 1 đời và dưới 1 đời.
      </div>
    </aside>
  );

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
      {keyError && <div className="member-alert is-error">{keyError}</div>}
      {keyStatus && !keyError ? <div className="member-alert is-success">{keyStatus}</div> : null}

      <section className="member-hero-panel">
        <div>
          <span className="member-kicker">Cây gia phả</span>
          <h1>{clanName}</h1>
          <p>Xem toàn bộ cây gia phả của dòng họ. Thành viên chỉ có quyền xem, phóng to thu nhỏ và xem chi tiết từng người.</p>
        </div>
      </section>

      <div className="member-tree-toolbar">
        <button className="member-btn member-btn-ghost" type="button" onClick={loadTree} disabled={loading}>
          Tải lại
        </button>
        <div className="member-tree-info-popover">
          <button
            className={`member-btn member-btn-ghost ${isInfoPanelOpen ? "is-active" : ""}`}
            type="button"
            onClick={() => setIsInfoPanelOpen((value) => !value)}
          >
            Thông tin cây
          </button>
          {isInfoPanelOpen ? renderTreeInfoPanel() : null}
        </div>
      </div>

      <div className="member-tree-layout member-tree-layout--viewer">
        <section className="member-panel member-tree-main">
          {treeMembers.length === 0 ? (
            <div className="member-empty">Chưa có dữ liệu cây gia phả để hiển thị.</div>
          ) : (
            <div className="member-tree-editorWrap">
              <FamilyTreeEditor
                clan={clan}
                people={treeMembers}
                families={families}
                children={children}
                layoutSettings={dashboard?.layoutSettings}
                loading={loading}
                permission={permission}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
