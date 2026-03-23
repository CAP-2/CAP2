import { useState } from "react";
import "./register.css";
import { registerAPI } from "../api/authService";

const Register = () => {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    dob: "",
    hometown: "",
    target_tree_id: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      await registerAPI(form);
      window.location.href = "/waiting";
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="register-page">
      <div className="form-container">
        <h2>Đăng ký</h2>

        <form onSubmit={handleRegister}>
          <input name="first_name" placeholder="Tên" onChange={handleChange} required />
          <input name="last_name" placeholder="Họ" onChange={handleChange} required />
          <input name="email" placeholder="Email" type="email" onChange={handleChange} required />
          <input name="password" type="password" placeholder="Mật khẩu" onChange={handleChange} required />
          <input name="dob" type="date" placeholder="Ngày sinh" onChange={handleChange} required />
          <input name="hometown" placeholder="Quê quán" onChange={handleChange} required />
          <input name="target_tree_id" placeholder="Target Tree ID" onChange={handleChange} required />

          <button type="submit">Đăng ký</button>
        </form>
      </div>
    </div>
  );
};

export default Register;