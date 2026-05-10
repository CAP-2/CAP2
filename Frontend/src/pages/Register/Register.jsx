import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./register.css";
import { registerAPI } from "../../api/authService";
import DateInput from "../../components/common/DateInput";
import { vietnamDateToIso } from "../../utils/dateFormat";
import termsText from "./terms.txt?raw";
import privacyText from "./privacy.txt?raw";

const initialForm = {
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
  termsAccepted: false,
};

export default function Register({ isOpen, onClose, onLoginClick }) {
  const navigate = useNavigate();
  const isModal = typeof isOpen === "boolean";
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState("");
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!isModal) return;
    if (!isOpen) return;
    setError("");
    setSuccessMessage("");
  }, [isModal, isOpen]);

  useEffect(() => {
    if (!isModal || !isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModal, isOpen, onClose]);

  if (isModal && !isOpen) return null;

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

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (error) setError("");
  };

  const handleClose = () => {
    if (isModal) {
      onClose?.();
      return;
    }
    navigate("/");
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const surname = form.surname.trim();
    const middleName = form.middle_name.trim();
    const firstName = form.first_name.trim();
    const displayName = form.display_name.trim() || [surname, middleName, firstName].filter(Boolean).join(" ");
    const clanId = Number(String(form.clan_id || "").trim());

    if (!surname || !firstName || !displayName) {
      setError("Vui lòng nhập đầy đủ họ, tên và tên hiển thị.");
      return;
    }
    if (!form.email.trim()) {
      setError("Vui lòng nhập email đăng nhập.");
      return;
    }
    if (form.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (!form.birth_date) {
      setError("Vui lòng nhập ngày sinh theo định dạng dd/mm/yyyy.");
      return;
    }
    if (!form.hometown.trim()) {
      setError("Vui lòng nhập quê quán.");
      return;
    }
    if (!Number.isInteger(clanId) || clanId <= 0) {
      setError("Vui lòng nhập ID dòng họ hợp lệ.");
      return;
    }
    if (!form.termsAccepted) {
      setError("Vui lòng đồng ý Điều khoản sử dụng và Chính sách bảo mật.");
      return;
    }

    setLoading(true);

    try {
      const result = await registerAPI({
        ...form,
        surname,
        middle_name: middleName,
        first_name: firstName,
        display_name: displayName,
        email: form.email.trim(),
        hometown: form.hometown.trim(),
        gender: Number(form.gender) || 1,
        clan_id: clanId,
        birth_date: vietnamDateToIso(form.birth_date) || null,
      });

      setSuccessMessage(result?.message || "Đăng ký thành công! Vui lòng chờ phê duyệt.");
      setForm(initialForm);
      setTimeout(() => {
        onClose?.();
        navigate("/waiting");
      }, 650);
    } catch (err) {
      setError(err?.message || "Đăng ký thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={isModal ? "register-page register-page--modal" : "register-page"} onClick={isModal ? handleClose : undefined}>
      <div className="register-container" role="dialog" aria-modal="true" aria-labelledby="register-title" onClick={(event) => event.stopPropagation()}>
        <button className="register-close-btn" type="button" aria-label="Đóng" onClick={handleClose}>
          ×
        </button>

        <h2 id="register-title">Tạo tài khoản mới</h2>
        <p className="subtitle">Vui lòng điền thông tin để tạo tài khoản mới</p>

        <div className="info-link">
          Bạn muốn tạo dòng họ mới? <Link to="/clan-register" onClick={isModal ? onClose : undefined}>Tìm hiểu thêm</Link>
        </div>

        {error && <div className="error-box">{error}</div>}
        {successMessage && !error && <div className="success-box">{successMessage}</div>}

        <form onSubmit={handleRegister}>
          <div className="input-row input-row--three">
            <input name="surname" value={form.surname} placeholder="Họ" onChange={handleChange} required />
            <input name="middle_name" value={form.middle_name} placeholder="Tên đệm" onChange={handleChange} />
            <input name="first_name" value={form.first_name} placeholder="Tên" onChange={handleChange} required />
          </div>

          <input name="display_name" value={form.display_name} placeholder="Tên hiển thị đầy đủ" onChange={handleChange} required />

          <div className="input-row input-row--two">
            <select name="gender" value={form.gender} onChange={handleChange} required>
              <option value="1">Nam</option>
              <option value="2">Nữ</option>
              <option value="0">Không rõ</option>
            </select>
            <DateInput name="birth_date" value={form.birth_date} onChange={handleChange} required />
          </div>

          <input name="email" value={form.email} placeholder="Email đăng nhập" type="email" autoComplete="username" onChange={handleChange} required />
          <input name="password" value={form.password} type="password" placeholder="Mật khẩu" autoComplete="new-password" onChange={handleChange} required />
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
            <small>Nhập ID do trưởng họ hoặc quản trị viên cung cấp để tài khoản được thêm vào cây gia phả.</small>
          </label>

          <div className="checkbox-group">
            <input
              type="checkbox"
              id="terms"
              name="termsAccepted"
              checked={form.termsAccepted}
              onChange={handleChange}
              required
            />
            <label htmlFor="terms">
              Tôi đồng ý
              <button className="policy-link policy-link-button" type="button" onClick={() => openModal("terms")}>Điều khoản sử dụng</button>
              và
              <button className="policy-link policy-link-button" type="button" onClick={() => openModal("privacy")}>Chính sách bảo mật</button>
            </label>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đăng ký tài khoản"}
          </button>
        </form>

        <p className="footer-link">
          Đã có tài khoản?{" "}
          {isModal ? (
            <button
              type="button"
              className="register-inline-link"
              onClick={() => {
                onClose?.();
                onLoginClick?.();
              }}
            >
              Đăng nhập ngay
            </button>
          ) : (
            <Link to="/login">Đăng nhập ngay</Link>
          )}
        </p>

        {modalOpen && (
          <div className="policy-modal-overlay" onClick={closeModal}>
            <div className="policy-modal-card" onClick={(event) => event.stopPropagation()}>
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
}
