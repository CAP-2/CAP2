import React from "react";
import { useMode } from "./ModeContext";
import { FamilyMember, familyMembers } from "./familyData";
import { Calendar, Star } from "lucide-react";
import { motion } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface TimelineProps {
  onSelectMember: (member: FamilyMember) => void;
}

export function Timeline({ onSelectMember }: TimelineProps) {
  const { isElderly } = useMode();
  const sorted = [...familyMembers].sort((a, b) => a.birthYear - b.birthYear);

  return (
    <div
      className={`rounded-2xl border p-6 ${
        isElderly
          ? "bg-amber-50/50 border-amber-200"
          : "bg-gradient-to-br from-gray-50 to-white border-gray-100"
      }`}
    >
      <h2
        className={`mb-6 text-center ${
          isElderly ? "text-2xl text-amber-800" : "text-lg text-gray-700"
        }`}
      >
        📅 Dòng Thời Gian Gia Đình
      </h2>

      <div className="relative">
        {/* Vertical line */}
        <div
          className={`absolute left-6 sm:left-1/2 top-0 bottom-0 w-0.5 ${
            isElderly ? "bg-amber-300" : "bg-emerald-200"
          }`}
        />

        <div className="space-y-8">
          {sorted.map((member, index) => {
            const isLeft = index % 2 === 0;
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className={`relative flex items-center ${
                  isLeft
                    ? "sm:flex-row flex-row"
                    : "sm:flex-row-reverse flex-row"
                }`}
              >
                {/* Dot */}
                <div
                  className={`absolute left-6 sm:left-1/2 -translate-x-1/2 z-10 rounded-full flex items-center justify-center ${
                    isElderly
                      ? "w-10 h-10 bg-amber-400 border-4 border-amber-100"
                      : "w-8 h-8 bg-emerald-400 border-4 border-white"
                  }`}
                >
                  <Star
                    size={isElderly ? 16 : 12}
                    className="text-white"
                    fill="currentColor"
                  />
                </div>

                {/* Content */}
                <div
                  className={`ml-16 sm:ml-0 sm:w-[calc(50%-2rem)] ${
                    isLeft ? "sm:pr-8 sm:text-right" : "sm:pl-8"
                  }`}
                >
                  <button
                    onClick={() => onSelectMember(member)}
                    className={`w-full rounded-2xl border transition-all text-left ${
                      isElderly
                        ? "p-4 bg-white border-amber-200 hover:border-amber-400 hover:shadow-lg"
                        : "p-3 bg-white border-gray-100 hover:border-emerald-300 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-3 ${
                        isLeft ? "sm:flex-row-reverse" : ""
                      }`}
                    >
                      <div
                        className={`rounded-full overflow-hidden flex-shrink-0 ${
                          isElderly ? "w-14 h-14" : "w-10 h-10"
                        }`}
                      >
                        <ImageWithFallback
                          src={member.avatar}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className={isLeft ? "sm:text-right" : ""}>
                        <p
                          className={`${
                            isElderly
                              ? "text-lg text-amber-900"
                              : "text-sm text-gray-800"
                          }`}
                        >
                          {member.name}
                        </p>
                        <div
                          className={`flex items-center gap-1 ${
                            isLeft ? "sm:justify-end" : ""
                          } ${
                            isElderly
                              ? "text-base text-amber-600"
                              : "text-xs text-gray-500"
                          }`}
                        >
                          <Calendar size={isElderly ? 16 : 12} />
                          <span>
                            {member.birthYear}
                            {member.deathYear
                              ? ` - ${member.deathYear}`
                              : ""}
                          </span>
                        </div>
                        <p
                          className={`${
                            isElderly
                              ? "text-sm text-amber-500"
                              : "text-xs text-gray-400"
                          }`}
                        >
                          {member.role}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
