import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./clanRegister.css";
import { registerClanAPI } from "../../api/authService";

const ClanRegister = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    clan_name: "",
    chief_account_id: "",
  });

  const onChange = (e) => {
    setForm((p) => ({
      ...p,
      [e.target.name]: e.target.value,
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await registerClanAPI(form);
      if (res.success) {
        alert("Đăng ký dòng họ thành công!");
        navigate("/login");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clan-register-page">
      <div className="clan-register-container">
        <h2>Đăng ký dòng họ mới</h2>
        <p className="subtitle">Chỉ định trưởng họ và tạo dòng họ để hệ thống tự liên kết dữ liệu.</p>

        <div className="info-link">
          Bạn muốn tạo tài khoản trước? <Link to="/register">Tạo tài khoản mới</Link>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={onSubmit}>
          <input
            name="clan_name"
            value={form.clan_name}
            placeholder="Tên dòng họ (clan_name)"
            onChange={onChange}
            required
          />

          <input
            name="chief_account_id"
            value={form.chief_account_id}
            placeholder="ID trưởng họ (accounts.id)"
            type="number"
            onChange={onChange}
            required
          />

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Đang xử lý..." : "Tạo dòng họ"}
          </button>
        </form>

        <p className="footer-link">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
};

export default ClanRegister;

