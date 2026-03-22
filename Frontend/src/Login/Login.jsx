import { useState } from "react";
import { Link } from "react-router-dom";
import "./login.css";
import { loginAPI } from "../api/authService";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await loginAPI({ email, password });

      if (res.token) {
        localStorage.setItem("token", res.token);
      }

      console.log(res);

      // test điều hướng
      window.location.href = "/manager";

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>Đăng nhập</h2>

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