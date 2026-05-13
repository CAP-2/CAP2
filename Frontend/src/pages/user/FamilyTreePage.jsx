import { useCallback, useEffect, useRef, useState } from "react";
import { getMemberDashboard, verifyTreeEditSession } from "../../api/memberService";
import FamilyTreeEditor from "../../components/PhadoFamilyTree/FamilyTreeEditor";
import { getSocket } from "../../services/socket";
import { clearTreeEditSession, readTreeEditSession, saveTreeEditSession } from "../../services/treeEditSession";
import "../Member/MemberDashboard.css";

export default function FamilyTreePage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [isClanInfoOpen, setIsClanInfoOpen] = useState(false);
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
  const treeReloadTimerRef = useRef(null);

  const resolvePermissionExpiry = useCallback((response) => {
    const expiresInMs = Number(response?.expires_in_ms);
    if (Number.isFinite(expiresInMs) && expiresInMs > 0) {
      return new Date(Date.now() + expiresInMs).toISOString();
    }

    const expiresAt = typeof response?.expires_at === "string" ? response.expires_at : "";
    const expiresAtTime = Date.parse(expiresAt);
    return Number.isFinite(expiresAtTime) && expiresAtTime > Date.now() ? expiresAt : "";
  }, []);

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
  useEffect(() => {
  let timer = null;
  let cleanup = null;

  const attachTreeSocket = () => {
    const socket = getSocket();

    if (!socket) {
      return false;
    }

    const handleTreeUpdated = (payload) => {
      console.log("Member tree realtime tree_updated received:", payload);

      if (treeReloadTimerRef.current) {
        window.clearTimeout(treeReloadTimerRef.current);
      }

      treeReloadTimerRef.current = window.setTimeout(() => {
        loadTree();
      }, 500);
    };

    socket.on("tree_updated", handleTreeUpdated);

    cleanup = () => {
      socket.off("tree_updated", handleTreeUpdated);
    };

    return true;
  };

  if (!attachTreeSocket()) {
    timer = window.setInterval(() => {
      if (attachTreeSocket()) {
        window.clearInterval(timer);
      }
    }, 500);
  }

  return () => {
    if (timer) {
      window.clearInterval(timer);
    }

    if (treeReloadTimerRef.current) {
      window.clearTimeout(treeReloadTimerRef.current);
    }

    if (cleanup) {
      cleanup();
    }
  };
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
        const expiresAt = resolvePermissionExpiry(response);
        if (!expiresAt) {
          resetTemporaryPermission("");
          setKeyError("Temporary edit key đã hết hạn. Vui lòng xin manager tạo key mới.");
          return;
        }
        saveTreeEditSession({ key, expiresAt });
        setPermission({
          canEdit: true,
          editScope: "limited",
          allowedNodeIds: Array.isArray(response.allowed_node_ids) ? response.allowed_node_ids : [],
          memberGeneration: response.member_generation ?? null,
          allowedGenerations: Array.isArray(response.allowed_generations) ? response.allowed_generations : [],
        });
        setPermissionExpiry(expiresAt);
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
    [resetTemporaryPermission, resolvePermissionExpiry],
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

  const renderClanInfoModal = () => (
    <div className="member-clan-modalOverlay" role="dialog" aria-modal="true">
      <div className="member-clan-modal">
        <div className="member-clan-modalHead">
          <div>
            <span>Thông tin dòng họ</span>
            <h2>{clanName}</h2>
            <p>Thành viên chỉ được xem thông tin dòng họ do quản trị viên cập nhật.</p>
            <p className="member-clan-dbId">ID dòng họ trong database: <strong>{clan?.id ?? clan?.clan_id ?? "Chưa có"}</strong></p>
          </div>
          <button type="button" onClick={() => setIsClanInfoOpen(false)} aria-label="Đóng">×</button>
        </div>
        <div className="member-clan-infoGrid">
          <article>
            <span>Lịch sử dòng họ</span>
            <p>{clan?.history || "Chưa cập nhật lịch sử dòng họ."}</p>
          </article>
          <article>
            <span>Nhà thờ / từ đường</span>
            <p>{clan?.hall_address || "Chưa cập nhật địa chỉ nhà thờ hoặc từ đường."}</p>
          </article>
        </div>
        <div className="member-clan-stats member-clan-stats--four">
          <div><strong>{clan?.id ?? clan?.clan_id ?? "-"}</strong><span>ID dòng họ</span></div>
          <div><strong>{treeMembers.length}</strong><span>Thành viên</span></div>
          <div><strong>{families.length}</strong><span>Gia đình</span></div>
          <div><strong>{children.length}</strong><span>Liên kết con</span></div>
        </div>
        <div className="member-clan-actions">
          <button className="member-btn member-btn-primary" type="button" onClick={() => setIsClanInfoOpen(false)}>Đã hiểu</button>
        </div>
      </div>
    </div>
  );

  const renderTreeInfoPanel = () => (
    <aside className="member-panel member-tree-side member-tree-side--compact">
      <div className="member-panel-header">
        <div>
          <h2>Thông tin cây</h2>
          <p>Thành viên chỉ được xem cây gia phả, phóng to/thu nhỏ, toàn màn hình và xem chi tiết từng người.</p>
        </div>
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
        Bấm vào một người trên cây để xem thông tin chi tiết. Các thao tác thêm, sửa, xóa và chỉnh quan hệ chỉ dành cho quản trị viên dòng họ.
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

      {isClanInfoOpen ? renderClanInfoModal() : null}

      <div className="member-tree-toolbar">
        <button className="member-btn member-btn-ghost" type="button" onClick={loadTree} disabled={loading}>
          Tải lại
        </button>
        <button className="member-btn member-btn-ghost" type="button" onClick={() => setIsClanInfoOpen(true)}>
          Thông tin dòng họ
        </button>
        <div className="member-tree-keyBox">
        <input
          className="member-tree-keyInput"
          type="text"
          placeholder="Nhập temporary edit key"
          value={keyInput}
          disabled={keySaving || permission.canEdit}
          onChange={(e) => setKeyInput(e.target.value)}
        />

        {!permission.canEdit ? (
          <button
            className="member-btn member-btn-primary"
            type="button"
            disabled={keySaving || !keyInput.trim()}
            onClick={() => activateTemporaryPermission(keyInput)}
          >
            {keySaving ? "Đang kiểm tra..." : "Mở quyền sửa"}
          </button>
        ) : (
          <button
            className="member-btn member-btn-ghost"
            type="button"
            onClick={() => resetTemporaryPermission("Đã tắt quyền chỉnh sửa tạm thời.")}
          >
            Tắt quyền sửa
          </button>
        )}

        {permission.canEdit && remainingText ? (
          <span className="member-tree-keyStatus">
            Còn hạn: {remainingText}
          </span>
        ) : null}
      </div>
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
                readOnly={!permission.canEdit}
                editPermission={permission}
                onReload={loadTree}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
