import { Link } from "react-router-dom";
import "./Header.css";

const navItems = [
  { label: "Về chúng tôi", to: "/#ve-chung-toi" },
  { label: "Tính năng", to: "/tinh-nang" },
  { label: "Lợi ích", to: "/loi-ich" },
  { label: "Tin tức", to: "/tin-tuc" },
  { label: "Hướng dẫn", to: "/huong-dan" },
];

export default function Header({
  isLoggedIn,
  currentUsername,
  currentUser,
  onLogout,
  onOpenLogin,
  onOpenRegister,
}) {
  const getDashboardPath = () => {
    if (!currentUser) return "/";
    if (currentUser.role_name === "admin") return "/dashboard";
    if (currentUser.role_name === "manager") return "/manager/dashboard";
    if (currentUser.role_name === "member") return "/user/dashboard";
    return "/";
  };

  return (
    <header className="site-header">
      <div className="header-top">
        <div className="brand">
          <Link to="/" aria-label="Về trang chủ Gia Phả Việt">
            <img
              src="/logo-giaphaviet.png"
              alt="Gia Phả Việt"
              className="brand-logo"
            />
          </Link>
        </div>
      </div>

      <nav className="main-nav">
        <div className="main-nav-links">
          {navItems.map((item) => (
            <Link key={item.label} to={item.to}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="main-nav-auth">
          {isLoggedIn ? (
            <>
              <Link to={getDashboardPath()} className="nav-dashboard-link">
                <span className="material-symbols-outlined">dashboard</span>
                Dashboard
              </Link>
              <span className="auth-user">Xin chào, {currentUsername}</span>
              <button
                type="button"
                onClick={onLogout}
                className="nav-btn nav-btn-logout"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="nav-btn nav-btn-register"
                onClick={onOpenRegister}
              >
                Đăng ký
              </button>
              <button
                type="button"
                className="nav-btn nav-btn-login"
                onClick={onOpenLogin}
              >
                Đăng nhập
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
