import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMode } from "../components/ModeContext";
import { useAuth } from "../components/AuthContext";
import { motion } from "motion/react";
import { Mail, Lock, User, UserPlus, TreePine, Eye, EyeOff, Loader2, Sun, Moon } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { toast } from "sonner";

export function RegisterPage() {
  const { mode, setMode, isElderly } = useMode();
  const { register } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      toast.error(isElderly ? "VUI LÒNG ĐIỀN ĐẦY ĐỦ THÔNG TIN" : "Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (password !== confirmPassword) {
      toast.error(isElderly ? "MẬT KHẨU KHÔNG KHỚP" : "Mật khẩu không khớp");
      return;
    }

    if (password.length < 6) {
      toast.error(isElderly ? "MẬT KHẨU TỐI THIỂU 6 KÝ TỰ" : "Mật khẩu tối thiểu 6 ký tự");
      return;
    }

    setIsLoading(true);
    try {
      await register(name, email, password);
      toast.success(isElderly ? "ĐĂNG KÝ THÀNH CÔNG!" : "Đăng ký thành công!");
      navigate("/");
    } catch (error) {
      toast.error(isElderly ? "ĐĂNG KÝ THẤT BẠI" : "Đăng ký thất bại");
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
          src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
          alt="Gia đình sum họp"
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
              Gia nhập gia đình
            </h1>
            <p className={`max-w-md ${isElderly ? "text-2xl" : "text-xl"} text-white/90`}>
              Bắt đầu hành trình khám phá và gìn giữ dòng họ của bạn
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right side - Register Form */}
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
              {isElderly ? "ĐĂNG KÝ TÀI KHOẢN" : "Đăng ký tài khoản"}
            </h2>
            <p className={`mb-8 ${isElderly ? "text-xl text-amber-700" : "text-sm text-gray-600"}`}>
              {isElderly ? "Tạo tài khoản mới để bắt đầu" : "Tạo tài khoản mới để bắt đầu"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className={`block mb-2 ${isElderly ? "text-xl text-amber-900" : "text-sm text-gray-700"}`}
                >
                  {isElderly ? "HỌ VÀ TÊN" : "Họ và tên"}
                </label>
                <div className="relative">
                  <User
                    size={isElderly ? 24 : 20}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 ${isElderly ? "text-amber-500" : "text-gray-400"}`}
                  />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full rounded-xl border transition-all ${
                      isElderly
                        ? "px-14 py-5 text-xl border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-200"
                        : "px-12 py-3.5 text-base border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    } outline-none`}
                    placeholder={isElderly ? "Nhập họ và tên" : "Nhập họ và tên của bạn"}
                  />
                </div>
              </div>

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
                    placeholder={isElderly ? "Nhập email" : "Nhập email của bạn"}
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
                    placeholder={isElderly ? "Tối thiểu 6 ký tự" : "Tối thiểu 6 ký tự"}
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

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className={`block mb-2 ${isElderly ? "text-xl text-amber-900" : "text-sm text-gray-700"}`}
                >
                  {isElderly ? "XÁC NHẬN MẬT KHẨU" : "Xác nhận mật khẩu"}
                </label>
                <div className="relative">
                  <Lock
                    size={isElderly ? 24 : 20}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 ${isElderly ? "text-amber-500" : "text-gray-400"}`}
                  />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full rounded-xl border transition-all ${
                      isElderly
                        ? "px-14 py-5 text-xl border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-200"
                        : "px-12 py-3.5 text-base border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    } outline-none pr-14`}
                    placeholder={isElderly ? "Nhập lại mật khẩu" : "Nhập lại mật khẩu"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 ${isElderly ? "text-amber-500" : "text-gray-400"} hover:opacity-70`}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={isElderly ? 24 : 20} />
                    ) : (
                      <Eye size={isElderly ? 24 : 20} />
                    )}
                  </button>
                </div>
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
                    <UserPlus size={isElderly ? 24 : 20} />
                    <span>{isElderly ? "ĐĂNG KÝ" : "Đăng ký"}</span>
                  </>
                )}
              </button>
            </form>

            {/* Login Link */}
            <div className={`mt-8 text-center ${isElderly ? "text-xl" : "text-sm"}`}>
              <span className={isElderly ? "text-amber-700" : "text-gray-600"}>
                {isElderly ? "Đã có tài khoản? " : "Đã có tài khoản? "}
              </span>
              <Link
                to="/login"
                className={`${
                  isElderly
                    ? "text-amber-600 hover:text-amber-700"
                    : "text-emerald-600 hover:text-emerald-700"
                } transition-colors underline`}
              >
                {isElderly ? "ĐĂNG NHẬP NGAY" : "Đăng nhập ngay"}
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