export default function DashboardHome() {
    const stats = [
        { icon: "group", label: "Tổng thành viên", value: "156", color: "#8b0000" },
        { icon: "account_tree", label: "Số đời", value: "8", color: "#c99a2c" },
        { icon: "event", label: "Sự kiện", value: "24", color: "#735c00" },
        { icon: "photo", label: "Hình ảnh", value: "342", color: "#7a1b18" },
    ];

    const recentActivities = [
        { action: "Thêm thành viên mới", name: "Nguyễn Văn A", time: "2 giờ trước" },
        { action: "Cập nhật thông tin", name: "Trần Thị B", time: "5 giờ trước" },
        { action: "Thêm sự kiện", name: "Giỗ tổ 2024", time: "1 ngày trước" },
        { action: "Upload ảnh", name: "Album gia đình", time: "2 ngày trước" },
    ];

    return (
        <div className="dashboard-home">
            <div className="stats-grid-dashboard">
                {stats.map((stat) => (
                    <div key={stat.label} className="stat-card" style={{ borderLeftColor: stat.color }}>
                        <div className="stat-icon" style={{ backgroundColor: stat.color }}>
                            <span className="material-symbols-outlined">{stat.icon}</span>
                        </div>
                        <div className="stat-content">
                            <h3>{stat.value}</h3>
                            <p>{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-sections">
                <div className="section-card">
                    <h2>Hoạt động gần đây</h2>
                    <div className="activity-list">
                        {recentActivities.map((activity, index) => (
                            <div key={index} className="activity-item">
                                <span className="material-symbols-outlined">history</span>
                                <div className="activity-content">
                                    <p>
                                        <strong>{activity.action}:</strong> {activity.name}
                                    </p>
                                    <span className="activity-time">{activity.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="section-card">
                    <h2>Thống kê nhanh</h2>
                    <div className="quick-stats">
                        <div className="quick-stat-item">
                            <span>Thành viên mới tháng này</span>
                            <strong>12</strong>
                        </div>
                        <div className="quick-stat-item">
                            <span>Sự kiện sắp tới</span>
                            <strong>3</strong>
                        </div>
                        <div className="quick-stat-item">
                            <span>Cập nhật gần đây</span>
                            <strong>28</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
