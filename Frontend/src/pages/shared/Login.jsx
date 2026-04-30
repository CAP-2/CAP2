import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { login, register, getDemoAccount } from "../../utils/auth";
import "./Login.css";

const initialLoginForm = {
  email: "",
  password: "",
};

const initialRegisterForm = {
  display_name: "",
  email: "",
  password: "",
  confirmPassword: "",
  clan_id: "",
  gender: "1",
  birth_date: "",
  hometown: "",
};

export default function Login({ isOpen, initialMode = "login", onClose, onLoginSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demo = useMemo(() => getDemoAccount(), []);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setError("");
    setSuccessMessage("");
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleRegisterChange = (event) => {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await login(loginForm);
      onLoginSuccess?.(result?.user);
      setLoginForm(initialLoginForm);
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || "Đăng nhập thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (registerForm.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    const clanId = Number(String(registerForm.clan_id || "").trim());
    if (!Number.isInteger(clanId) || clanId <= 0) {
      setError("Vui lòng nhập ID dòng họ hợp lệ.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register(registerForm);
      setSuccessMessage(result?.message || "Đăng ký thành công. Vui lòng chờ phê duyệt tài khoản.");
      setLoginForm({ email: registerForm.email, password: "" });
      setRegisterForm(initialRegisterForm);
      setMode("login");
    } catch (submitError) {
      setError(submitError.message || "Đăng ký thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={(event) => event.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} type="button" aria-label="Đóng">
          ×
        </button>

        {mode === "login" ? (
          <>
            <h2>Đăng nhập hệ thống</h2>
            <p className="auth-note">Đăng nhập bằng tài khoản đã đăng ký trong hệ thống.</p>
        
            <form onSubmit={handleLoginSubmit} className="auth-form-grid">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                value={loginForm.email}
                onChange={handleLoginChange}
                placeholder="Nhập email"
                required
              />

              <label htmlFor="login-password">Mật khẩu</label>
              <input
                id="login-password"
                name="password"
                type="password"
                value={loginForm.password}
                onChange={handleLoginChange}
                placeholder="Nhập mật khẩu"
                required
              />
              

              {error && <p className="auth-error">{error}</p>}
              {successMessage && <p className="auth-success">{successMessage}</p>}

              <div className="auth-modal-actions">
                <button type="button" onClick={onClose}>Đóng</button>
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Đang xử lý..." : "Đăng nhập"}
                </button>
              </div>
            </form>

            <div className="auth-switch-text">
              <p>
                Chưa có tài khoản?{" "}
                <button type="button" className="auth-link-btn" onClick={() => setMode("register")}>
                  Đăng ký
                </button>
              </p>
              <p>
                <Link className="auth-link-btn" to="/forgot" onClick={onClose}>
                  Quên mật khẩu?
                </Link>
              </p>
            </div>
          </>
        ) : (
          <>
            <h2>Tạo tài khoản mới</h2>
            <p className="auth-note">Điền thông tin cơ bản để đăng ký thành viên mới.</p>

            <form onSubmit={handleRegisterSubmit} className="auth-form-grid">
              <label htmlFor="register-display-name">Họ và tên</label>
              <input
                id="register-display-name"
                name="display_name"
                value={registerForm.display_name}
                onChange={handleRegisterChange}
                placeholder="Ví dụ: Nguyễn Văn A"
                required
              />

              <label htmlFor="register-email">Email</label>
              <input
                id="register-email"
                name="email"
                type="email"
                value={registerForm.email}
                onChange={handleRegisterChange}
                placeholder="example@email.com"
                required
              />

              <label htmlFor="register-password">Mật khẩu</label>
              <input
                id="register-password"
                name="password"
                type="password"
                value={registerForm.password}
                onChange={handleRegisterChange}
                placeholder="Tối thiểu 6 ký tự"
                required
              />

              <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                value={registerForm.confirmPassword}
                onChange={handleRegisterChange}
                placeholder="Nhập lại mật khẩu"
                required
              />

              <label htmlFor="register-clan-id">ID dòng họ</label>
              <input
                id="register-clan-id"
                name="clan_id"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={registerForm.clan_id}
                onChange={handleRegisterChange}
                placeholder="Nhập ID dòng họ"
                required
              />
              <p className="auth-field-hint">ID do trưởng họ hoặc quản trị viên cung cấp để tài khoản được thêm vào cây gia phả.</p>

              {error && <p className="auth-error">{error}</p>}
              {successMessage && <p className="auth-success">{successMessage}</p>}

              <div className="auth-modal-actions">
                <button type="button" onClick={onClose}>Đóng</button>
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Đang xử lý..." : "Đăng ký"}
                </button>
              </div>
            </form>

            <div className="auth-switch-text">
              <p>
                Đã có tài khoản?{" "}
                <button type="button" className="auth-link-btn" onClick={() => setMode("login")}>
                  Đăng nhập
                </button>
              </p>
              <p>
                Muốn tạo dòng họ mới?{" "}
                <Link className="auth-link-btn" to="/clan-register" onClick={onClose}>
                  Tạo dòng họ
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
