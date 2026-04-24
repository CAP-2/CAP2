import { useEffect, useState } from "react";
import "./MemberDashboard.css";

export default function MemberDashboard() {
  const [stats, setStats] = useState({
    treeCompletion: 65,
    generations: 4,
    totalRecords: 124,
    recentEvents: 2
  });

  const cards = [
    { label: "Độ phủ cây", value: stats.treeCompletion + "%", icon: "account_tree", color: "#c99a2c" },
    { label: "Số đời", value: stats.generations, icon: "history", color: "#4caf50" },
    { label: "Hồ sơ liên quan", value: stats.totalRecords, icon: "description", color: "#2196f3" },
    { label: "Sự kiện sắp tới", value: stats.recentEvents, icon: "calendar_month", color: "#f44336" },
  ];

  const contributions = [
    { title: "Cập nhật ngày mất", entity: "Cụ Nguyễn Văn X", status: "Approved", date: "Hôm qua" },
    { title: "Thêm ảnh tư liệu", entity: "Chi 2 - Nhánh A", status: "Pending", date: "2 ngày trước" },
    { title: "Sửa tiểu sử", entity: "Bác Nguyễn Việt Y", status: "Approved", date: "Tuần trước" },
  ];

  return (
    <div className="member-dashboard-page animate-fade-in">
      <div className="dashboard-grid">
        {cards.map((card, i) => (
          <div key={i} className="dashboard-card glass-effect scale-hover">
            <div className="card-icon" style={{ color: card.color }}>
              <span className="material-symbols-outlined">{card.icon}</span>
            </div>
            <div className="card-info">
              <span className="card-label">{card.label}</span>
              <h2 className="card-value">{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-main-row">
        <div className="activity-section glass-effect">
          <div className="section-header">
            <h3>Đóng góp của tôi</h3>
            <button className="text-btn">Xem tất cả</button>
          </div>
          <div className="activity-list">
            {contributions.map((item, i) => (
              <div key={i} className="activity-row">
                <div className="activity-main">
                  <span className="material-symbols-outlined activity-type-icon">edit_square</span>
                  <div className="activity-details">
                    <p className="activity-title">{item.title}</p>
                    <span className="activity-entity">{item.entity}</span>
                  </div>
                </div>
                <div className="activity-meta">
                  <span className={`status-pill ${item.status.toLowerCase()}`}>
                    {item.status === "Approved" ? "Đã duyệt" : "Đang chờ"}
                  </span>
                  <span className="activity-date">{item.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tree-preview-section glass-effect">
          <div className="section-header">
            <h3>Sơ đồ gia hệ</h3>
            <button className="text-btn">Mở rộng</button>
          </div>
          <div className="tree-placeholder">
            <span className="material-symbols-outlined tree-big-icon">hub</span>
            <p>Hệ thống đang tải dữ liệu cây phả hệ của nhánh bạn...</p>
            <div className="progress-bar-container">
              <div className="progress-fill" style={{ width: stats.treeCompletion + '%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
