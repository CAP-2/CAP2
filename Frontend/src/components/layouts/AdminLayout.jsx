import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { getStoredUser, logout, isAuthenticated } from "../../utils/auth";
import { formatDateVN } from "../../utils/dateFormat";
import "./AdminLayout.css";

const menuItems = [
 
  { icon: "dashboard", label: "Tổng quan", path: "/dashboard" },
  { icon: "account_tree", label: "Quản lý phả hệ", path: "/dashboard/genealogy" },
  { icon: "group", label: "Quản lý Tài khoản", path: "/dashboard/members" },
  { icon: "article", label: "Quản lý bài viết", path: "/dashboard/posts" },
  { icon: "assignment", label: "Quản lý sự kiện ", path: "/dashboard/tasks" },
  { icon: "workspace_premium", label: "Gói sử dụng", path: "/dashboard/billing" },
  { icon: "calendar_month", label: "Lịch Việt Nam", path: "/dashboard/calendar" },
  { icon: "settings", label: "Cài đặt Hệ thống", path: "/dashboard/settings" },
];

export default function AdminLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentUser = getStoredUser();

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  return (
    <div className={`admin-portal-container ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="admin-sidebar glass-effect">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? "Thu gọn" : "Mở rộng"}
        >
          <span className="material-symbols-outlined">{sidebarOpen ? "chevron_left" : "chevron_right"}</span>
        </button>

        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <img src="/logo-giaphaviet.png" alt="Gia Phả Việt" />
          </Link>
        </div>

        <div className="sidebar-user-section">
          <div className="admin-avatar-wrapper">
            <span className="material-symbols-outlined">shield_person</span>
          </div>
          <div className="user-details">
            <strong>{currentUser?.name || currentUser?.display_name || "Admin"}</strong>
            <span className="admin-badge-chip">Quản trị viên hệ thống</span>
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

      <main className="admin-main-content">
        <header className="admin-top-header glass-effect">
          <div className="header-context">
            <h1>Hệ thống Quản trị Gia Phả Việt</h1>
            <p>{currentTime.toLocaleTimeString('vi-VN')} | {formatDateVN(currentTime)}</p>
          </div>
        </header>

        <div className="admin-view-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
