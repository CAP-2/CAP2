import { useEffect, useState, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Header from "./Header";
import SiteFooter from "./SiteFooter";
import Login from "../../pages/shared/Login";
import { getCurrentUser, logout, isAuthenticated } from "../../utils/auth";

export default function UserLayout() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleRedirection = useCallback((user) => {
    if (!user) return;
    
    // Redirect logic based on role_name
    if (user.role_name === "admin") {
      navigate("/dashboard", { replace: true });
    } else if (user.role_name === "manager") {
      navigate("/manager/account", { replace: true });
    } else if (user.role_name === "member") {
      // For members, we can redirect to family-tree if they are on the home page
      if (location.pathname === "/") {
        navigate("/user/family-tree", { replace: true });
      }
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
      // If user is already logged in and hits the landing page ("/"), redirect them
      if (location.pathname === "/") {
        handleRedirection(user);
      }
    }
  }, [location.pathname, handleRedirection]);

  const isLoggedIn = !!currentUser;

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    navigate("/", { replace: true });
  };

  const handleLoginSuccess = (user) => {
    const loggedInUser = user || getCurrentUser();
    setCurrentUser(loggedInUser);
    handleRedirection(loggedInUser);
  };

  const openLogin = () => {
    setAuthMode("login");
    setIsAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setIsAuthOpen(true);
  };

  return (
    <>
      <Header
        isLoggedIn={isLoggedIn}
        currentUsername={currentUser?.name || currentUser?.display_name || currentUser?.email || "Người dùng"}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={openLogin}
        onOpenRegister={openRegister}
      />

      <Outlet />

      <SiteFooter />

      <Login
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
