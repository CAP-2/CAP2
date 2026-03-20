import React from "react";
import { useMode } from "./ModeContext";
import { familyMembers, totalGenerations, totalMembers, getMembersByGeneration } from "./familyData";
import { Users, Calendar, MapPin, BookOpen, Heart, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SidebarProps {
  open: boolean;
  selectedGeneration: number | null;
  setSelectedGeneration: (gen: number | null) => void;
  activeView: string;
  setActiveView: (view: string) => void;
}

export function Sidebar({
  open,
  selectedGeneration,
  setSelectedGeneration,
  activeView,
  setActiveView,
}: SidebarProps) {
  const { isElderly } = useMode();

  const stats = [
    { icon: Users, label: "Thành viên", value: totalMembers },
    { icon: Calendar, label: "Đời", value: totalGenerations },
    { icon: Heart, label: "Cặp đôi", value: 4 },
  ];

  const menuItems = [
    { id: "tree", icon: BookOpen, label: "Cây gia phả" },
    { id: "list", icon: Users, label: "Danh sách" },
    { id: "timeline", icon: Calendar, label: "Dòng thời gian" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/30 z-30"
            onClick={() => {}}
          />
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed lg:sticky top-0 left-0 h-screen z-40 overflow-y-auto ${
              isElderly
                ? "w-80 bg-amber-50 border-r border-amber-200"
                : "w-72 bg-white border-r border-gray-100"
            }`}
          >
            <div className={`p-5 pt-20 lg:pt-5 space-y-6`}>
              {/* Stats */}
              <div
                className={`rounded-2xl p-4 ${
                  isElderly
                    ? "bg-gradient-to-br from-amber-100 to-orange-100"
                    : "bg-gradient-to-br from-emerald-50 to-teal-50"
                }`}
              >
                <h3
                  className={`mb-3 ${
                    isElderly
                      ? "text-xl text-amber-900"
                      : "text-sm text-gray-700"
                  }`}
                >
                  Thống kê gia phả
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {stats.map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div
                        className={`mx-auto mb-1 rounded-xl flex items-center justify-center ${
                          isElderly
                            ? "w-12 h-12 bg-amber-200/70"
                            : "w-10 h-10 bg-white/80"
                        }`}
                      >
                        <stat.icon
                          size={isElderly ? 24 : 18}
                          className={
                            isElderly ? "text-amber-700" : "text-emerald-600"
                          }
                        />
                      </div>
                      <p
                        className={`${
                          isElderly
                            ? "text-2xl text-amber-900"
                            : "text-lg text-gray-900"
                        }`}
                      >
                        {stat.value}
                      </p>
                      <p
                        className={`${
                          isElderly
                            ? "text-sm text-amber-700"
                            : "text-xs text-gray-500"
                        }`}
                      >
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Menu */}
              <div>
                <h3
                  className={`mb-2 ${
                    isElderly
                      ? "text-lg text-amber-800"
                      : "text-xs uppercase tracking-wider text-gray-400"
                  }`}
                >
                  Xem theo
                </h3>
                <div className="space-y-1">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveView(item.id)}
                      className={`w-full flex items-center gap-3 rounded-xl transition-all ${
                        isElderly
                          ? `px-4 py-3.5 text-lg ${
                              activeView === item.id
                                ? "bg-amber-200 text-amber-900"
                                : "text-amber-800 hover:bg-amber-100"
                            }`
                          : `px-3 py-2.5 text-sm ${
                              activeView === item.id
                                ? "bg-emerald-50 text-emerald-700"
                                : "text-gray-600 hover:bg-gray-50"
                            }`
                      }`}
                    >
                      <item.icon size={isElderly ? 24 : 18} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {activeView === item.id && (
                        <ChevronRight size={isElderly ? 20 : 16} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generation filter */}
              <div>
                <h3
                  className={`mb-2 ${
                    isElderly
                      ? "text-lg text-amber-800"
                      : "text-xs uppercase tracking-wider text-gray-400"
                  }`}
                >
                  Lọc theo đời
                </h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedGeneration(null)}
                    className={`w-full flex items-center gap-3 rounded-xl transition-all ${
                      isElderly
                        ? `px-4 py-3 text-lg ${
                            selectedGeneration === null
                              ? "bg-amber-200 text-amber-900"
                              : "text-amber-800 hover:bg-amber-100"
                          }`
                        : `px-3 py-2 text-sm ${
                            selectedGeneration === null
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-gray-600 hover:bg-gray-50"
                          }`
                    }`}
                  >
                    Tất cả
                  </button>
                  {Array.from({ length: totalGenerations }, (_, i) => i + 1).map(
                    (gen) => (
                      <button
                        key={gen}
                        onClick={() => setSelectedGeneration(gen)}
                        className={`w-full flex items-center justify-between rounded-xl transition-all ${
                          isElderly
                            ? `px-4 py-3 text-lg ${
                                selectedGeneration === gen
                                  ? "bg-amber-200 text-amber-900"
                                  : "text-amber-800 hover:bg-amber-100"
                              }`
                            : `px-3 py-2 text-sm ${
                                selectedGeneration === gen
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "text-gray-600 hover:bg-gray-50"
                              }`
                        }`}
                      >
                        <span>Đời thứ {gen}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            isElderly
                              ? "bg-amber-300/50 text-amber-800 text-base"
                              : "bg-gray-100 text-gray-500 text-xs"
                          }`}
                        >
                          {getMembersByGeneration(gen).length}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
