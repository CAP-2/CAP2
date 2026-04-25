import { useCallback, useState } from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { getStoredUser, logout, isAuthenticated } from "../../utils/auth";
import { apiRequest } from "../../services/api";
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
    moderation_status: "none",
    person_id: null,
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  const syncStoredUser = (profile) => {
    if (!profile) return;
    const nextUser = {
      ...(getStoredUser() || {}),
      email: profile.email,
      display_name: profile.display_name,
      name: profile.display_name,
      role_id: profile.role_id,
      status: profile.status,
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
            ? profile.pending_avatar_url || ""
            : profile.avatar_url || "",
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
    loadAccountProfile();
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
            <img src="/logo giaphaviet.png" alt="Gia Phả Việt" />
          </Link>
        </div>

        <button type="button" className="sidebar-user-section" onClick={openAccountModal} title="Sửa tài khoản">
          <div className="manager-avatar-wrapper">
            <span className="material-symbols-outlined">manage_accounts</span>
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

      {accountOpen && (
        <div className="manager-account-overlay" onClick={() => setAccountOpen(false)}>
          <div className="manager-account-modal glass-effect" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="manager-account-head">
              <div>
                <h2>Sửa tài khoản quản lý</h2>
                <p>{accountLoading ? "Đang tải dữ liệu..." : currentUser?.email || accountForm.email}</p>
              </div>
              <button type="button" className="manager-account-close" onClick={() => setAccountOpen(false)} aria-label="Đóng">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {accountMessage && <div className="manager-account-message">{accountMessage}</div>}

            <div className="manager-account-section">
              <h3>Thông tin cơ bản</h3>
              <div className="manager-account-grid">
                <input name="surname" value={accountForm.surname} onChange={updateAccountField} placeholder="Họ" />
                <input name="middle_name" value={accountForm.middle_name} onChange={updateAccountField} placeholder="Tên đệm" />
                <input name="first_name" value={accountForm.first_name} onChange={updateAccountField} placeholder="Tên" />
                <input name="email" type="email" value={accountForm.email} onChange={updateAccountField} placeholder="Email đăng nhập" />
                <input name="hometown" value={accountForm.hometown} onChange={updateAccountField} placeholder="Quê quán" />
                <input name="generation" type="number" min="1" value={accountForm.generation} onChange={updateAccountField} placeholder="Đời" />
              </div>
              <button className="manager-account-primary" type="button" onClick={saveAccountInfo} disabled={accountLoading || accountSaving}>
                {accountSaving ? "Đang lưu..." : "Lưu thông tin cơ bản"}
              </button>
            </div>

            <div className="manager-account-section">
              <h3>Ảnh và tiểu sử</h3>
              {accountForm.moderation_status === "pending" && (
                <div className="manager-account-note">Đang có yêu cầu cập nhật hồ sơ chờ duyệt.</div>
              )}
              <input name="avatar_url" value={accountForm.avatar_url} onChange={updateAccountField} placeholder="URL ảnh đại diện" />
              <textarea name="bio" value={accountForm.bio} onChange={updateAccountField} placeholder="Tiểu sử / giới thiệu" rows={3} />
              <button
                className="manager-account-secondary"
                type="button"
                onClick={submitProfileContent}
                disabled={accountLoading || accountSaving || accountForm.moderation_status === "pending"}
              >
                Gửi duyệt ảnh và tiểu sử
              </button>
            </div>

            <div className="manager-account-section">
              <h3>Đổi mật khẩu</h3>
              <div className="manager-account-grid">
                <input name="current_password" type="password" value={passwordForm.current_password} onChange={updatePasswordField} placeholder="Mật khẩu hiện tại" />
                <input name="new_password" type="password" value={passwordForm.new_password} onChange={updatePasswordField} placeholder="Mật khẩu mới" />
                <input name="confirm_password" type="password" value={passwordForm.confirm_password} onChange={updatePasswordField} placeholder="Xác nhận mật khẩu mới" />
              </div>
              <button className="manager-account-primary" type="button" onClick={savePassword} disabled={passwordSaving}>
                {passwordSaving ? "Đang lưu..." : "Đổi mật khẩu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
