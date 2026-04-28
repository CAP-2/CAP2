import { useCallback, useEffect, useMemo, useState } from "react";
import { createTreeEditKeyAPI, getActiveTreeEditKeysAPI, getManagerTree } from "../../api/managerService";
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
  const [isKeyPanelOpen, setIsKeyPanelOpen] = useState(false);
  const [selectedMemberAccountIds, setSelectedMemberAccountIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [generatedKeys, setGeneratedKeys] = useState([]);
  const [activeKeys, setActiveKeys] = useState([]);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [activeKeysLoading, setActiveKeysLoading] = useState(false);

  const formatPersonName = (person) =>
    person?.display_name ||
    [person?.surname, person?.middle_name, person?.first_name].filter(Boolean).join(" ").trim() ||
    `Member #${person?.account_id}`;

  const normalizeSearchText = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const formatDateTime = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "1 giờ từ lúc tạo");

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

  const loadActiveKeys = useCallback(async () => {
    if (!clan?.id) return;
    setActiveKeysLoading(true);
    try {
      const response = await getActiveTreeEditKeysAPI(clan.id);
      const keys = Array.isArray(response?.keys) ? response.keys : [];
      setActiveKeys(
        keys.sort((a, b) => {
          const bTime = new Date(b.created_at || b.expires_at || 0).getTime();
          const aTime = new Date(a.created_at || a.expires_at || 0).getTime();
          return bTime - aTime;
        }),
      );
    } catch (err) {
      setKeyError(err?.message || "Không thể tải danh sách key còn hiệu lực.");
    } finally {
      setActiveKeysLoading(false);
    }
  }, [clan?.id]);

  useEffect(() => {
    loadActiveKeys();
  }, [loadActiveKeys]);

  const editableMembers = useMemo(
    () =>
      people.filter(
        (person) =>
          Number(person.account_id) > 0 &&
          Number(person.role_id) === 3 &&
          String(person.account_status || "").toLowerCase() === "active",
      ),
    [people],
  );

  const filteredEditableMembers = useMemo(() => {
    const keyword = normalizeSearchText(memberSearch);
    if (!keyword) return editableMembers;
    return editableMembers.filter((person) =>
      normalizeSearchText(`${formatPersonName(person)} ${person.account_id} ${person.account_email || ""}`).includes(keyword),
    );
  }, [editableMembers, memberSearch]);

  useEffect(() => {
    setSelectedMemberAccountIds((current) =>
      current.filter((accountId) => editableMembers.some((person) => Number(person.account_id) === Number(accountId))),
    );
  }, [editableMembers]);

  const selectedCount = selectedMemberAccountIds.length;

  const toggleMemberSelection = (accountId) => {
    const id = Number(accountId);
    setSelectedMemberAccountIds((current) =>
      current.some((item) => Number(item) === id) ? current.filter((item) => Number(item) !== id) : [...current, id],
    );
  };

  const selectFilteredMembers = () => {
    const ids = filteredEditableMembers.map((person) => Number(person.account_id)).filter((id) => Number.isFinite(id));
    setSelectedMemberAccountIds((current) => [...new Set([...current, ...ids])]);
  };

  const clearSelectedMembers = () => setSelectedMemberAccountIds([]);

  const handleGenerateKey = async () => {
    if (!selectedMemberAccountIds.length) {
      setKeyError("Vui lòng chọn ít nhất một member cần cấp quyền.");
      return;
    }

    setKeySaving(true);
    setKeyError("");
    try {
      const response = await createTreeEditKeyAPI(selectedMemberAccountIds);
      const keys = (Array.isArray(response?.keys) ? response.keys : response?.key ? [response] : []).sort((a, b) => {
        const bTime = new Date(b.created_at || b.expires_at || 0).getTime();
        const aTime = new Date(a.created_at || a.expires_at || 0).getTime();
        return bTime - aTime;
      });
      setGeneratedKeys(keys);
      setKeyModalOpen(true);
      await loadActiveKeys();
    } catch (err) {
      setKeyError(err?.message || "Không thể tạo temporary edit key.");
    } finally {
      setKeySaving(false);
    }
  };

  const copyKey = async (key) => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      setKeyError("Không thể copy key tự động. Hãy copy thủ công.");
    }
  };

  const copyGeneratedKeys = async () => {
    const text = generatedKeys
      .filter((item) => item?.key)
      .map((item) => `${item.member_name || `Account #${item.member_account_id}`}: ${item.key}`)
      .join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setKeyError("Không thể copy danh sách key tự động. Hãy copy thủ công.");
    }
  };

  const renderKeyList = (items, emptyText) =>
    items.length === 0 ? (
      <div className="tree-key-empty">{emptyText}</div>
    ) : (
      <div className="tree-key-list">
        {items.map((item) => (
          <div className="tree-key-row" key={item.id || `${item.member_account_id}-${item.created_at}-${item.key}`}>
            <div className="tree-key-row-main">
              <strong>{item.member_name || "Member"}</strong>
              <span>Tạo: {formatDateTime(item.created_at)}</span>
              <span>Hết hạn: {formatDateTime(item.expires_at)}</span>
            </div>
            <code>{item.key || "Key cũ không thể hiển thị"}</code>
            {item.key ? (
              <button className="mgr-btnGhost" type="button" onClick={() => copyKey(item.key)}>
                Copy
              </button>
            ) : null}
          </div>
        ))}
      </div>
    );

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

  const renderTemporaryKeyPanel = () => (
    <div className="panel-card tree-key-panel tree-key-panel--compact">
      <div className="panel-header">
        <h2>Temporary edit key</h2>
        <span>Hiệu lực 1 giờ</span>
      </div>

      <div className="tree-key-bulk">
        <label className="tree-key-field">
          <span>Tìm member theo tên</span>
          <input
            className="mgr-field"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="Nhập tên, email hoặc account id"
            disabled={keySaving || !editableMembers.length}
          />
        </label>

        <div className="tree-key-toolbar">
          <span>{selectedCount} member đã chọn</span>
          <button className="mgr-btnGhost" type="button" onClick={selectFilteredMembers} disabled={keySaving || !filteredEditableMembers.length}>
            Chọn kết quả lọc
          </button>
          <button className="mgr-btnGhost" type="button" onClick={clearSelectedMembers} disabled={keySaving || !selectedCount}>
            Bỏ chọn
          </button>
          <button className="mgr-btnPrimary" type="button" onClick={handleGenerateKey} disabled={keySaving || !selectedCount}>
            {keySaving ? "Đang tạo..." : `Generate ${selectedCount || ""} edit key`}
          </button>
        </div>

        <div className="tree-key-member-list">
          {filteredEditableMembers.length === 0 ? (
            <div className="tree-key-empty">Không có member phù hợp</div>
          ) : (
            filteredEditableMembers.map((person) => {
              const checked = selectedMemberAccountIds.some((accountId) => Number(accountId) === Number(person.account_id));
              return (
                <label className={`tree-key-member ${checked ? "is-selected" : ""}`} key={person.account_id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMemberSelection(person.account_id)}
                    disabled={keySaving}
                  />
                  <span>
                    <strong>{formatPersonName(person)}</strong>
                    <small>account #{person.account_id}</small>
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {keyError ? <div className="manager-inline-error">{keyError}</div> : null}

      <div className="tree-key-active">
        <div className="tree-key-section-head">
          <strong>Key còn hiệu lực</strong>
          <button className="mgr-btnGhost" type="button" onClick={loadActiveKeys} disabled={activeKeysLoading}>
            {activeKeysLoading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
        {renderKeyList(activeKeys, "Chưa có key còn hiệu lực")}
      </div>
    </div>
  );

  return (
    <section className="manager-genealogy-page">
      <div className="manager-data-header">
        <div>
          <h2>{clan?.clan_name || "Cây gia phả"}</h2>
          <p>Quan hệ cha, mẹ, vợ/chồng và con được lấy trực tiếp từ bảng people, families và children.</p>
        </div>
        <div className="tree-panel-actions">
          <div className="tree-action-popover">
            <button
              className={`mgr-btnGhost ${isKeyPanelOpen ? "is-active" : ""}`}
              type="button"
              onClick={() => setIsKeyPanelOpen((value) => !value)}
            >
              Temporary edit key
            </button>
            {isKeyPanelOpen ? renderTemporaryKeyPanel() : null}
          </div>
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

      {keyModalOpen && (
        <div className="tree-key-modal-overlay" role="dialog" aria-modal="true">
          <div className="tree-key-modal">
            <div className="tree-key-modal-head">
              <div>
                <h2>Key vừa tạo</h2>
                <span>{generatedKeys.length} key mới, sắp xếp theo thời gian tạo mới nhất</span>
              </div>
              <button className="mgr-modalClose" type="button" onClick={() => setKeyModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="tree-key-modal-actions">
              <button className="mgr-btnPrimary" type="button" onClick={copyGeneratedKeys} disabled={!generatedKeys.length}>
                Copy tất cả key mới
              </button>
              <button className="mgr-btnGhost" type="button" onClick={loadActiveKeys} disabled={activeKeysLoading}>
                {activeKeysLoading ? "Đang tải..." : "Cập nhật key còn hiệu lực"}
              </button>
            </div>
            {renderKeyList(generatedKeys, "Không có key mới")}
            <div className="tree-key-modal-section">
              <div className="tree-key-section-head">
                <strong>Key còn hiệu lực</strong>
                <span>Mới nhất đến lâu nhất</span>
              </div>
              {renderKeyList(activeKeys, "Chưa có key còn hiệu lực")}
            </div>
          </div>
        </div>
      )}

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
