import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboardData } from "../../api/managerService";
import { getStoredUser } from "../../utils/auth";
import { formatDateTime } from "./managerData";

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const [stats, setStats] = useState({ total_members: 0, total_managers: 0, total_pending: 0 });
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDashboardData();
      setStats(data.stats);
      setPendingUsers(data.pendingUsers);
      setPendingPosts(data.pendingPosts);
      setPendingProfiles(data.pendingProfiles);
      setTasks(data.tasks);
    } catch (err) {
      setError(err?.message || "Không thể tải dữ liệu tổng quan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== "completed").length,
    [tasks]
  );
  const totalPending = pendingUsers.length + pendingPosts.length + pendingProfiles.length;

  const statCards = [
    { icon: "group", label: "Thành viên dòng họ", value: stats.total_members || 0, color: "#8b0000" },
    { icon: "pending_actions", label: "Đang chờ duyệt", value: totalPending, color: "#c99a2c" },
    { icon: "manage_accounts", label: "Quản lý", value: stats.total_managers || 0, color: "#2c5f2d" },
    { icon: "assignment", label: "Nhiệm vụ active", value: activeTasks, color: "#2c3e50" },
  ];

  const recentActivities = [
    ...pendingUsers.slice(0, 2).map((user) => ({
      id: `user-${user.account_id}`,
      icon: "person_add",
      title: "Đăng ký mới",
      text: `${[user.surname, user.first_name].filter(Boolean).join(" ") || user.email} (${user.email})`,
      time: formatDateTime(user.created_at || user.birth_date),
    })),
    ...pendingProfiles.slice(0, 2).map((profile) => ({
      id: `profile-${profile.person_id}`,
      icon: "edit_note",
      title: "Cập nhật hồ sơ",
      text: profile.display_name || [profile.surname, profile.first_name].filter(Boolean).join(" "),
      time: "Đang chờ kiểm duyệt",
    })),
    ...pendingPosts.slice(0, 2).map((post) => ({
      id: `post-${post.post_id}`,
      icon: "article",
      title: "Tư liệu đóng góp",
      text: post.description || post.content || post.image_url || "Bài viết không có nội dung",
      time: formatDateTime(post.created_at),
    })),
  ].slice(0, 5);

  return (
    <div className="manager-dashboard">
      <div className="welcome-banner section-card">
        <h2>Chào mừng trở lại, {currentUser?.name || currentUser?.display_name || "Manager"}!</h2>
        <p>Hôm nay có {totalPending} yêu cầu cần xử lý từ dữ liệu trong hệ thống.</p>
        <button type="button" className="small-action-btn" onClick={loadDashboard} disabled={loading}>
          Tải lại
        </button>
      </div>

      {error && <div className="section-card error-alert">{error}</div>}

      <div className="stats-grid-dashboard">
        {statCards.map((stat) => (
          <div key={stat.label} className="stat-card" style={{ borderLeftColor: stat.color }}>
            <div className="stat-icon" style={{ backgroundColor: stat.color }}>
              <span className="material-symbols-outlined">{stat.icon}</span>
            </div>
            <div className="stat-content">
              <h3>{loading ? "..." : stat.value}</h3>
              <p>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-sections">
        <div className="section-card">
          <h2>Yêu cầu phê duyệt mới</h2>
          <div className="activity-list">
            {recentActivities.length === 0 && !loading ? (
              <div className="activity-item">Không có yêu cầu đang chờ.</div>
            ) : (
              recentActivities.map((item) => (
                <div className="activity-item" key={item.id}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <div className="activity-content">
                    <p>
                      <strong>{item.title}:</strong> {item.text}
                    </p>
                    <span className="activity-time">{item.time}</span>
                  </div>
                  <button className="small-action-btn" onClick={() => navigate("/manager/pending")}>
                    Duyệt
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="section-card">
          <h2>Phân công công việc</h2>
          <div className="quick-stats">
            {tasks.slice(0, 5).map((task) => (
              <div className="quick-stat-item" key={task.id}>
                <span>{task.title}</span>
                <strong className={`status-badge ${task.status}`}>{task.status}</strong>
              </div>
            ))}
            {!loading && tasks.length === 0 && <div className="activity-item">Chưa có công việc nào.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
