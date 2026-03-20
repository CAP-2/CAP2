import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMode } from "../components/ModeContext";
import { useAuth } from "../components/AuthContext";
import { motion } from "motion/react";
import { Mail, Lock, LogIn, TreePine, Eye, EyeOff, Loader2, Sun, Moon } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { toast } from "sonner";

export function LoginPage() {
  const { mode, setMode, isElderly } = useMode();
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(isElderly ? "VUI LÒNG ĐIỀN ĐẦY ĐỦ THÔNG TIN" : "Vui lòng điền đầy đủ thông tin");
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success(isElderly ? "ĐĂNG NHẬP THÀNH CÔNG!" : "Đăng nhập thành công!");
      navigate("/");
    } catch (error) {
      toast.error(isElderly ? "ĐĂNG NHẬP THẤT BẠI" : "Đăng nhập thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex ${isElderly ? "bg-amber-50" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50"}`}>
      {/* Mode toggle - fixed position */}
      <div className="fixed top-4 right-4 z-50">
        <div
          className={`flex items-center gap-2 p-1 rounded-full shadow-lg ${
            isElderly ? "bg-white border-2 border-amber-200" : "bg-white"
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
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-amber-600 hover:bg-amber-50"
            }`}
          >
            <Sun size={isElderly ? 22 : 18} />
            <span className={`${isElderly ? "text-base" : "text-sm"}`}>
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
                ? "bg-amber-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Moon size={isElderly ? 22 : 18} />
            <span className={`${isElderly ? "text-base" : "text-sm"}`}>
              Người già
            </span>
          </button>
        </div>
      </div>

      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1609220136736-443140cffec6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
          alt="Gia đình Việt Nam"
          className="w-full h-full object-cover"
        />
        <div className={`absolute inset-0 ${isElderly ? "bg-gradient-to-br from-amber-900/70 to-amber-700/50" : "bg-gradient-to-br from-emerald-900/60 to-teal-800/40"}`} />
        <div className="absolute inset-0 flex flex-col justify-center items-center text-white p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <TreePine size={isElderly ? 80 : 64} className="mx-auto mb-6" />
            <h1 className={`mb-4 ${isElderly ? "text-5xl" : "text-4xl"}`}>
              Phần mềm Gia phả
            </h1>
            <p className={`max-w-md ${isElderly ? "text-2xl" : "text-xl"} text-white/90`}>
              Gìn giữ và kết nối thế hệ, khám phá cội nguồn gia đình
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo for mobile */}
          <div className="lg:hidden text-center mb-8">
            <TreePine
              size={isElderly ? 56 : 48}
              className={`mx-auto mb-3 ${isElderly ? "text-amber-600" : "text-emerald-600"}`}
            />
            <h1 className={`${isElderly ? "text-3xl text-amber-900" : "text-2xl text-gray-900"}`}>
              Phần mềm Gia phả
            </h1>
          </div>

          {/* Form */}
          <div className={`rounded-3xl p-8 sm:p-10 shadow-xl ${isElderly ? "bg-white border-2 border-amber-200" : "bg-white/80 backdrop-blur-sm"}`}>
            <h2 className={`mb-2 ${isElderly ? "text-3xl text-amber-900" : "text-2xl text-gray-900"}`}>
              {isElderly ? "ĐĂNG NHẬP" : "Đăng nhập"}
            </h2>
            <p className={`mb-8 ${isElderly ? "text-xl text-amber-700" : "text-sm text-gray-600"}`}>
              {isElderly ? "Chào mừng quý vị trở lại" : "Chào mừng bạn trở lại"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className={`block mb-2 ${isElderly ? "text-xl text-amber-900" : "text-sm text-gray-700"}`}
                >
                  {isElderly ? "ĐỊA CHỈ EMAIL" : "Địa chỉ email"}
                </label>
                <div className="relative">
                  <Mail
                    size={isElderly ? 24 : 20}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 ${isElderly ? "text-amber-500" : "text-gray-400"}`}
                  />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full rounded-xl border transition-all ${
                      isElderly
                        ? "px-14 py-5 text-xl border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-200"
                        : "px-12 py-3.5 text-base border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    } outline-none`}
                    placeholder={isElderly ? "Nhập email của quý vị" : "Nhập email của bạn"}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className={`block mb-2 ${isElderly ? "text-xl text-amber-900" : "text-sm text-gray-700"}`}
                >
                  {isElderly ? "MẬT KHẨU" : "Mật khẩu"}
                </label>
                <div className="relative">
                  <Lock
                    size={isElderly ? 24 : 20}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 ${isElderly ? "text-amber-500" : "text-gray-400"}`}
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full rounded-xl border transition-all ${
                      isElderly
                        ? "px-14 py-5 text-xl border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-200"
                        : "px-12 py-3.5 text-base border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    } outline-none pr-14`}
                    placeholder={isElderly ? "Nhập mật khẩu" : "Nhập mật khẩu của bạn"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 ${isElderly ? "text-amber-500" : "text-gray-400"} hover:opacity-70`}
                  >
                    {showPassword ? (
                      <EyeOff size={isElderly ? 24 : 20} />
                    ) : (
                      <Eye size={isElderly ? 24 : 20} />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className={`rounded ${
                      isElderly
                        ? "w-5 h-5 border-amber-300 text-amber-600 focus:ring-amber-200"
                        : "w-4 h-4 border-gray-300 text-emerald-600 focus:ring-emerald-200"
                    }`}
                  />
                  <span className={`${isElderly ? "text-lg text-amber-700" : "text-sm text-gray-600"}`}>
                    {isElderly ? "Ghi nhớ" : "Ghi nhớ đăng nhập"}
                  </span>
                </label>
                <Link
                  to="/forgot-password"
                  className={`${
                    isElderly
                      ? "text-lg text-amber-600 hover:text-amber-700"
                      : "text-sm text-emerald-600 hover:text-emerald-700"
                  } transition-colors`}
                >
                  {isElderly ? "Quên mật khẩu?" : "Quên mật khẩu?"}
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full rounded-xl flex items-center justify-center gap-3 transition-all ${
                  isElderly
                    ? "py-5 text-xl bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl disabled:bg-amber-400"
                    : "py-3.5 text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg disabled:opacity-50"
                } disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={isElderly ? 24 : 20} className="animate-spin" />
                    <span>{isElderly ? "ĐANG XỬ LÝ..." : "Đang xử lý..."}</span>
                  </>
                ) : (
                  <>
                    <LogIn size={isElderly ? 24 : 20} />
                    <span>{isElderly ? "ĐĂNG NHẬP" : "Đăng nhập"}</span>
                  </>
                )}
              </button>
            </form>

            {/* Register Link */}
            <div className={`mt-8 text-center ${isElderly ? "text-xl" : "text-sm"}`}>
              <span className={isElderly ? "text-amber-700" : "text-gray-600"}>
                {isElderly ? "Chưa có tài khoản? " : "Chưa có tài khoản? "}
              </span>
              <Link
                to="/register"
                className={`${
                  isElderly
                    ? "text-amber-600 hover:text-amber-700"
                    : "text-emerald-600 hover:text-emerald-700"
                } transition-colors underline`}
              >
                {isElderly ? "ĐĂNG KÝ NGAY" : "Đăng ký ngay"}
              </Link>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="mt-6 text-center">
            <p className={`${isElderly ? "text-lg text-amber-600" : "text-sm text-gray-500"}`}>
              {isElderly ? "Chế độ: Người cao tuổi" : "Chế độ: Giao diện trẻ"}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}