import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./clanRegister.css";
import { registerClanManagerAPI } from "../../api/authService";
import termsText from "./terms.txt?raw";
import privacyText from "./privacy.txt?raw";

const ClanRegister = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [clanName, setClanName] = useState("");
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

  // --- 🌟 HÀM MỚI: TỰ ĐỘNG TÁCH HỌ TÊN KHI GÕ VÀO Ô "TÊN HIỂN THỊ ĐẦY ĐỦ" 🌟 ---
  const handleFullNameChange = (e) => {
    const fullName = e.target.value;
    const parts = fullName.trim().split(/\s+/); // Tách chuỗi dựa trên khoảng trắng

    let surname = "";
    let middle_name = "";
    let first_name = "";

    if (parts.length === 1 && parts[0] !== "") {
      first_name = parts[0];
    } else if (parts.length === 2) {
      surname = parts[0];
      first_name = parts[1];
    } else if (parts.length >= 3) {
      surname = parts[0];
      first_name = parts[parts.length - 1];
      middle_name = parts.slice(1, parts.length - 1).join(" ");
    }

    // Cập nhật cả 4 ô (Tên đầy đủ, Họ, Tên đệm, Tên) cùng 1 lúc
    setManagerForm((prev) => ({
      ...prev,
      display_name: fullName,
      surname: surname,
      middle_name: middle_name,
      first_name: first_name
    }));
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
      <Link to="/" className="back-btn">← Back to Home</Link>
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

              {/* 🌟 ĐÃ GẮN HÀM TÁCH TÊN VÀO Ô NÀY 🌟 */}
              <input
                name="display_name"
                value={managerForm.display_name}
                placeholder="Tên hiển thị đầy đủ"
                onChange={handleFullNameChange}
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
                  max={new Date().toISOString().split("T")[0]}
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
                {loading ? "Đang xử lý..." : "Hoàn tất đăng ký "}
              </button>
            </form>

            <p className="footer-link">
              <button type="button" className="link-button" onClick={() => setStep(1)}>
               ←  Quay về bước trước
              </button>
            </p>

            <p className="footer-link">
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </p>
          </>
        )}

        {modalOpen && (
          <div className="policy-modal-overlay" onClick={closeModal}>
            <div className="policy-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="policy-modal-header">
                <h3>{modalTitle}</h3>
                <button className="policy-modal-close" type="button" onClick={closeModal}>
                  ×
                </button>
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

export default ClanRegister;