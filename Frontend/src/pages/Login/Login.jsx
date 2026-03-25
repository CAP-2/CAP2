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

      // res.success là flag từ API trả về
      if (res && res.success) {
        // Lưu thông tin user (bao gồm role_id, person_id) vào localStorage
        localStorage.setItem("user", JSON.stringify(res.user));
        
        // Điều hướng dựa trên role_id trong Database của bạn
        // 1: Admin, 2: Manager, 3: Member
        const roleId = res.user.role_id;

        if (roleId === 1) {
          navigate("/admin");
        } else if (roleId === 2) {
          navigate("/manager");
        } else {
          navigate("/member");
        }
      }
    } catch (err) {
      // Hiển thị lỗi từ backend (ví dụ: "Mật khẩu không đúng")
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-header">
          <h2>Đăng nhập</h2>
          <p>Hệ thống Quản lý Gia phả</p>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-field">
            <input
              type="email"
              placeholder="Email của bạn"
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
            {loading ? "Đang xác thực..." : "Vào hệ thống"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Chưa có tài khoản? <Link to="/register">Đăng ký thành viên</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;