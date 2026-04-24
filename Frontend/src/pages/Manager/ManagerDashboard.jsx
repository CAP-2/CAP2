import { useEffect, useState } from "react";
import { getStoredUser } from "../../utils/auth";

export default function ManagerDashboard() {
  const currentUser = getStoredUser();
  const [stats, setStats] = useState({
    total_members: 0,
    total_managers: 0,
    total_pending: 0
  });

  useEffect(() => {
    // Mocking an API call for stats, in a real app this would be fetch('/api/manager/stats')
    setStats({
      total_members: 84,
      total_managers: 2,
      total_pending: 5
    });
  }, []);

  const statCards = [
    { icon: "group", label: "Thành viên dòng họ", value: stats.total_members, color: "#8b0000" },
    { icon: "pending_actions", label: "Đang chờ duyệt", value: stats.total_pending, color: "#c99a2c" },
    { icon: "manage_accounts", label: "Quản lý (Manager)", value: stats.total_managers, color: "#2c5f2d" },
    { icon: "assignment", label: "Nhiệm vụ active", value: "3", color: "#2c3e50" },
  ];

  return (
    <div className="manager-dashboard">
      <div className="welcome-banner">
        <h2>Chào mừng trở lại, {currentUser?.name || "Manager"}!</h2>
        <p>Hôm nay bạn có {stats.total_pending} yêu cầu phê duyệt mới.</p>
      </div>

      <div className="stats-grid-dashboard">
        {statCards.map((stat) => (
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
          <h2>Yêu cầu phê duyệt mới</h2>
          <div className="activity-list">
            <div className="activity-item">
              <span className="material-symbols-outlined orange">person_add</span>
              <div className="activity-content">
                <p><strong>Đăng ký mới:</strong> Lê Văn C (email: levanc@gmail.com)</p>
                <span className="activity-time">10 phút trước</span>
              </div>
              <button className="small-action-btn">Duyệt</button>
            </div>
            <div className="activity-item">
              <span className="material-symbols-outlined blue">edit_note</span>
              <div className="activity-content">
                <p><strong>Cập nhật Bio:</strong> Nguyễn Thị D đã gửi hồ sơ cập nhật</p>
                <span className="activity-time">1 giờ trước</span>
              </div>
              <button className="small-action-btn">Duyệt</button>
            </div>
          </div>
        </div>

        <div className="section-card">
          <h2>Phân công công việc</h2>
          <div className="quick-stats">
            <div className="quick-stat-item">
              <span>Sưu tầm tư liệu</span>
              <strong className="status-badge progress">Đang làm</strong>
            </div>
            <div className="quick-stat-item">
              <span>Xác minh phả hệ chi 2</span>
              <strong className="status-badge pending">Chờ xử lý</strong>
            </div>
            <div className="quick-stat-item">
              <span>Cập nhật ngày giỗ tổ</span>
              <strong className="status-badge completed">Xong</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
