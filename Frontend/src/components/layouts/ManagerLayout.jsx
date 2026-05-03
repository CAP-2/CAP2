import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { getStoredUser, logout, isAuthenticated } from "../../utils/auth";
import { apiRequest } from "../../services/api";
import { resolveImageUrl } from "../../utils/media";
import NotificationBell from "./NotificationBell";
import ProfileDrawer from "../ProfileDrawer/ProfileDrawer";
import "./ManagerLayout.css";

const menuItems = [
  { icon: "dashboard", label: "Tổng quan", path: "/manager/dashboard" },
  { icon: "account_tree", label: "Phả hệ dòng họ", path: "/manager/genealogy" },
  { icon: "assignment", label: "Sự kiện dùng họ", path: "/manager/tasks" },
  { icon: "post_add", label: "Bảng tin dòng họ", path: "/manager/posts" },
  { icon: "hourglass", label: "Viên nang thời gian", path: "/manager/time-capsule" },
  { icon: "group", label: "Thành viên dòng họ", path: "/manager/account" },
  { icon: "pending_actions", label: "Duyệt chờ", path: "/manager/pending" },
  { icon: "payments", label: "Gói sử dụng", path: "/manager/billing" },
];

export default function ManagerLayout() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountForm, setAccountForm] = useState({
    email: "",
    surname: "",
    middle_name: "",
    first_name: "",
    hometown: "",
    generation: "",
    bio: "",
    avatar_url: "",
    avatar_media_id: null,
    moderation_status: "none",
    person_id: null,
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

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
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  const syncStoredUser = (profile) => {
    if (!profile) return;
    const storedUser = getStoredUser() || {};
    const profileName = profile.display_name || [profile.surname, profile.middle_name, profile.first_name].filter(Boolean).join(" ").trim();
    const nextUser = {
      ...storedUser,
      email: profile.email || storedUser.email,
      display_name: profile.display_name || storedUser.display_name,
      name: profileName || storedUser.name,
      role_id: profile.role_id || storedUser.role_id,
      status: profile.status || storedUser.status,
      avatar_url: resolveImageUrl({
        mediaId: profile.pending_avatar_media_id || profile.avatar_media_id,
        avatar_url: profile.pending_avatar_url || profile.avatar_url || storedUser.avatar_url || currentUser?.avatar_url || "",
      }),
      avatar_media_id: profile.pending_avatar_media_id || profile.avatar_media_id || storedUser.avatar_media_id || currentUser?.avatar_media_id || null,
    };
    localStorage.setItem("auth_user", JSON.stringify(nextUser));
    localStorage.setItem("user", JSON.stringify(nextUser));
    setCurrentUser(nextUser);
  };

  const loadAccountProfile = useCallback(async () => {
    setAccountLoading(true);
    setAccountMessage("");
    try {
      const data = await apiRequest("/api/member/dashboard");
      const profile = data.profile || {};
      setAccountForm({
        email: profile.email || "",
        surname: profile.surname || "",
        middle_name: profile.middle_name || "",
        first_name: profile.first_name || "",
        hometown: profile.hometown || "",
        generation: profile.generation ?? "",
        bio: profile.pending_bio !== null && profile.pending_bio !== undefined ? profile.pending_bio || "" : profile.bio || "",
        avatar_url:
          profile.pending_avatar_url !== null && profile.pending_avatar_url !== undefined
            ? resolveImageUrl({ mediaId: profile.pending_avatar_media_id, avatar_url: profile.pending_avatar_url || "" })
            : resolveImageUrl({ mediaId: profile.avatar_media_id, avatar_url: profile.avatar_url || "" }),
        avatar_media_id:
          profile.pending_avatar_media_id !== null && profile.pending_avatar_media_id !== undefined
            ? profile.pending_avatar_media_id || null
            : profile.avatar_media_id || null,
        moderation_status: profile.moderation_status || "none",
        person_id: profile.person_id ?? null,
      });
      syncStoredUser(profile);
    } catch (error) {
      setAccountMessage(error?.message || "Không tải được thông tin tài khoản.");
    } finally {
      setAccountLoading(false);
    }
  }, []);

  const openAccountModal = () => {
    setAccountOpen(true);
  };

  const updateAccountField = (event) => {
    const { name, value } = event.target;
    setAccountForm((prev) => ({ ...prev, [name]: value }));
  };

  const updatePasswordField = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveAccountInfo = async () => {
    setAccountMessage("");
    if (accountForm.person_id == null) {
      setAccountMessage("Tài khoản chưa liên kết hồ sơ người nên chưa thể cập nhật.");
      return;
    }

    const generationText = String(accountForm.generation || "").trim();
    const generation = generationText === "" ? null : Number(generationText);
    if (generationText && !Number.isFinite(generation)) {
      setAccountMessage("Đời phải là một số hợp lệ.");
      return;
    }

    setAccountSaving(true);
    try {
      const data = await apiRequest("/api/member/profile", {
        method: "PUT",
        body: JSON.stringify({
          email: accountForm.email,
          surname: accountForm.surname,
          middle_name: accountForm.middle_name,
          first_name: accountForm.first_name,
          hometown: accountForm.hometown,
          generation,
        }),
      });
      syncStoredUser(data.profile);
      setAccountMessage("Đã cập nhật thông tin tài khoản.");
      await loadAccountProfile();
    } catch (error) {
      setAccountMessage(error?.message || "Không thể lưu thông tin tài khoản.");
    } finally {
      setAccountSaving(false);
    }
  };

  const submitProfileContent = async () => {
    setAccountMessage("");
    if (accountForm.person_id == null) {
      setAccountMessage("Tài khoản chưa liên kết hồ sơ người nên chưa thể gửi duyệt ảnh/bio.");
      return;
    }

    setAccountSaving(true);
    try {
      await apiRequest("/api/member/content/profile", {
        method: "POST",
        body: JSON.stringify({
          bio: accountForm.bio,
          avatar_url: accountForm.avatar_url,
          avatar_media_id: accountForm.avatar_media_id || null,
        }),
      });
      setAccountMessage("Đã gửi yêu cầu cập nhật ảnh và tiểu sử.");
      await loadAccountProfile();
    } catch (error) {
      setAccountMessage(error?.message || "Không thể gửi yêu cầu cập nhật hồ sơ.");
    } finally {
      setAccountSaving(false);
    }
  };

  const savePassword = async () => {
    setAccountMessage("");
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setAccountMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setPasswordSaving(true);
    try {
      await apiRequest("/api/member/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        }),
      });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setAccountMessage("Đã đổi mật khẩu thành công.");
    } catch (error) {
      setAccountMessage(error?.message || "Không thể đổi mật khẩu.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className={`manager-portal-container ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="manager-sidebar glass-effect" aria-label="Menu quản lý">
        <button
          type="button"
          className="sidebar-toggle"
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
          </Link>
        </div>

        <button type="button" className="sidebar-user-section" onClick={openAccountModal} title="Sửa tài khoản">
          <div className="manager-avatar-wrapper">
           {(() => {
            const avatarSrc = resolveImageUrl({
              mediaId: currentUser?.avatar_media_id,
              avatar_url: currentUser?.avatar_url,
          });

            return avatarSrc ? (
              <img src={avatarSrc} alt="" className="manager-avatar-img" />
            ) : (
              <span className="material-symbols-outlined">manage_accounts</span>
            );
        })()}
          </div>
          <div className="user-details">
            <strong>{currentUser?.name || currentUser?.display_name || "Manager"}</strong>
            <span className="role-chip">Quản trị viên dòng họ</span>
          </div>
        </button>

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
            <button className="util-btn" title="Sửa tài khoản" onClick={openAccountModal}>
              <span className="material-symbols-outlined">account_circle</span>
            </button>
            <NotificationBell role="manager" buttonClassName="util-btn" />
            <button className="util-btn" title="Hỗ trợ">
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>
        </header>
        <div className="manager-view-body">
          <Outlet />
        </div>
      </main>

      <ProfileDrawer
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        roleLabel="Quản trị viên dòng họ"
        title="Chỉnh sửa thông tin cá nhân"
      />
    </div>
  );
}
