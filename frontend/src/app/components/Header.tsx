import React from "react";
import { useMode } from "./ModeContext";
import { useAuth } from "./AuthContext";
import { TreePine, Sun, Moon, Search, Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export function Header({ searchQuery, setSearchQuery, sidebarOpen, setSidebarOpen }: HeaderProps) {
  const { mode, setMode, isElderly } = useMode();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`sticky top-0 z-50 backdrop-blur-xl border-b ${
        isElderly
          ? "bg-amber-50/95 border-amber-200 py-4"
          : "bg-white/80 border-gray-100 py-3"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`lg:hidden p-2 rounded-xl ${
              isElderly
                ? "bg-amber-100 text-amber-800"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            } transition-colors`}
          >
            {sidebarOpen ? <X size={isElderly ? 28 : 22} /> : <Menu size={isElderly ? 28 : 22} />}
          </button>
          <div
            className={`flex items-center gap-2 ${
              isElderly ? "gap-3" : "gap-2"
            }`}
          >
            <div
              className={`rounded-xl flex items-center justify-center ${
                isElderly
                  ? "w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600"
                  : "w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600"
              }`}
            >
              <TreePine size={isElderly ? 28 : 22} className="text-white" />
            </div>
            <div>
              <h1
                className={`leading-tight ${
                  isElderly ? "text-2xl text-amber-900" : "text-lg text-gray-900"
                }`}
              >
                Gia Phả
              </h1>
              <p
                className={`${
                  isElderly
                    ? "text-base text-amber-700"
                    : "text-xs text-gray-500"
                }`}
              >
                Dòng họ Nguyễn
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className={`hidden sm:flex flex-1 max-w-md mx-4`}>
          <div
            className={`relative w-full ${
              isElderly ? "" : ""
            }`}
          >
            <Search
              size={isElderly ? 22 : 18}
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                isElderly ? "text-amber-500" : "text-gray-400"
              }`}
            />
            <input
              type="text"
              placeholder={isElderly ? "Tìm thành viên..." : "Tìm kiếm thành viên..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 rounded-xl border outline-none transition-all ${
                isElderly
                  ? "py-3 text-lg bg-white border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 placeholder:text-amber-400"
                  : "py-2.5 text-sm bg-gray-50 border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 placeholder:text-gray-400"
              }`}
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {/* User info & logout */}
          {user && (
            <div className="hidden md:flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isElderly ? "bg-amber-100" : "bg-gray-100"}`}>
                <UserIcon size={isElderly ? 20 : 16} className={isElderly ? "text-amber-600" : "text-gray-600"} />
                <span className={`${isElderly ? "text-base text-amber-900" : "text-sm text-gray-700"}`}>
                  {user.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className={`p-2 rounded-xl transition-colors ${
                  isElderly
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title="Đăng xuất"
              >
                <LogOut size={isElderly ? 22 : 18} />
              </button>
            </div>
          )}

          {/* Mode Toggle */}
          <div
            className={`flex items-center gap-2 p-1 rounded-full ${
              isElderly ? "bg-amber-100" : "bg-gray-100"
            }`}
          >
            <button
              onClick={() => setMode("young")}
              className={`flex items-center gap-1.5 px-3 rounded-full transition-all ${
                isElderly
                  ? "py-2.5"
                  : "py-2"
              } ${
                !isElderly
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-amber-600 hover:text-amber-800"
              }`}
            >
              <Sun size={isElderly ? 22 : 18} />
              <span className={`hidden md:inline ${isElderly ? "text-base" : "text-sm"}`}>
                Trẻ
              </span>
            </button>
            <button
              onClick={() => setMode("elderly")}
              className={`flex items-center gap-1.5 px-3 rounded-full transition-all ${
                isElderly
                  ? "py-2.5"
                  : "py-2"
              } ${
                isElderly
                  ? "bg-white text-amber-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Moon size={isElderly ? 22 : 18} />
              <span className={`hidden md:inline ${isElderly ? "text-base" : "text-sm"}`}>
                Người già
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile search */}
      <div className="sm:hidden px-4 mt-3">
        <div className="relative">
          <Search
            size={isElderly ? 22 : 18}
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isElderly ? "text-amber-500" : "text-gray-400"
            }`}
          />
          <input
            type="text"
            placeholder="Tìm thành viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 rounded-xl border outline-none transition-all ${
              isElderly
                ? "py-3 text-lg bg-white border-amber-300 focus:border-amber-500 placeholder:text-amber-400"
                : "py-2.5 text-sm bg-gray-50 border-gray-200 focus:border-emerald-400 placeholder:text-gray-400"
            }`}
          />
        </div>
      </div>

      {/* Mobile user menu */}
      {user && (
        <div className="md:hidden px-4 mt-3 flex items-center justify-between">
          <div className={`flex items-center gap-2 ${isElderly ? "text-base text-amber-900" : "text-sm text-gray-700"}`}>
            <UserIcon size={isElderly ? 20 : 16} className={isElderly ? "text-amber-600" : "text-gray-600"} />
            <span>{user.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
              isElderly
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 text-base"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm"
            }`}
          >
            <LogOut size={isElderly ? 20 : 16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      )}
    </motion.header>
  );
}