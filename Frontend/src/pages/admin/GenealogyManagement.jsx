import { useEffect, useState } from "react";
import FamilyTree from "../../components/common/FamilyTree";
import { getAdminClans, getAdminClanTree } from "../../api/adminService";
import "./GenealogyManagement.css";

export default function GenealogyManagement() {
    const [clans, setClans] = useState([]);
    const [selectedClanId, setSelectedClanId] = useState(null);
    const [treeData, setTreeData] = useState(null);
    const [selectedMember, setSelectedMember] = useState(null);
    const [loading, setLoading] = useState(false);
    const [clansLoading, setClansLoading] = useState(true);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        title: "",
        generation: "",
        birth: "",
        death: "",
        parentId: "",
    });

    useEffect(() => {
        const fetchClans = async () => {
            try {
                const res = await getAdminClans();
                setClans(res.clans || []);
            } catch (err) {
                setError("Không thể tải danh sách dòng họ");
            } finally {
                setClansLoading(false);
            }
        };
        fetchClans();
    }, []);

    useEffect(() => {
        if (!selectedClanId) return;

        const fetchTree = async () => {
            try {
                setLoading(true);
                const res = await getAdminClanTree(selectedClanId);
                setTreeData(res.familyTree);
            } catch (err) {
                setError("Không thể tải cây phả hệ");
            } finally {
                setLoading(false);
            }
        };
        fetchTree();
    }, [selectedClanId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        alert("Tính năng thêm thành viên đang được cập nhật cho dòng họ: " + selectedClanId);
    };

    if (clansLoading) return <div className="loading-container"><div className="loader"></div><p>Đang tải danh sách dòng họ...</p></div>;

    return (
        <div className="genealogy-management">
            <aside className="clans-sidebar">
                <div className="sidebar-header">
                    <h2>Dòng họ hệ thống</h2>
                </div>
                <div className="clans-list">
                    {clans.map(clan => (
                        <div 
                            key={clan.id} 
                            className={`clan-item ${selectedClanId === clan.id ? "active" : ""}`}
                            onClick={() => setSelectedClanId(clan.id)}
                        >
                            <span className="material-symbols-outlined">account_tree</span>
                            <div className="clan-info">
                                <strong>{clan.clan_name}</strong>
                                <span>{clan.member_count} thành viên</span>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="genealogy-main">
                <section className="tree-view-card">
                    <div className="card-header">
                        <h2>{selectedClanId ? `Cây phả hệ: ${clans.find(c => c.id === selectedClanId)?.clan_name}` : "Chọn một dòng họ"}</h2>
                        {selectedClanId && (
                            <div className="view-controls">
                                <button type="button" className="control-btn"><span className="material-symbols-outlined">zoom_in</span></button>
                                <button type="button" className="control-btn"><span className="material-symbols-outlined">zoom_out</span></button>
                                <button type="button" className="control-btn"><span className="material-symbols-outlined">fullscreen</span></button>
                            </div>
                        )}
                    </div>
                    <div className="tree-canvas">
                        {loading ? (
                            <div className="inner-loader"><div className="loader"></div></div>
                        ) : treeData && treeData.roots && treeData.roots.length > 0 ? (
                            <FamilyTree data={treeData.roots[0]} onClickNode={setSelectedMember} />
                        ) : (
                            <div className="empty-state">
                                <span className="material-symbols-outlined">family_history</span>
                                <p>{selectedClanId ? "Dòng họ này chưa có dữ liệu cây phả hệ." : "Vui lòng chọn một dòng họ từ danh sách bên trái để bắt đầu."}</p>
                            </div>
                        )}
                    </div>
                </section>

                {selectedMember && (
                    <div className="member-detail-overlay" onClick={() => setSelectedMember(null)}>
                        <div className="member-detail-card" onClick={e => e.stopPropagation()}>
                            <button className="close-modal" onClick={() => setSelectedMember(null)}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                            <div className="detail-header-premium">
                                <div className="detail-avatar-wrap">
                                    {selectedMember.avatar_url ? (
                                        <img src={selectedMember.avatar_url} alt={selectedMember.display_name} />
                                    ) : (
                                        <span className="material-symbols-outlined">person</span>
                                    )}
                                </div>
                                <div className="detail-name-wrap">
                                    <h2>{selectedMember.display_name}</h2>
                                    <span className="gen-badge">Thế hệ {selectedMember.generation || "?"}</span>
                                </div>
                            </div>
                            <div className="detail-info-grid">
                                <div className="info-item">
                                    <span className="material-symbols-outlined">event</span>
                                    <div>
                                        <label>Ngày sinh</label>
                                        <p>{selectedMember.birth_date ? new Date(selectedMember.birth_date).toLocaleDateString('vi-VN') : "Chưa cập nhật"}</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <span className="material-symbols-outlined">location_on</span>
                                    <div>
                                        <label>Quê quán</label>
                                        <p>{selectedMember.hometown || "Chưa cập nhật"}</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <span className="material-symbols-outlined">phone</span>
                                    <div>
                                        <label>Số điện thoại</label>
                                        <p>{selectedMember.phone || "Liên hệ admin"}</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <span className="material-symbols-outlined">mail</span>
                                    <div>
                                        <label>Email</label>
                                        <p>{selectedMember.email || "N/A"}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="detail-bio">
                                <label>Tiểu sử & Ghi chú</label>
                                <p>{selectedMember.bio || "Không có thông tin tiểu sử nào được ghi lại cho thành viên này."}</p>
                            </div>
                            <div className="detail-actions">
                                <button className="btn-edit-member"><span className="material-symbols-outlined">edit</span> Chỉnh sửa thông tin</button>
                            </div>
                        </div>
                    </div>
                )}

                {selectedClanId && (
                    <section className="management-tools card-glass">
                         <div className="quick-actions">
                            <h3>Thao tác nhanh</h3>
                            <div className="action-row">
                                <button type="button" className="action-btn"><span className="material-symbols-outlined">upload</span> Import Excel</button>
                                <button type="button" className="action-btn"><span className="material-symbols-outlined">download</span> Export Data</button>
                                <button type="button" className="action-btn ai-btn"><span className="material-symbols-outlined">auto_awesome</span> AI tạo phả hệ</button>
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
