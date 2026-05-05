import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { getStoredUser, isAuthenticated, logout as clearAuth } from "../../utils/auth";
import { apiRequest } from "../../services/api";
import { resolveImageUrl } from "../../utils/media";
import NotificationBell from "./NotificationBell";
import ProfileDrawer from "../ProfileDrawer/ProfileDrawer";
import "./MemberLayout.css";

const menuItems = [
  { icon: "assignment", label: "Sự kiện dòng họ", path: "/user/tasks" },
  { icon: "account_tree", label: "Gia phả dòng họ", path: "/user/family-tree" },
  { icon: "hourglass", label: "Viên nang thời gian", path: "/user/time-capsule" },
  { icon: "history_edu", label: "Bảng tin dòng họ", path: "/user/posts" },
  { icon: "account_balance_wallet", label: "Quỹ dòng họ", path: "/user/fund" },
  { icon: "calendar_month", label: "Lịch Việt Nam", path: "/user/calendar" },
  { icon: "person", label: "Hồ sơ cá nhân", path: "/user/profile" },
];

function getUserName(user) {
  return user?.name || user?.display_name || user?.email || "Thành viên";
}

export default function MemberLayout() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => getStoredUser() || {});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;

    let cancelled = false;

    apiRequest("/api/member/dashboard")
      .then((data) => {
        if (cancelled) return;
        const profile = data.profile || {};
        const storedUser = getStoredUser() || {};
        const profileName = profile.display_name || [profile.surname, profile.middle_name, profile.first_name].filter(Boolean).join(" ").trim();
        const nextUser = {
          ...storedUser,
          name: profileName || storedUser.name,
          display_name: profile.display_name || storedUser.display_name,
          email: profile.email || storedUser.email,
          role_id: profile.role_id || storedUser.role_id,
          status: profile.status || storedUser.status,
          avatar_url: resolveImageUrl({
            mediaId: profile.pending_avatar_media_id || profile.avatar_media_id,
            avatar_url: profile.pending_avatar_url || profile.avatar_url || storedUser.avatar_url || "",
          }),
          avatar_media_id: profile.pending_avatar_media_id || profile.avatar_media_id || storedUser.avatar_media_id || null,
        };
        localStorage.setItem("auth_user", JSON.stringify(nextUser));
        localStorage.setItem("user", JSON.stringify(nextUser));
        setCurrentUser(nextUser);
      })
      .catch(() => {
        if (!cancelled) setCurrentUser(getStoredUser() || {});
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/";
  };

  return (
    <div className={`member-portal-container ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="member-sidebar glass-effect" aria-label="Menu thành viên">
        <button
          type="button"
          className="member-sidebar-toggle"
          onClick={() => setSidebarOpen((value) => !value)}
          title={sidebarOpen ? "Thu gọn menu" : "Mở menu"}
          aria-label={sidebarOpen ? "Thu gọn menu" : "Mở menu"}
          aria-expanded={sidebarOpen}
        >
          <span className="material-symbols-outlined">{sidebarOpen ? "chevron_left" : "chevron_right"}</span>
        </button>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <img src={sidebarOpen ? "/logo giaphaviet.png" : "/logo.png"} alt="Gia Phả Việt" />
            <span>Gia Phả Việt</span>
          </Link>
        </div>

        <button type="button" className="sidebar-user-profile" onClick={() => setProfileOpen(true)} title="Chỉnh sửa thông tin cá nhân">
          <div className="profile-img-container">
            <img src={resolveImageUrl({ mediaId: currentUser?.avatar_media_id, avatar_url: currentUser?.avatar_url, fallback: "/logo-giaphaviet.png" })} alt="" className="user-avatar-circle" />
            <div className="status-indicator online" />
          </div>
          <div className="user-text">
            <h4>{getUserName(currentUser)}</h4>
            <span className="role-text">Thành viên dòng họ</span>
          </div>
        </button>

        <nav className="member-nav" aria-label="Điều hướng thành viên">
          {menuItems.map((item) =>
            item.path === "/user/profile" ? (
              <button
                key={item.path}
                type="button"
                className={`member-nav-item ${location.pathname === item.path ? "active" : ""}`}
                onClick={() => setProfileOpen(true)}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ) : (
              <Link
                key={item.path}
                to={item.path}
                className={`member-nav-item ${location.pathname === item.path ? "active" : ""}`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ),
          )}
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
            <span>
              Chào mừng, <strong>{getUserName(currentUser)}</strong>
            </span>
          </div>
          <div className="member-topbar-actions">
            <NotificationBell role="member" buttonClassName="top-icon-btn glass-btn" />
            <div className="divider" />
            <button type="button" className="top-icon-btn glass-btn" onClick={() => setProfileOpen(true)} title="Chỉnh sửa thông tin cá nhân">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        <section className="member-page-body">
          <Outlet />
        </section>
      </main>

      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        roleLabel="Thành viên dòng họ"
        title="Chỉnh sửa thông tin cá nhân"
      />
    </div>
  );
}
