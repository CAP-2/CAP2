import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminDashboardStats, getAdminClans } from "../../api/adminService";
import "./DashboardHome.css";

export default function DashboardHome() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [clans, setClans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, clansRes] = await Promise.all([
                    getAdminDashboardStats(),
                    getAdminClans()
                ]);
                setData(statsRes);
                setClans(clansRes.clans || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="loading-container"><div className="loader"></div><p>Đang tải dữ liệu thực tế...</p></div>;

    const { stats } = data || {};

    const statItems = [
        { icon: "group", label: "Tổng thành viên", value: stats?.total_members || 0, color: "var(--primary-gradient)", trend: "+12% tháng này" },
        { icon: "account_tree", label: "Số dòng họ", value: stats?.total_clans || 0, color: "var(--accent-gradient)", trend: "Đang phát triển" },
        { icon: "article", label: "Tổng bài viết", value: stats?.total_posts || 0, color: "var(--warm-gradient)", trend: "5,400 bài" },
        { icon: "event", label: "Sự kiện", value: stats?.total_events || 0, color: "var(--cool-gradient)", trend: "3 sắp diễn ra" },
    ];

    return (
        <div className="premium-dashboard">
            <header className="dashboard-header">
                <div className="welcome-text">
                    <h1>Chào mừng trở lại, Admin</h1>
                    <p>Đây là tổng quan hệ thống Gia Phả Việt ngày hôm nay.</p>
                </div>
                <div className="current-date">
                    <span className="material-symbols-outlined">calendar_today</span>
                    {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </header>

            <div className="stats-grid-premium">
                {statItems.map((item, idx) => (
                    <div key={idx} className="stat-card-glass">
                        <div className="stat-icon-wrap" style={{ background: item.color }}>
                            <span className="material-symbols-outlined">{item.icon}</span>
                        </div>
                        <div className="stat-info">
                            <span className="label">{item.label}</span>
                            <h2 className="value">{item.value.toLocaleString()}</h2>
                            <span className="trend">{item.trend}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-main-content">
                <section className="clans-overview card-glass">
                    <div className="card-header">
                        <h2>Danh sách dòng họ & cây gia phả</h2>
                        <button className="btn-link" onClick={() => navigate("/dashboard/genealogy")}>Quản lý tất cả</button>
                    </div>
                    <div className="table-responsive">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Tên cây / Dòng họ</th>
                                    <th>Chủ sở hữu</th>
                                    <th>Thành viên</th>
                                    <th>Bài viết</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clans.map((clan) => (
                                    <tr key={clan.id}>
                                        <td>
                                            <div className="clan-name-cell">
                                                <span className="material-symbols-outlined">account_tree</span>
                                                <strong>{clan.clan_name}</strong>
                                            </div>
                                        </td>
                                        <td>{clan.owner_name || "Chưa có"}</td>
                                        <td>{clan.member_count}</td>
                                        <td>{clan.post_count}</td>
                                        <td>
                                            <button 
                                                className="btn-outline-sm"
                                                onClick={() => navigate(`/dashboard/posts/${clan.id}`)}
                                            >
                                                Xem chi tiết
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="quick-actions-section card-glass">
                    <div className="card-header">
                        <h2>Lối tắt nhanh</h2>
                    </div>
                    <div className="action-grid">
                        <button className="action-btn" onClick={() => navigate("/dashboard/members")}>
                            <span className="material-symbols-outlined">person_add</span>
                            Thêm quản trị viên
                        </button>
                        <button className="action-btn" onClick={() => navigate("/dashboard/posts")}>
                            <span className="material-symbols-outlined">post_add</span>
                            Quản lý bài viết
                        </button>
                        <button className="action-btn" onClick={() => navigate("/dashboard/settings")}>
                            <span className="material-symbols-outlined">settings</span>
                            Cấu hình hệ thống
                        </button>
                        <button className="action-btn" onClick={() => navigate("/dashboard/events")}>
                            <span className="material-symbols-outlined">event</span>
                            Sự kiện toàn quốc
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
