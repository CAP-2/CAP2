import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDashboardData,
  getMembers,
  getFundOverviewAPI,
  getFundTransactionsAPI,
  getManagerTree,
} from "../../api/managerService";
import ManagerDashboardCharts from "./ManagerDashboardCharts";
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

  const [members, setMembers] = useState([]);
  const [fundOverview, setFundOverview] = useState(null);
  const [fundTransactions, setFundTransactions] = useState([]);
  const [families, setFamilies] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

  const loadDashboard = useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const [data, memberData, fundData, transactionData, treeData] =
      await Promise.all([
        getDashboardData(),
        getMembers().catch(() => ({ members: [] })),
        getFundOverviewAPI().catch(() => null),
        getFundTransactionsAPI().catch(() => ({ transactions: [] })),
        Promise.resolve({ families: [] }),
      ]);

    setStats(data.stats || {});
    setPendingUsers(data.pendingUsers || []);
    setPendingPosts(data.pendingPosts || []);
    setPendingProfiles(data.pendingProfiles || []);
    setTasks(data.tasks || []);

    setMembers(Array.isArray(memberData) ? memberData : memberData?.members || []);
    setFundOverview(fundData?.overview || fundData || null);
    setFundTransactions(transactionData?.transactions || []);
    setFamilies(treeData?.families || []);
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
    { icon: "account_balance_wallet", label: "Tổng tiền trong quỹ", value: formatMoney( fundOverview?.balance ||fundOverview?.current_balance ||fundOverview?.total || 0 ), color: "#2c5f2d", },
    { icon: "assignment", label: "Nhiệm vụ active", value: activeTasks, color: "#2c3e50" },
  ];

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
    <div
      key={stat.label}
      className="stat-card"
      style={{ borderLeftColor: stat.color }}
    >
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

<ManagerDashboardCharts
  members={members}
  families={families}
  fundTransactions={fundTransactions}
  loading={loading}
/>

      <div className="dashboard-sections dashboard-sections-single">
  <div className="section-card">
    <h2>Phân công công việc</h2>

    <div className="quick-stats">
      {tasks.slice(0, 5).map((task) => (
        <div className="quick-stat-item" key={task.id}>
          <span>{task.title}</span>
          <strong className={`status-badge ${task.status}`}>
            {task.status}
          </strong>
        </div>
      ))}

      {!loading && tasks.length === 0 && (
        <div className="activity-item">Chưa có công việc nào.</div>
      )}
    </div>
  </div>
</div>
    </div>
  );
}
