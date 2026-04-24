import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { getStoredUser, logout, isAuthenticated } from "../../utils/auth";
import "./ManagerLayout.css";

const menuItems = [
  { icon: "dashboard", label: "Tổng quan", path: "/manager/dashboard" },
  { icon: "account_tree", label: "Quản lý phả hệ", path: "/manager/genealogy" },
  { icon: "group", label: "Thành viên", path: "/manager/account" },
  { icon: "pending_actions", label: "Duyệt chờ", path: "/manager/pending" },
  { icon: "photo_library", label: "Thư viện", path: "/manager/media" },
];

export default function ManagerLayout() {
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
    <div className="manager-portal-container">
      <aside className="manager-sidebar glass-effect">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <img src="/logo giaphaviet.png" alt="Gia Phả Việt" />
            <span>Gia Phả Việt</span>
          </Link>
        </div>

        <div className="sidebar-user-section">
          <div className="manager-avatar-wrapper">
            <span className="material-symbols-outlined">manage_accounts</span>
          </div>
          <div className="user-details">
            <strong>{currentUser?.name || currentUser?.display_name || "Manager"}</strong>
            <span className="role-chip">Quản trị viên dòng họ</span>
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

      <main className="manager-main-content">
        <header className="manager-top-header glass-effect">
          <div className="header-context">
            <h1>Hệ thống quản trị Gia Phả</h1>
            <p>Phiên làm việc: {new Date().toLocaleDateString('vi-VN')}</p>
          </div>
          <div className="header-utils">
            <button className="util-btn" title="Thông báo">
              <span className="material-symbols-outlined">notifications</span>
              <span className="dot"></span>
            </button>
            <button className="util-btn" title="Hỗ trợ">
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>
        </header>
        <div className="manager-view-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
