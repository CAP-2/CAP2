import { useEffect, useState, useCallback } from "react";
import { getAdminClans, getAdminClanTree } from "../../api/adminService";
import FamilyTreeEditor from "../../components/PhadoFamilyTree/FamilyTreeEditor";
import "./GenealogyManagement.css";

export default function GenealogyManagement() {
    const [clans, setClans] = useState([]);
    const [selectedClanId, setSelectedClanId] = useState(null);
    const [treeData, setTreeData] = useState({ people: [], families: [], children: [] });
    const [clanInfo, setClanInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [treeLoading, setTreeLoading] = useState(false);

    useEffect(() => {
        const fetchClans = async () => {
            try {
                const res = await getAdminClans();
                setClans(res.clans || []);
                if (res.clans?.length > 0) {
                    setSelectedClanId(res.clans[0].id);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchClans();
    }, []);

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
        } finally {
            setTreeLoading(false);
        }
    }, [selectedClanId]);

    useEffect(() => {
        fetchTree();
    }, [fetchTree]);

    if (loading && clans.length === 0) return <div className="loading-container"><div className="loader"></div><p>Đang tải danh sách dòng họ...</p></div>;

    return (
        <div className="genealogy-management premium-page">
            <aside className="clan-sidebar">
                <div className="sidebar-header">
                    <h3>Danh sách Dòng họ</h3>
                </div>
                <div className="clan-list">
                    {clans.map(clan => (
                        <div 
                            key={clan.id} 
                            className={`clan-item ${selectedClanId === clan.id ? 'active' : ''}`}
                            onClick={() => setSelectedClanId(clan.id)}
                        >
                            <span className="material-symbols-outlined">account_balance</span>
                            <div className="clan-info">
                                <strong>{clan.clan_name}</strong>
                                <span>{clan.member_count} thành viên</span>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="tree-view-main">
                <div className="tree-canvas-container">
                    <FamilyTreeEditor 
                        clan={clanInfo}
                        people={treeData.people}
                        families={treeData.families}
                        children={treeData.children}
                        loading={treeLoading}
                        onReload={fetchTree}
                    />
                </div>
            </main>
        </div>
    );
}
