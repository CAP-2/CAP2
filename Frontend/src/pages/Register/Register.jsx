import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./register.css";
import { registerAPI } from "../../api/authService";

const Register = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    display_name: "",
    first_name: "",
    middle_name: "",
    surname: "",
    email: "",
    password: "",
    birth_date: "",
    hometown: "",
    gender: "1", // Mặc định là Nam
    clan_id: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Gửi dữ liệu form. 
      // Chú ý: form.gender và form.clan_id sẽ được authService convert sang số.
      const res = await registerAPI(form);
      
      if (res.success) {
        alert("Đăng ký thành công! Vui lòng chờ phê duyệt.");
        navigate("/waiting");
      }
    } catch (err) {
      // Bây giờ err.message sẽ chứa lỗi thật từ SQL (nếu bạn đã sửa server.js như mình chỉ)
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="form-container">
        <h2>Tạo dòng họ mới</h2>
        <p className="subtitle">Hãy điền thông tin để tạo dòng họ mới</p>

        <div className="info-link">
          Bạn muốn đăng ký vào dòng họ đã có? <Link to="/member">Tìm hiểu thêm</Link>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleRegister}>
          <div className="input-row">
            <input name="surname" value={form.surname} placeholder="Họ" onChange={handleChange} required />
            <input name="middle_name" value={form.middle_name} placeholder="Tên đệm" onChange={handleChange} />
            <input name="first_name" value={form.first_name} placeholder="Tên" onChange={handleChange} required />
          </div>

          <input name="display_name" value={form.display_name} placeholder="Tên hiển thị đầy đủ" onChange={handleChange} required />
          
          <div className="input-row">
            <select name="gender" value={form.gender} onChange={handleChange} required>
              <option value="1">Nam</option>
              <option value="2">Nữ</option>
            </select>
            <input name="birth_date" value={form.birth_date} type="date" onChange={handleChange} required />
          </div>

          <input name="email" value={form.email} placeholder="Email đăng nhập" type="email" onChange={handleChange} required />
          <input name="password" value={form.password} type="password" placeholder="Mật khẩu" onChange={handleChange} required />
          <input name="hometown" value={form.hometown} placeholder="Quê quán" onChange={handleChange} required />
          
          <input name="clan_id" value={form.clan_id} placeholder="Mã họ tộc (Clan ID)" type="number" onChange={handleChange} required />

          <div className="checkbox-group">
            <input type="checkbox" id="terms" required />
            <label htmlFor="terms">
              Tôi đồng ý với <a href="#terms">Điều khoản sử dụng</a> và <a href="#privacy">Chính sách bảo mật</a>
            </label>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đăng ký"}
          </button>
        </form>

        <p className="footer-link">
          Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;