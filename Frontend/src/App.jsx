import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import Register from "./pages/Register/Register";
import ClanRegister from "./pages/ClanRegister/ClanRegister";
import Admin from "./Admin/Admin";
import Manager from "./pages/Manager/Manager";
import Member from "./pages/Member/Member";
import Waiting from "./pages/Waiting/Waiting";
import AIChat from "./components/AIChat/AIChat";

import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/clan-register" element={<ClanRegister />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/manager" element={<Manager />} />
        <Route path="/member" element={<Member />} />
        <Route path="/waiting" element={<Waiting />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <AIChat />
    </Router>
  );
}

export default App;