import React, { useState, useMemo } from "react";
import { useMode } from "../components/ModeContext";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { MemberCard } from "../components/MemberCard";
import { MemberDetail } from "../components/MemberDetail";
import { FamilyTree } from "../components/FamilyTree";
import { Timeline } from "../components/Timeline";
import { familyMembers, FamilyMember, totalGenerations, totalMembers } from "../components/familyData";
import { motion } from "motion/react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { TreePine, Users, Heart, Sparkles } from "lucide-react";

function HeroBanner() {
  const { isElderly } = useMode();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl overflow-hidden relative mb-6 ${
        isElderly ? "min-h-[200px]" : "min-h-[180px]"
      }`}
    >
      <ImageWithFallback
        src="https://images.unsplash.com/photo-1767604014109-f9a12085bd66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaXRpb25hbCUyMHZpZXRuYW1lc2UlMjBmYW1pbHklMjBnYXRoZXJpbmd8ZW58MXx8fHwxNzczMTQ4MDM4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
        alt="Gia đình"
        className="w-full h-full object-cover absolute inset-0"
      />
      <div
        className={`absolute inset-0 ${
          isElderly
            ? "bg-gradient-to-r from-amber-900/80 via-amber-800/60 to-amber-700/40"
            : "bg-gradient-to-r from-emerald-900/70 via-teal-800/50 to-cyan-700/30"
        }`}
      />
      <div className="relative z-10 p-6 sm:p-8 flex flex-col justify-center h-full min-h-[inherit]">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={isElderly ? 24 : 18} className="text-yellow-300" />
          <span
            className={`text-white/80 ${
              isElderly ? "text-lg" : "text-sm"
            }`}
          >
            Phần mềm Gia phả AI
          </span>
        </div>
        <h1
          className={`text-white mb-2 ${
            isElderly ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
          }`}
        >
          Dòng Họ Nguyễn
        </h1>
        <p
          className={`text-white/80 max-w-lg ${
            isElderly ? "text-lg" : "text-sm"
          }`}
        >
          Gìn giữ và kết nối thế hệ. Khám phá cội nguồn gia đình qua {totalGenerations} đời
          với {totalMembers} thành viên.
        </p>
        <div className="flex gap-3 mt-4">
          {[
            { icon: Users, label: `${totalMembers} thành viên` },
            { icon: TreePine, label: `${totalGenerations} đời` },
            { icon: Heart, label: "4 cặp đôi" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white ${
                isElderly ? "text-base" : "text-xs"
              }`}
            >
              <stat.icon size={isElderly ? 18 : 14} />
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function MainApp() {
  const { isElderly } = useMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedGeneration, setSelectedGeneration] = useState<number | null>(null);
  const [activeView, setActiveView] = useState("tree");
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  const filteredMembers = useMemo(() => {
    let result = familyMembers;
    if (selectedGeneration) {
      result = result.filter((m) => m.generation === selectedGeneration);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          m.birthPlace?.toLowerCase().includes(q) ||
          m.occupation?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [selectedGeneration, searchQuery]);

  return (
    <div
      className={`min-h-screen ${
        isElderly ? "bg-amber-25 bg-orange-50/30" : "bg-gray-50/50"
      }`}
    >
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="flex">
        {/* Sidebar - always visible on desktop */}
        <div className="hidden lg:block">
          <Sidebar
            open={true}
            selectedGeneration={selectedGeneration}
            setSelectedGeneration={setSelectedGeneration}
            activeView={activeView}
            setActiveView={setActiveView}
          />
        </div>
        {/* Mobile sidebar */}
        <div className="lg:hidden">
          <Sidebar
            open={sidebarOpen}
            selectedGeneration={selectedGeneration}
            setSelectedGeneration={setSelectedGeneration}
            activeView={activeView}
            setActiveView={setActiveView}
          />
        </div>

        {/* Main area */}
        <main className="flex-1 p-4 sm:p-6 max-w-6xl">
          <HeroBanner />

          {/* View content */}
          {activeView === "tree" && (
            <FamilyTree onSelectMember={setSelectedMember} />
          )}

          {activeView === "timeline" && (
            <Timeline onSelectMember={setSelectedMember} />
          )}

          {activeView === "list" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2
                  className={`${
                    isElderly ? "text-2xl text-amber-800" : "text-lg text-gray-700"
                  }`}
                >
                  {selectedGeneration
                    ? `Đời thứ ${selectedGeneration}`
                    : "Tất cả thành viên"}
                  <span
                    className={`ml-2 ${
                      isElderly ? "text-lg text-amber-500" : "text-sm text-gray-400"
                    }`}
                  >
                    ({filteredMembers.length} người)
                  </span>
                </h2>
              </div>

              {filteredMembers.length === 0 ? (
                <div
                  className={`text-center py-16 rounded-2xl border ${
                    isElderly
                      ? "bg-white border-amber-200"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <Users
                    size={isElderly ? 56 : 48}
                    className={`mx-auto mb-4 ${
                      isElderly ? "text-amber-300" : "text-gray-300"
                    }`}
                  />
                  <p
                    className={`${
                      isElderly
                        ? "text-xl text-amber-600"
                        : "text-base text-gray-500"
                    }`}
                  >
                    Không tìm thấy thành viên nào
                  </p>
                </div>
              ) : (
                <div
                  className={`grid gap-4 ${
                    isElderly
                      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  }`}
                >
                  {filteredMembers.map((member, index) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      onClick={setSelectedMember}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Quick access cards for tree/timeline view */}
          {(activeView === "tree" || activeView === "timeline") && (
            <div className="mt-6">
              <h3
                className={`mb-4 ${
                  isElderly ? "text-xl text-amber-800" : "text-sm text-gray-500"
                }`}
              >
                Truy cập nhanh
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {familyMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={`flex-shrink-0 flex items-center gap-2 rounded-full border transition-all ${
                      isElderly
                        ? "px-4 py-2.5 bg-white border-amber-200 hover:border-amber-400 hover:shadow-md"
                        : "px-3 py-2 bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm"
                    }`}
                  >
                    <div
                      className={`rounded-full overflow-hidden ${
                        isElderly ? "w-10 h-10" : "w-7 h-7"
                      }`}
                    >
                      <ImageWithFallback
                        src={member.avatar}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span
                      className={`${
                        isElderly
                          ? "text-base text-amber-900"
                          : "text-xs text-gray-700"
                      }`}
                    >
                      {member.name.split(" ").slice(-2).join(" ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Member detail modal */}
      <MemberDetail
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onSelectMember={setSelectedMember}
      />
    </div>
  );
}
