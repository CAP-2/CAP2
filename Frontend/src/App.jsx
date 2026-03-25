import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Import các trang 
import Home from "./pages/Home/Home"; 
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import Admin from "./Admin/Admin";    
import Manager from "./pages/Manager/Manager";
import Member from "./pages/Member/Member";
import Waiting from "./pages/Waiting/Waiting";

import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        {/* Trang chủ là cửa ngõ đầu tiên */}
        <Route path="/" element={<Home />} />
        
        {/* Các trang chức năng */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Phân quyền */}
        <Route path="/admin" element={<Admin />} />
        <Route path="/manager" element={<Manager />} />
        <Route path="/member" element={<Member />} />
        <Route path="/waiting" element={<Waiting />} />

        {/* Mặc định quay về Home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;