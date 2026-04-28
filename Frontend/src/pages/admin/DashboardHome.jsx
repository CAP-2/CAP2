import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminDashboardStats, getAdminClans } from "../../api/adminService";
import "./DashboardHome.css";

export default function DashboardHome() {
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

    if (loading) return <div className="loading-container"><div className="loader"></div><p>Đang tải dữ liệu hệ thống...</p></div>;

    const { stats, recent_activities } = data || {};

    const statItems = [
        { icon: "group", label: "Thành viên", value: stats?.total_members || 0, color: "var(--primary-gradient)", trend: "+12% tháng này" },
        { icon: "account_tree", label: "Dòng họ", value: stats?.total_clans || 0, color: "var(--accent-gradient)", trend: "Đang mở rộng" },
        { icon: "article", label: "Bài viết", value: stats?.total_posts || 0, color: "var(--warm-gradient)", trend: "Sôi nổi" },
        { icon: "photo_library", label: "Hình ảnh", value: stats?.total_photos || 0, color: "var(--cool-gradient)", trend: "Chất lượng cao" },
    ];

    return (
        <div className="premium-dashboard">
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

            <div className="dashboard-grid-layout">
                <section className="clans-overview card-glass">
                    <div className="card-header">
                        <h2>Tổng quan Dòng họ</h2>
                        <Link to="/dashboard/genealogy" className="btn-link">Quản lý tất cả</Link>
                    </div>
                    <div className="premium-table-wrapper">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Dòng họ</th>
                                    <th>Chủ quản</th>
                                    <th>Thành viên</th>
                                    <th>Bài viết</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clans.slice(0, 5).map((clan) => (
                                    <tr key={clan.id}>
                                        <td className="font-bold">{clan.clan_name}</td>
                                        <td>{clan.owner_name || "Chưa có"}</td>
                                        <td>{clan.member_count}</td>
                                        <td>{clan.post_count}</td>
                                        <td>
                                            <Link to={`/dashboard/posts/clan/${clan.id}`} className="btn-action-small">
                                                Xem bài viết
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="side-sections">
                    <section className="activities-section card-glass">
                        <div className="card-header">
                            <h2>Hoạt động gần đây</h2>
                        </div>
                        <div className="timeline">
                            {recent_activities?.map((act, i) => (
                                <div key={i} className="timeline-item">
                                    <div className="timeline-dot"></div>
                                    <div className="timeline-content">
                                        <p><strong>{act.content}</strong> gia nhập hệ thống</p>
                                        <span className="time">{new Date(act.time).toLocaleString('vi-VN')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="quick-actions-section card-glass">
                        <div className="card-header">
                            <h2>Lối tắt</h2>
                        </div>
                        <div className="action-grid-small">
                            <button className="action-btn-mini">
                                <span className="material-symbols-outlined">settings</span>
                                Cài đặt
                            </button>
                            <button className="action-btn-mini">
                                <span className="material-symbols-outlined">mail</span>
                                Email
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
