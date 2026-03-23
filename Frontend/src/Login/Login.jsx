import { useState } from "react";
import { Link } from "react-router-dom";
import "./login.css";
import { loginAPI } from "../api/authService";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await loginAPI({ email, password });

      if (res.success) {
        localStorage.setItem("user", JSON.stringify(res.user));

        // Điều hướng dựa trên role
        if (res.user.role === 1) {
          window.location.href = "/admin";
        } else if (res.user.role === 2) {
          window.location.href = "/manager";
        } else if (res.user.role === 3) {
          window.location.href = "/member";
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>Đăng nhập</h2>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            required
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Mật khẩu"
            required
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">Vào hệ thống</button>
        </form>

        <p>
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;