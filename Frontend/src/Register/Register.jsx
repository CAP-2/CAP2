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
    target_tree_id: "1",
    gender: "0",
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
          <input name="first_name" placeholder="Tên" onChange={handleChange} />
          <input name="last_name" placeholder="Họ" onChange={handleChange} />
          <input name="email" placeholder="Email" onChange={handleChange} />
          <input name="password" type="password" onChange={handleChange} />

          <button type="submit">Đăng ký</button>
        </form>
      </div>
    </div>
  );
};

export default Register;