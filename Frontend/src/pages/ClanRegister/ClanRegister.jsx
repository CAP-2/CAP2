import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./clanRegister.css";
import { registerClanManagerAPI } from "../../api/authService";

const ClanRegister = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [clanName, setClanName] = useState("");

  const [managerForm, setManagerForm] = useState({
    display_name: "",
    first_name: "",
    middle_name: "",
    surname: "",
    email: "",
    password: "",
    birth_date: "",
    hometown: "",
    gender: "1",
  });

  const handleClanSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!clanName || String(clanName).trim() === "") {
      setError("Vui lòng nhập tên dòng họ");
      return;
    }

    setStep(2);
  };

  const handleManagerChange = (e) => {
    const { name, value } = e.target;
    setManagerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleManagerSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!clanName || String(clanName).trim() === "") {
      setError("Tên dòng họ bị mất, vui lòng quay lại bước trước");
      setLoading(false);
      return;
    }

    try {
      const res = await registerClanManagerAPI({
        clan_name: clanName,
        ...managerForm,
      });

      if (res.success) {
        alert("Đăng ký dòng họ và tài khoản Manager thành công!");
        navigate("/login");
      }
    } catch (err) {
      setError(err.message || "Lỗi trong quá trình tạo dòng họ và quản lý");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clan-register-page">
      <div className="clan-register-container">
        {step === 1 ? (
          <>
            <h2>Tạo dòng họ mới</h2>
            <p className="subtitle">Nhập tên dòng họ bạn muốn tạo.</p>

            {error && <div className="error-box">{error}</div>}

            <form onSubmit={handleClanSubmit}>
              <input
                name="clan_name"
                value={clanName}
                placeholder="Tên dòng họ"
                onChange={(e) => setClanName(e.target.value)}
                required
              />

              <button type="submit" className="submit-btn">
                Tiếp theo: Đăng ký tài khoản quản lý
              </button>
            </form>

            <p className="footer-link">
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </p>
          </>
        ) : (
          <>
            <h2>Tạo tài khoản Manager cho dòng họ "{clanName}"</h2>
            <p className="subtitle">Người đăng ký sẽ được gán quyền Manager của dòng họ này.</p>

            {error && <div className="error-box">{error}</div>}

            <form onSubmit={handleManagerSubmit}>
              <div className="input-row">
                <input
                  name="surname"
                  value={managerForm.surname}
                  placeholder="Họ"
                  onChange={handleManagerChange}
                  required
                />
                <input
                  name="middle_name"
                  value={managerForm.middle_name}
                  placeholder="Tên đệm"
                  onChange={handleManagerChange}
                />
                <input
                  name="first_name"
                  value={managerForm.first_name}
                  placeholder="Tên"
                  onChange={handleManagerChange}
                  required
                />
              </div>

              <input
                name="display_name"
                value={managerForm.display_name}
                placeholder="Tên hiển thị đầy đủ"
                onChange={handleManagerChange}
                required
              />

              <div className="input-row">
                <select name="gender" value={managerForm.gender} onChange={handleManagerChange} required>
                  <option value="1">Nam</option>
                  <option value="2">Nữ</option>
                </select>
                <input
                  name="birth_date"
                  value={managerForm.birth_date}
                  type="date"
                  onChange={handleManagerChange}
                  required
                />
              </div>

              <input
                name="email"
                value={managerForm.email}
                placeholder="Email đăng nhập"
                type="email"
                onChange={handleManagerChange}
                required
              />
              <input
                name="password"
                value={managerForm.password}
                type="password"
                placeholder="Mật khẩu"
                onChange={handleManagerChange}
                required
              />
              <input
                name="hometown"
                value={managerForm.hometown}
                placeholder="Quê quán"
                onChange={handleManagerChange}
                required
              />

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Đang xử lý..." : "Hoàn tất đăng ký Manager"}
              </button>
            </form>

            <p className="footer-link">
              <button type="button" className="link-button" onClick={() => setStep(1)}>
                Quay về bước trước
              </button>
            </p>

            <p className="footer-link">
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ClanRegister;

