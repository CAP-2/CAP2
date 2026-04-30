import { useEffect, useMemo, useState, useCallback } from "react";
import {
    createAdminClan,
    deleteAdminClan,
    getAdminClans,
    getAdminClanTree,
    updateAdminClan,
} from "../../api/adminService";
import FamilyTreeEditor from "../../components/PhadoFamilyTree/FamilyTreeEditor";
import "./GenealogyManagement.css";

const emptyClanForm = {
    clan_name: "",
    history: "",
    hall_address: "",
    manager_email: "",
    manager_password: "",
    manager_surname: "",
    manager_middle_name: "",
    manager_first_name: "",
};

export default function GenealogyManagement() {
    const [clans, setClans] = useState([]);
    const [selectedClanId, setSelectedClanId] = useState(null);
    const [treeData, setTreeData] = useState({ people: [], families: [], children: [] });
    const [clanInfo, setClanInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [treeLoading, setTreeLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [modalMode, setModalMode] = useState(null);
    const [clanForm, setClanForm] = useState(emptyClanForm);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    const fetchClans = useCallback(async (preferredClanId = null) => {
        setLoading(true);
        try {
            const res = await getAdminClans();
            const nextClans = res.clans || [];
            setClans(nextClans);
            const currentStillExists = nextClans.some(clan => clan.id === selectedClanId);
            const nextSelectedId = preferredClanId || (currentStillExists ? selectedClanId : nextClans[0]?.id || null);
            setSelectedClanId(nextSelectedId);
            if (!nextSelectedId) {
                setClanInfo(null);
                setTreeData({ people: [], families: [], children: [] });
            }
        } catch (err) {
            console.error(err);
            alert(err.message || "Không tải được danh sách dòng họ");
        } finally {
            setLoading(false);
        }
    }, [selectedClanId]);

    useEffect(() => {
        fetchClans();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchTree = useCallback(async () => {
        if (!selectedClanId) return;
        setTreeLoading(true);
        try {
            const res = await getAdminClanTree(selectedClanId);
            setTreeData({
                people: res.treeMembers || [],
                families: res.families || [],
                children: res.children || []
            });
            setClanInfo(res.clan);
        } catch (err) {
            console.error(err);
            setClanInfo(null);
            setTreeData({ people: [], families: [], children: [] });
        } finally {
            setTreeLoading(false);
        }
    }, [selectedClanId]);

    useEffect(() => {
        fetchTree();
    }, [fetchTree]);

    const filteredClans = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) return clans;
        return clans.filter(clan =>
            String(clan.clan_name || "").toLowerCase().includes(keyword)
            || String(clan.owner_name || "").toLowerCase().includes(keyword)
        );
    }, [clans, searchTerm]);

    const selectedClan = useMemo(
        () => clans.find(clan => clan.id === selectedClanId) || null,
        [clans, selectedClanId]
    );

    const openCreateModal = () => {
        setModalMode("create");
        setClanForm(emptyClanForm);
        setFormError("");
    };

    const openEditModal = (clan) => {
        setModalMode("edit");
        setClanForm({
            ...emptyClanForm,
            clan_name: clan?.clan_name || "",
            history: clan?.history || "",
            hall_address: clan?.hall_address || "",
        });
        setFormError("");
    };

    const closeModal = () => {
        if (saving) return;
        setModalMode(null);
        setFormError("");
    };

    const handleSubmitClan = async (event) => {
        event.preventDefault();
        const clanName = clanForm.clan_name.trim();
        if (!clanName) {
            setFormError("Vui lòng nhập tên dòng họ.");
            return;
        }
        if (modalMode === "create") {
            if (!clanForm.manager_email.trim() || !clanForm.manager_password.trim()) {
                setFormError("Vui lòng nhập email và mật khẩu tài khoản Manager phụ trách dòng họ.");
                return;
            }
            if (clanForm.manager_password.trim().length < 6) {
                setFormError("Mật khẩu Manager tối thiểu 6 ký tự.");
                return;
            }
            if (!clanForm.manager_surname.trim() && !clanForm.manager_first_name.trim()) {
                setFormError("Vui lòng nhập ít nhất họ hoặc tên của Manager phụ trách.");
                return;
            }
        }
        setSaving(true);
        setFormError("");
        try {
            if (modalMode === "edit" && selectedClanId) {
                await updateAdminClan(selectedClanId, { ...clanForm, clan_name: clanName });
                await fetchClans(selectedClanId);
            } else {
                const res = await createAdminClan({ ...clanForm, clan_name: clanName });
                await fetchClans(res.clan?.id || null);
            }
            setModalMode(null);
        } catch (err) {
            setFormError(err.message || "Thao tác thất bại.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClan = async (clan) => {
        if (!clan?.id) return;
        const ok = window.confirm(`Xóa dòng họ "${clan.clan_name}"? Toàn bộ phả hệ, thành viên, bài viết, sự kiện và dữ liệu liên quan của dòng họ này sẽ bị xóa.`);
        if (!ok) return;
        try {
            await deleteAdminClan(clan.id);
            await fetchClans();
        } catch (err) {
            alert(err.message || "Xóa dòng họ thất bại");
        }
    };

    if (loading && clans.length === 0) return <div className="loading-container"><div className="loader"></div><p>Đang tải danh sách dòng họ...</p></div>;

    return (
        <div className="genealogy-management premium-page">
            <aside className="clan-sidebar">
                <div className="sidebar-header">
                    <h3>Danh sách Dòng họ</h3>
                    <button className="add-clan-btn" onClick={openCreateModal} type="button">
                        <span className="material-symbols-outlined">add</span>
                        Thêm dòng họ
                    </button>
                </div>

                <div className="clan-search-box">
                    <span className="material-symbols-outlined">search</span>
                    <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Tìm kiếm dòng họ..."
                    />
                    {searchTerm && (
                        <button type="button" onClick={() => setSearchTerm("")} aria-label="Xóa tìm kiếm">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>

                <div className="clan-list">
                    {filteredClans.length === 0 ? (
                        <div className="empty-clan-list">Không tìm thấy dòng họ phù hợp.</div>
                    ) : filteredClans.map(clan => (
                        <div
                            key={clan.id}
                            className={`clan-item ${selectedClanId === clan.id ? 'active' : ''}`}
                            onClick={() => setSelectedClanId(clan.id)}
                        >
                            <span className="material-symbols-outlined">account_balance</span>
                            <div className="clan-info">
                                <strong>{clan.clan_name}</strong>
                                <span>{clan.member_count} thành viên · {clan.manager_count || 0} manager</span>
                                {clan.owner_name ? <small>QL: {clan.owner_name}</small> : null}
                            </div>
                            <div className="clan-actions" onClick={(event) => event.stopPropagation()}>
                                <button type="button" title="Sửa dòng họ" onClick={() => { setSelectedClanId(clan.id); openEditModal(clan); }}>
                                    <span className="material-symbols-outlined">edit</span>
                                </button>
                                <button type="button" className="danger" title="Xóa dòng họ" onClick={() => handleDeleteClan(clan)}>
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="tree-view-main">
                <div className="tree-canvas-container">
                    {selectedClan ? (
                        <FamilyTreeEditor
                            clan={clanInfo}
                            people={treeData.people}
                            families={treeData.families}
                            children={treeData.children}
                            loading={treeLoading}
                            onReload={fetchTree}
                        />
                    ) : (
                        <div className="empty-tree-state">Chưa có dòng họ nào. Hãy bấm “Thêm dòng họ” để tạo phả hệ mới.</div>
                    )}
                </div>
            </main>

            {modalMode && (
                <div className="clan-modal-backdrop" onClick={closeModal}>
                    <form className="clan-modal" onSubmit={handleSubmitClan} onClick={(event) => event.stopPropagation()}>
                        <button type="button" className="close-modal" onClick={closeModal}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                        <h3>{modalMode === "edit" ? "Sửa dòng họ" : "Thêm dòng họ"}</h3>
                        <label>
                            Tên dòng họ <b>*</b>
                            <input
                                value={clanForm.clan_name}
                                onChange={(event) => setClanForm(prev => ({ ...prev, clan_name: event.target.value }))}
                                placeholder="Ví dụ: Hà Văn"
                                autoFocus
                            />
                        </label>
                        <label>
                            Lịch sử dòng họ
                            <textarea
                                value={clanForm.history}
                                onChange={(event) => setClanForm(prev => ({ ...prev, history: event.target.value }))}
                                placeholder="Nhập mô tả/lịch sử dòng họ nếu có"
                                rows={4}
                            />
                        </label>
                        <label>
                            Địa chỉ nhà thờ họ
                            <input
                                value={clanForm.hall_address}
                                onChange={(event) => setClanForm(prev => ({ ...prev, hall_address: event.target.value }))}
                                placeholder="Nhập địa chỉ nếu có"
                            />
                        </label>
                        {modalMode === "create" && (
                            <div className="manager-account-section">
                                <div className="manager-section-title">
                                    <span className="material-symbols-outlined">manage_accounts</span>
                                    <div>
                                        <strong>Tài khoản Manager phụ trách</strong>
                                        <p>Manager này sẽ được gán quyền quản lý dòng họ vừa tạo và có quyền thêm người vào cây gia phả.</p>
                                    </div>
                                </div>
                                <label>
                                    Email Manager <b>*</b>
                                    <input
                                        type="email"
                                        value={clanForm.manager_email}
                                        onChange={(event) => setClanForm(prev => ({ ...prev, manager_email: event.target.value }))}
                                        placeholder="manager@example.com"
                                    />
                                </label>
                                <label>
                                    Mật khẩu Manager <b>*</b>
                                    <input
                                        type="password"
                                        value={clanForm.manager_password}
                                        onChange={(event) => setClanForm(prev => ({ ...prev, manager_password: event.target.value }))}
                                        placeholder="Tối thiểu 6 ký tự"
                                        autoComplete="new-password"
                                    />
                                </label>
                                <div className="manager-name-grid">
                                    <label>
                                        Họ Manager <b>*</b>
                                        <input
                                            value={clanForm.manager_surname}
                                            onChange={(event) => setClanForm(prev => ({ ...prev, manager_surname: event.target.value }))}
                                            placeholder="Ví dụ: Nguyễn"
                                        />
                                    </label>
                                    <label>
                                        Tên đệm
                                        <input
                                            value={clanForm.manager_middle_name}
                                            onChange={(event) => setClanForm(prev => ({ ...prev, manager_middle_name: event.target.value }))}
                                            placeholder="Ví dụ: Văn"
                                        />
                                    </label>
                                    <label>
                                        Tên Manager <b>*</b>
                                        <input
                                            value={clanForm.manager_first_name}
                                            onChange={(event) => setClanForm(prev => ({ ...prev, manager_first_name: event.target.value }))}
                                            placeholder="Ví dụ: An"
                                        />
                                    </label>
                                </div>
                            </div>
                        )}
                        {formError && <p className="clan-form-error">{formError}</p>}
                        <div className="clan-modal-actions">
                            <button type="button" className="secondary" onClick={closeModal} disabled={saving}>Hủy</button>
                            <button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
