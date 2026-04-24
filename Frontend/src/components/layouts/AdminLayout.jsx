import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { getStoredUser, logout, isAuthenticated } from "../../utils/auth";

const menuItems = [
  { icon: "dashboard", label: "Tổng quan", path: "/dashboard" },
  { icon: "account_tree", label: "Quản lý phả hệ", path: "/dashboard/genealogy" },
  { icon: "group", label: "Thành viên", path: "/dashboard/members" },
  { icon: "event", label: "Sự kiện", path: "/dashboard/events" },
  { icon: "photo_library", label: "Thư viện", path: "/dashboard/gallery" },
  { icon: "settings", label: "Cài đặt", path: "/dashboard/settings" },
];

export default function AdminLayout() {
  const location = useLocation();
  const currentUser = getStoredUser();

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <img src="/logo-giaphaviet.png" alt="Gia Phả Việt" />
            <span>Gia Phả Việt</span>
          </Link>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            <span className="material-symbols-outlined">person</span>
          </div>
          <div className="user-info">
            <strong>{currentUser?.name || currentUser?.display_name || currentUser?.email || "Người dùng"}</strong>
            <span>Người dùng hệ thống</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" onClick={handleLogout} className="logout-btn">
            <span className="material-symbols-outlined">logout</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-topbar">
          <h1>Quản lý gia phả</h1>
          <div className="topbar-actions">
            <button type="button" className="icon-btn">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button type="button" className="icon-btn">
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>
        </div>
        <div className="dashboard-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
