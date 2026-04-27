import { useEffect, useState } from "react";
import { getAdminDashboardStats } from "../../api/adminService";
import "./DashboardHome.css";

export default function DashboardHome() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await getAdminDashboardStats();
                setData(res);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="loading-container"><div className="loader"></div><p>Đang tải dữ liệu thực tế...</p></div>;

    const { stats, recent_activities } = data || {};

    const statItems = [
        { icon: "group", label: "Tổng thành viên", value: stats?.total_members || 0, color: "var(--primary-gradient)", trend: "+12% tháng này" },
        { icon: "account_tree", label: "Số dòng họ", value: stats?.total_clans || 0, color: "var(--accent-gradient)", trend: "Đang phát triển" },
        { icon: "event", label: "Sự kiện", value: stats?.total_events || 0, color: "var(--warm-gradient)", trend: "3 sắp diễn ra" },
        { icon: "photo_library", label: "Hình ảnh kỷ niệm", value: stats?.total_photos || 0, color: "var(--cool-gradient)", trend: "Chất lượng cao" },
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
                <section className="activities-section card-glass">
                    <div className="card-header">
                        <h2>Hoạt động gần đây</h2>
                        <button className="btn-link">Xem tất cả</button>
                    </div>
                    <div className="timeline">
                        {recent_activities?.map((act, i) => (
                            <div key={i} className="timeline-item">
                                <div className="timeline-dot"></div>
                                <div className="timeline-content">
                                    <p><strong>Thành viên mới:</strong> {act.content}</p>
                                    <span className="time">{new Date(act.time).toLocaleString('vi-VN')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="quick-actions-section card-glass">
                    <div className="card-header">
                        <h2>Lối tắt nhanh</h2>
                    </div>
                    <div className="action-grid">
                        <button className="action-btn">
                            <span className="material-symbols-outlined">person_add</span>
                            Thêm quản trị viên
                        </button>
                        <button className="action-btn">
                            <span className="material-symbols-outlined">post_add</span>
                            Tạo sự kiện toàn quốc
                        </button>
                        <button className="action-btn">
                            <span className="material-symbols-outlined">settings</span>
                            Cấu hình hệ thống
                        </button>
                        <button className="action-btn">
                            <span className="material-symbols-outlined">mail</span>
                            Gửi thông báo email
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
