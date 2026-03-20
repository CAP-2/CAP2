import React from "react";
import { useMode } from "./ModeContext";
import { FamilyMember, getSpouse, getChildren, getParent } from "./familyData";
import {
  X,
  Calendar,
  MapPin,
  Briefcase,
  Heart,
  Users,
  ArrowUp,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface MemberDetailProps {
  member: FamilyMember | null;
  onClose: () => void;
  onSelectMember: (member: FamilyMember) => void;
}

export function MemberDetail({ member, onClose, onSelectMember }: MemberDetailProps) {
  const { isElderly } = useMode();

  if (!member) return null;

  const spouse = getSpouse(member);
  const children = getChildren(member.id);
  const parent = getParent(member);

  return (
    <AnimatePresence>
      {member && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 overflow-y-auto rounded-3xl shadow-2xl ${
              isElderly
                ? "sm:w-[600px] sm:max-h-[85vh] bg-amber-50"
                : "sm:w-[520px] sm:max-h-[80vh] bg-white"
            }`}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className={`absolute top-4 right-4 z-10 rounded-full transition-colors ${
                isElderly
                  ? "p-3 bg-amber-200/80 text-amber-800 hover:bg-amber-300"
                  : "p-2 bg-white/80 backdrop-blur text-gray-500 hover:bg-white hover:text-gray-700"
              }`}
            >
              <X size={isElderly ? 28 : 20} />
            </button>

            {/* Hero */}
            <div className="relative">
              <div className={isElderly ? "h-64" : "h-52"}>
                <ImageWithFallback
                  src={member.avatar}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
                <div
                  className={`absolute inset-0 ${
                    isElderly
                      ? "bg-gradient-to-t from-amber-50 via-amber-50/50 to-transparent"
                      : "bg-gradient-to-t from-white via-white/40 to-transparent"
                  }`}
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-2">
                <div
                  className={`inline-block px-3 py-1 rounded-full mb-2 ${
                    isElderly
                      ? "bg-amber-500 text-white text-base"
                      : "bg-emerald-500 text-white text-xs"
                  }`}
                >
                  {member.role}
                </div>
                <h2
                  className={`${
                    isElderly
                      ? "text-3xl text-amber-900"
                      : "text-2xl text-gray-900"
                  }`}
                >
                  {member.name}
                </h2>
              </div>
            </div>

            {/* Content */}
            <div className={`px-6 pb-6 ${isElderly ? "space-y-5" : "space-y-4"}`}>
              {/* Bio */}
              {member.bio && (
                <div
                  className={`rounded-2xl p-4 ${
                    isElderly
                      ? "bg-amber-100/60 border border-amber-200"
                      : "bg-gray-50 border border-gray-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <BookOpen
                      size={isElderly ? 22 : 18}
                      className={`mt-0.5 flex-shrink-0 ${
                        isElderly ? "text-amber-600" : "text-emerald-500"
                      }`}
                    />
                    <p
                      className={`${
                        isElderly
                          ? "text-lg text-amber-800 leading-relaxed"
                          : "text-sm text-gray-600 leading-relaxed"
                      }`}
                    >
                      {member.bio}
                    </p>
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div className={`grid grid-cols-2 gap-3`}>
                {[
                  {
                    icon: Calendar,
                    label: "Năm sinh - Mất",
                    value: `${member.birthYear}${
                      member.deathYear ? ` - ${member.deathYear}` : " - Nay"
                    }`,
                  },
                  {
                    icon: MapPin,
                    label: "Quê quán",
                    value: member.birthPlace || "Chưa rõ",
                  },
                  {
                    icon: Briefcase,
                    label: "Nghề nghiệp",
                    value: member.occupation || "Chưa rõ",
                  },
                  {
                    icon: Users,
                    label: "Giới tính",
                    value: member.gender === "male" ? "Nam" : "Nữ",
                  },
                ].map((info) => (
                  <div
                    key={info.label}
                    className={`rounded-xl p-3 ${
                      isElderly
                        ? "bg-white border border-amber-200"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <info.icon
                        size={isElderly ? 20 : 16}
                        className={
                          isElderly ? "text-amber-500" : "text-emerald-500"
                        }
                      />
                      <span
                        className={`${
                          isElderly
                            ? "text-sm text-amber-600"
                            : "text-xs text-gray-400"
                        }`}
                      >
                        {info.label}
                      </span>
                    </div>
                    <p
                      className={`${
                        isElderly
                          ? "text-lg text-amber-900"
                          : "text-sm text-gray-800"
                      }`}
                    >
                      {info.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Relations */}
              <div className={`space-y-3`}>
                <h4
                  className={`${
                    isElderly
                      ? "text-xl text-amber-800"
                      : "text-sm text-gray-700"
                  }`}
                >
                  Quan hệ gia đình
                </h4>

                {parent && (
                  <button
                    onClick={() => onSelectMember(parent)}
                    className={`w-full flex items-center gap-3 rounded-xl border transition-all ${
                      isElderly
                        ? "p-4 bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50"
                        : "p-3 bg-gray-50 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50"
                    }`}
                  >
                    <div
                      className={`rounded-full overflow-hidden flex-shrink-0 ${
                        isElderly ? "w-14 h-14" : "w-10 h-10"
                      }`}
                    >
                      <ImageWithFallback
                        src={parent.avatar}
                        alt={parent.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={`${
                          isElderly
                            ? "text-xs text-amber-500"
                            : "text-xs text-gray-400"
                        }`}
                      >
                        <ArrowUp size={12} className="inline mr-1" />
                        Cha/Mẹ
                      </p>
                      <p
                        className={
                          isElderly
                            ? "text-lg text-amber-900"
                            : "text-sm text-gray-800"
                        }
                      >
                        {parent.name}
                      </p>
                    </div>
                  </button>
                )}

                {spouse && (
                  <button
                    onClick={() => onSelectMember(spouse)}
                    className={`w-full flex items-center gap-3 rounded-xl border transition-all ${
                      isElderly
                        ? "p-4 bg-white border-amber-200 hover:border-red-300 hover:bg-red-50/50"
                        : "p-3 bg-gray-50 border-gray-100 hover:border-pink-200 hover:bg-pink-50/50"
                    }`}
                  >
                    <div
                      className={`rounded-full overflow-hidden flex-shrink-0 ${
                        isElderly ? "w-14 h-14" : "w-10 h-10"
                      }`}
                    >
                      <ImageWithFallback
                        src={spouse.avatar}
                        alt={spouse.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={`${
                          isElderly
                            ? "text-xs text-red-500"
                            : "text-xs text-pink-400"
                        }`}
                      >
                        <Heart size={12} className="inline mr-1" />
                        Vợ/Chồng
                      </p>
                      <p
                        className={
                          isElderly
                            ? "text-lg text-amber-900"
                            : "text-sm text-gray-800"
                        }
                      >
                        {spouse.name}
                      </p>
                    </div>
                  </button>
                )}

                {children.length > 0 && (
                  <div className="space-y-2">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => onSelectMember(child)}
                        className={`w-full flex items-center gap-3 rounded-xl border transition-all ${
                          isElderly
                            ? "p-4 bg-white border-amber-200 hover:border-blue-300 hover:bg-blue-50/50"
                            : "p-3 bg-gray-50 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50"
                        }`}
                      >
                        <div
                          className={`rounded-full overflow-hidden flex-shrink-0 ${
                            isElderly ? "w-14 h-14" : "w-10 h-10"
                          }`}
                        >
                          <ImageWithFallback
                            src={child.avatar}
                            alt={child.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 text-left">
                          <p
                            className={`${
                              isElderly
                                ? "text-xs text-blue-500"
                                : "text-xs text-emerald-400"
                            }`}
                          >
                            <Users size={12} className="inline mr-1" />
                            Con
                          </p>
                          <p
                            className={
                              isElderly
                                ? "text-lg text-amber-900"
                                : "text-sm text-gray-800"
                            }
                          >
                            {child.name}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
