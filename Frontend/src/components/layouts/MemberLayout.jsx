import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { getStoredUser, logout, isAuthenticated } from "../../utils/auth";
import "./MemberLayout.css";

const menuItems = [
  { icon: "dashboard", label: "Tổng quan", path: "/user/dashboard" },
  { icon: "account_tree", label: "Cây gia phả", path: "/user/family-tree" },
  { icon: "history_edu", label: "Bài đóng góp", path: "/user/submissions" },
  { icon: "person", label: "Hồ sơ cá nhân", path: "/user/profile" },
];

export default function MemberLayout() {
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
    <div className="member-portal-container">
      <aside className="member-sidebar glass-effect">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <img src="/logo giaphaviet.png" alt="Gia Phả Việt" />
            <span>Gia Phả Việt</span>
          </Link>
        </div>

        <div className="sidebar-user-profile">
          <div className="profile-img-container">
            <img src={currentUser?.avatar_url || "/default-avatar.png"} alt="Avatar" className="user-avatar-circle" />
            <div className="status-indicator online"></div>
          </div>
          <div className="user-text">
            <h4>{currentUser?.name || currentUser?.display_name || "Thành viên"}</h4>
            <span className="role-text">Thành viên dòng họ</span>
          </div>
        </div>

        <nav className="member-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`member-nav-item ${location.pathname === item.path ? "active" : ""}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="member-sidebar-footer">
          <button type="button" onClick={handleLogout} className="member-logout-link">
            <span className="material-symbols-outlined">logout</span>
            <span>Rời hệ thống</span>
          </button>
        </div>
      </aside>

      <main className="member-main-content">
        <header className="member-topbar glass-effect">
          <div className="topbar-welcome">
            <span className="material-symbols-outlined">waving_hand</span>
            <span>Chào mừng, <strong>{currentUser?.name || "Bạn"}</strong></span>
          </div>
          <div className="member-topbar-actions">
            <button className="top-icon-btn glass-btn">
              <span className="material-symbols-outlined">notifications</span>
              <span className="badge">3</span>
            </button>
            <div className="divider"></div>
            <button className="top-icon-btn glass-btn">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        <section className="member-page-body">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
