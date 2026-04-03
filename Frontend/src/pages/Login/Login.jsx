import { useState } from "react";
import { Link, useNavigate } from "react-router-dom"; 
import "./login.css";
import { loginAPI } from "../../api/authService";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await loginAPI({ email, password });

      if (res && res.success) {
        localStorage.setItem("user", JSON.stringify(res.user));
        if (res.token) localStorage.setItem("token", res.token);

        if (res.user.status === "pending") {
          navigate("/waiting");
          return;
        }

        const roleId = res.user.role_id;
        if (roleId === 1) {
          navigate("/admin");
        } else if (roleId === 2) {
          navigate("/manager");
        } else if (roleId === 3) {
          navigate("/member");
        } else {
          navigate("/member");
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Link to="/" className="back-btn">← Back to Home</Link>
      <div className="login-box">
        <div className="login-header">
          <h2>Chào mừng đến với Gia Phả Việt!</h2>
          <p>Hãy đăng nhập để tiếp tục</p>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-field">
            <input
              type="email"
              placeholder="Tên đăng nhập"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-field">
            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Đang xác thực..." : "Đăng nhập"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            <span>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></span>
            <span>
              <Link to="/forgot" title="Nhận mã 6 số qua email đã đăng ký (SMTP Gmail trên server)">
                Quên mật khẩu?
              </Link>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;