import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Import các Components từ thư mục tương ứng
// Lưu ý: Đảm bảo tên file bên trong thư mục khớp chính xác (Login.jsx, Register.jsx...)
import Login from "./Login/Login";
import Register from "./Register/Register";
import Waiting from "./Waiting/Waiting";
import Manager from "./Manager/Manager";

// Nếu bạn có file CSS chung cho toàn app
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Điều hướng trang chủ mặc định vào Login */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Các Route chính */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/waiting" element={<Waiting />} />
        <Route path="/manager" element={<Manager />} />

        {/* Trang 404 hoặc quay về Login nếu gõ sai URL */}
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;