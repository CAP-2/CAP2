import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./login.css";
import { loginAPI } from "../../api/authService";

const initialLoginForm = {
  email: "",
  password: "",
};

function getRolePath(user) {
  const roleId = Number(user?.role_id);
  const roleName = user?.role_name || user?.role;

  if (roleId === 1 || roleName === "admin") return "/dashboard";
  if (roleId === 2 || roleName === "manager") return "/manager/dashboard";
  return "/user/dashboard";
}

function persistSession(result) {
  if (result?.token) {
    localStorage.setItem("token", result.token);
    localStorage.setItem("auth_token", result.token);
  }

  if (result?.user) {
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("auth_user", JSON.stringify(result.user));
  }
}

export default function Login({ isOpen, onClose, onLoginSuccess, onOpenRegister }) {
  const isModal = typeof isOpen === "boolean";
  const navigate = useNavigate();
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isModal) return;
    if (!isOpen) return;
    setError("");
    setSuccessMessage("");
  }, [isModal, isOpen]);

  useEffect(() => {
    if (!isModal || !isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModal, isOpen, onClose]);

  if (isModal && !isOpen) return null;

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const email = loginForm.email.trim();
      if (!email) {
        setError("Vui lòng nhập email.");
        return;
      }

      const result = await loginAPI({ email, password: loginForm.password });
      if (!result?.success) {
        setError(result?.message || "Đăng nhập không thành công.");
        return;
      }
      if (!result.user) {
        setError("Phản hồi từ server thiếu thông tin tài khoản.");
        return;
      }

      persistSession(result);
      onLoginSuccess?.(result.user);
      setLoginForm(initialLoginForm);

      if (isModal) {
        onClose?.();
        return;
      }

      if (result.user.status === "pending") {
        navigate("/waiting", { replace: true });
        return;
      }

      navigate(getRolePath(result.user), { replace: true });
    } catch (submitError) {
      setError(submitError?.message || String(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginFields = (
    <form onSubmit={handleLoginSubmit} className={isModal ? "auth-login-form" : undefined}>
      <div className="input-field">
        <input
          name="email"
          type="email"
          placeholder="Email đăng nhập"
          value={loginForm.email}
          required
          autoComplete="username"
          onChange={handleLoginChange}
        />
      </div>

      <div className="input-field">
        <input
          name="password"
          type="password"
          placeholder="Mật khẩu"
          value={loginForm.password}
          required
          autoComplete="current-password"
          onChange={handleLoginChange}
        />
      </div>

      <button type="submit" className="btn-login" disabled={isSubmitting}>
        {isSubmitting ? "Đang xác thực..." : "Đăng nhập"}
      </button>
    </form>
  );

  if (!isModal) {
    return (
      <div className="login-page">
        <Link to="/" className="back-btn">← Back to Home</Link>
        <div className="login-box">
          <div className="login-header">
            <h2>Chào mừng đến với Gia Phả Việt!</h2>
            <p>Hãy đăng nhập để tiếp tục</p>
          </div>

          {error && <div className="error-alert">{error}</div>}
          {successMessage && !error && <div className="success-alert">{successMessage}</div>}

          {loginFields}

          <div className="login-footer">
            <p>
              <span>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></span>
              <span>
                <Link to="/forgot" title="Nhận mã 6 số qua email đã đăng ký">
                  Quên mật khẩu?
                </Link>
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-card auth-modal-card--login" onClick={(event) => event.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} type="button" aria-label="Đóng">
          ×
        </button>

        <section className="auth-panel auth-panel--login">
          <div className="auth-modal-header">
            <h2>Chào mừng đến với Gia Phả Việt!</h2>
            <p>Hãy đăng nhập để tiếp tục</p>
          </div>

          {error && <div className="auth-error">{error}</div>}
          {successMessage && !error && <div className="auth-success">{successMessage}</div>}

          {loginFields}

          <div className="auth-modal-footer auth-modal-footer--between">
            <span>
              Chưa có tài khoản?{" "}
              <button
                className="auth-link-btn"
                type="button"
                onClick={() => {
                  onClose?.();
                  onOpenRegister?.();
                }}
              >
                Đăng ký
              </button>
            </span>
            <Link className="auth-link-btn" to="/forgot" onClick={onClose}>
              Quên mật khẩu?
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
