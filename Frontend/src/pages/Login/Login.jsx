import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./login.css";
import { loginAPI, registerAPI } from "../../api/authService";

const initialLoginForm = {
  email: "",
  password: "",
};

const initialRegisterForm = {
  surname: "",
  middle_name: "",
  first_name: "",
  display_name: "",
  email: "",
  password: "",
  clan_id: "",
  gender: "1",
  birth_date: "",
  hometown: "",
  termsAccepted: false,
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

function buildNameParts(displayName) {
  const parts = String(displayName || "").trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[parts.length - 1] || displayName,
    middle_name: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
    surname: parts.length > 1 ? parts[0] : displayName,
  };
}

export default function Login({ isOpen, initialMode = "login", onClose, onLoginSuccess }) {
  const isModal = typeof isOpen === "boolean";
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isModal) return;
    if (!isOpen) return;
    setMode(initialMode);
    setError("");
    setSuccessMessage("");
  }, [initialMode, isModal, isOpen]);

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

  const handleRegisterChange = (event) => {
    const { name, value, type, checked } = event.target;
    setRegisterForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    if (error) setError("");
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setSuccessMessage("");
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

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const surname = registerForm.surname.trim();
    const middleName = registerForm.middle_name.trim();
    const firstName = registerForm.first_name.trim();
    const displayName = registerForm.display_name.trim() || [surname, middleName, firstName].filter(Boolean).join(" ");
    const clanId = Number(String(registerForm.clan_id || "").trim());

    if (!surname || !firstName || !displayName) {
      setError("Vui lòng nhập đầy đủ họ, tên và tên hiển thị.");
      return;
    }
    if (registerForm.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (!registerForm.termsAccepted) {
      setError("Vui lòng đồng ý Điều khoản sử dụng và Chính sách bảo mật.");
      return;
    }
    if (!Number.isInteger(clanId) || clanId <= 0) {
      setError("Vui lòng nhập ID dòng họ hợp lệ.");
      return;
    }
    if (!registerForm.birth_date) {
      setError("Vui lòng chọn ngày sinh.");
      return;
    }
    if (!registerForm.hometown.trim()) {
      setError("Vui lòng nhập quê quán.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerAPI({
        ...registerForm,
        first_name: firstName,
        middle_name: middleName,
        surname,
        display_name: displayName,
        birth_date: registerForm.birth_date,
        hometown: registerForm.hometown.trim(),
        gender: Number(registerForm.gender) || 1,
        clan_id: clanId,
      });

      setSuccessMessage(result?.message || "Đăng ký thành công. Vui lòng chờ phê duyệt tài khoản.");
      setLoginForm({ email: registerForm.email, password: "" });
      setRegisterForm(initialRegisterForm);
      setMode("login");
    } catch (submitError) {
      setError(submitError?.message || "Đăng ký thất bại.");
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
      <div className={`auth-modal-card auth-modal-card--${mode}`} onClick={(event) => event.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} type="button" aria-label="Đóng">
          ×
        </button>

        {mode === "login" ? (
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
                <button type="button" className="auth-link-btn" onClick={() => switchMode("register")}>
                  Đăng ký
                </button>
              </span>
              <Link className="auth-link-btn" to="/forgot" onClick={onClose}>
                Quên mật khẩu?
              </Link>
            </div>
          </section>
        ) : (
          <section className="auth-panel auth-panel--register">
            <div className="auth-modal-header">
              <h2>Tạo tài khoản mới</h2>
              <p>Vui lòng điền thông tin để tạo tài khoản mới</p>
            </div>

            <div className="auth-info-link">
              Bạn muốn tạo dòng họ mới?{" "}
              <Link to="/clan-register" onClick={onClose}>Tìm hiểu thêm</Link>
            </div>

            {error && <div className="auth-error">{error}</div>}
            {successMessage && !error && <div className="auth-success">{successMessage}</div>}

            <form onSubmit={handleRegisterSubmit} className="auth-register-form">
              <div className="auth-name-row">
                <input
                  name="surname"
                  value={registerForm.surname}
                  placeholder="Họ"
                  onChange={handleRegisterChange}
                  required
                />
                <input
                  name="middle_name"
                  value={registerForm.middle_name}
                  placeholder="Tên đệm"
                  onChange={handleRegisterChange}
                />
                <input
                  name="first_name"
                  value={registerForm.first_name}
                  placeholder="Tên"
                  onChange={handleRegisterChange}
                  required
                />
              </div>

              <input
                name="display_name"
                value={registerForm.display_name}
                placeholder="Tên hiển thị đầy đủ"
                onChange={handleRegisterChange}
                required
              />

              <div className="auth-name-row auth-name-row--two">
                <select name="gender" value={registerForm.gender} onChange={handleRegisterChange} required>
                  <option value="1">Nam</option>
                  <option value="2">Nữ</option>
                </select>
                <input
                  name="birth_date"
                  value={registerForm.birth_date}
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  onChange={handleRegisterChange}
                  required
                />
              </div>

              <input
                name="email"
                value={registerForm.email}
                placeholder="Email đăng nhập"
                type="email"
                autoComplete="username"
                onChange={handleRegisterChange}
                required
              />
              <input
                name="password"
                value={registerForm.password}
                type="password"
                placeholder="Mật khẩu"
                autoComplete="new-password"
                onChange={handleRegisterChange}
                required
              />
              <input
                name="hometown"
                value={registerForm.hometown}
                placeholder="Quê quán"
                onChange={handleRegisterChange}
                required
              />

              <label className="auth-field-label" htmlFor="register-clan-id">ID dòng họ</label>
              <input
                id="register-clan-id"
                name="clan_id"
                value={registerForm.clan_id}
                placeholder="Nhập ID dòng họ"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                onChange={handleRegisterChange}
                required
              />
              <p className="auth-field-hint">
                Nhập ID do trưởng họ hoặc quản trị viên cung cấp để tài khoản được thêm vào cây gia phả.
              </p>

              <label className="auth-checkbox-row">
                <input
                  name="termsAccepted"
                  type="checkbox"
                  checked={registerForm.termsAccepted}
                  onChange={handleRegisterChange}
                  required
                />
                <span>
                  Tôi đồng ý{" "}
                  <Link to="/register" onClick={onClose}>Điều khoản sử dụng</Link>
                  và
                  <Link to="/register" onClick={onClose}>Chính sách bảo mật</Link>
                </span>
              </label>

              <button type="submit" className="btn-login" disabled={isSubmitting}>
                {isSubmitting ? "Đang xử lý..." : "Đăng ký tài khoản"}
              </button>
            </form>

            <div className="auth-modal-footer">
              Đã có tài khoản?{" "}
              <button type="button" className="auth-link-btn" onClick={() => switchMode("login")}>
                Đăng nhập ngay
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );

}
