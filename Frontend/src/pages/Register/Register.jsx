import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./register.css";
import { registerAPI } from "../../api/authService";
import termsText from "./terms.txt?raw";
import privacyText from "./privacy.txt?raw";

const Register = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState("");

  const openModal = (type) => {
    if (type === "terms") {
      setModalTitle("Điều khoản sử dụng");
      setModalContent(termsText);
    } else if (type === "privacy") {
      setModalTitle("Chính sách bảo mật");
      setModalContent(privacyText);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalTitle("");
    setModalContent("");
  };

  const [form, setForm] = useState({
    display_name: "",
    first_name: "",
    middle_name: "",
    surname: "",
    email: "",
    password: "",
    birth_date: "",
    hometown: "",
    gender: "1",
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
      const res = await registerAPI(form);
      if (res.success) {
        alert("Đăng ký thành công! Vui lòng chờ phê duyệt.");
        navigate("/waiting");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <Link to="/" className="back-btn">← Về trang chủ </Link>
      <div className="register-container">
        <h2>Tạo tài khoản mới</h2>
        <p className="subtitle">Vui lòng điền thông tin để tạo tài khoản mới</p>

        <div className="info-link">
          Bạn muốn tạo dòng họ mới? <Link to="/clan-register">Tìm hiểu thêm</Link>
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
            <input name="birth_date" value={form.birth_date} type="date" max={new Date().toISOString().split("T")[0]} onChange={handleChange} required />
          </div>

          <input name="email" value={form.email} placeholder="Email đăng nhập" type="email" onChange={handleChange} required />
          <input name="password" value={form.password} type="password" placeholder="Mật khẩu" onChange={handleChange} required />
          <input name="hometown" value={form.hometown} placeholder="Quê quán" onChange={handleChange} required />

          <label className="form-field" htmlFor="clan_id">
            <span>ID dòng họ</span>
            <input
              id="clan_id"
              name="clan_id"
              value={form.clan_id}
              placeholder="Nhập ID dòng họ"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              onChange={handleChange}
              required
            />
            <small>Nhập ID dòng họ đã được cung cấp</small>
          </label>

          <div className="checkbox-group">
            <input type="checkbox" id="terms" required />
            <label htmlFor="terms">
              Tôi đồng ý 
              <a href="#" className="policy-link" onClick={(e) => { e.preventDefault(); openModal("terms"); }}> Điều khoản sử dụng</a>
              và
              <a href="#" className="policy-link" onClick={(e) => { e.preventDefault(); openModal("privacy"); }}>Chính sách bảo mật</a>
            </label>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đăng ký tài khoản"}
          </button>
        </form>

        <p className="footer-link">
          Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
        </p>

        {modalOpen && (
          <div className="policy-modal-overlay" onClick={closeModal}>
            <div className="policy-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="policy-modal-header">
                <h3>{modalTitle}</h3>
                <button className="policy-modal-close" type="button" onClick={closeModal}>×</button>
              </div>
              <div className="policy-modal-body">
                <pre>{modalContent}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
