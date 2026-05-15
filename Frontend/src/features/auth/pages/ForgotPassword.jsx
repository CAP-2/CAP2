import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./login.css";
import { requestPasswordResetAPI, resetPasswordWithCodeAPI } from "../../../api/authService";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await requestPasswordResetAPI(email.trim());
      if (res?.success) {
        setInfo(res.message || "Đã xử lý yêu cầu.");
        setStep(2);
      }
    } catch (err) {
      setError(err.message || "Không gửi được mã.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    setLoading(true);
    try {
      const res = await resetPasswordWithCodeAPI({
        email: email.trim(),
        code: code.trim(),
        new_password: newPassword,
      });
      if (res?.success) {
        setInfo(res.message || "Đặt lại thành công.");
        setTimeout(() => navigate("/login", { replace: true }), 1200);
      }
    } catch (err) {
      setError(err.message || "Đặt lại thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Link to="/login" className="back-btn">
        ← Đăng nhập
      </Link>
      <div className="login-box">
        <div className="login-header">
          <h2>Quên mật khẩu</h2>
          <p>
            {step === 1
              ? "Nhập email để nhận mã xác nhận (6 số)"
              : "Nhập mã từ email và mật khẩu mới"}
          </p>
        </div>

        {step === 1 && (
          <div className="forgot-hint">
            Mã <strong>6 số</strong> gửi tới email đã đăng ký. Cần SMTP trong <code>Backend/.env</code>.
            Không thấy thư — kiểm tra Spam.
          </div>
        )}

        {error && <div className="error-alert">{error}</div>}
        {info && !error && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              border: "1px solid #86efac",
              color: "#166534",
              borderRadius: 8,
              background: "#f0fdf4",
              fontSize: 14,
            }}
          >
            {info}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleSendCode}>
            <div className="input-field">
              <input
                type="email"
                placeholder="Email đã đăng ký"
                value={email}
                required
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? "Đang gửi…" : "Gửi mã qua email"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleReset}>
            <div className="input-field">
              <input type="email" value={email} disabled readOnly />
            </div>
            <div className="input-field">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Mã 6 số"
                value={code}
                required
                autoComplete="one-time-code"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <div className="input-field">
              <input
                type="password"
                placeholder="Mật khẩu mới"
                value={newPassword}
                required
                minLength={6}
                autoComplete="new-password"
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="input-field">
              <input
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                required
                minLength={6}
                autoComplete="new-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? "Đang xử lý…" : "Đặt lại mật khẩu"}
            </button>
            <button
              type="button"
              className="btn-login btn-login-secondary"
              disabled={loading}
              onClick={() => {
                setStep(1);
                setCode("");
                setNewPassword("");
                setConfirmPassword("");
                setError("");
                setInfo("");
              }}
            >
              Gửi lại mã (bước 1)
            </button>
          </form>
        )}

        <div className="login-footer">
          <p>
            <span>
              <Link to="/login">← Về đăng nhập</Link>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
