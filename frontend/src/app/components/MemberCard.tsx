import React from "react";
import { useMode } from "./ModeContext";
import { FamilyMember, getSpouse, getChildren } from "./familyData";
import { MapPin, Calendar, Briefcase, Users, Heart } from "lucide-react";
import { motion } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface MemberCardProps {
  member: FamilyMember;
  onClick: (member: FamilyMember) => void;
  index?: number;
}

export function MemberCard({ member, onClick, index = 0 }: MemberCardProps) {
  const { isElderly } = useMode();
  const spouse = getSpouse(member);
  const children = getChildren(member.id);
  const isDeceased = !!member.deathYear;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={isElderly ? {} : { y: -4, scale: 1.02 }}
      onClick={() => onClick(member)}
      className={`cursor-pointer rounded-2xl border transition-all overflow-hidden group ${
        isElderly
          ? `bg-white border-amber-200 hover:border-amber-400 hover:shadow-lg ${
              isDeceased ? "opacity-85" : ""
            }`
          : `bg-white border-gray-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/50 ${
              isDeceased ? "opacity-80" : ""
            }`
      }`}
    >
      {/* Avatar section */}
      <div className="relative">
        <div
          className={`overflow-hidden ${
            isElderly ? "h-48" : "h-40"
          }`}
        >
          <ImageWithFallback
            src={member.avatar}
            alt={member.name}
            className={`w-full h-full object-cover transition-transform duration-500 ${
              !isElderly ? "group-hover:scale-110" : ""
            }`}
          />
          <div
            className={`absolute inset-0 ${
              isElderly
                ? "bg-gradient-to-t from-amber-900/60 to-transparent"
                : "bg-gradient-to-t from-black/50 to-transparent"
            }`}
          />
        </div>
        {/* Generation badge */}
        <div
          className={`absolute top-3 right-3 px-2.5 py-1 rounded-full backdrop-blur-md ${
            isElderly
              ? "bg-amber-500/90 text-white text-base"
              : "bg-white/90 text-gray-700 text-xs"
          }`}
        >
          Đời {member.generation}
        </div>
        {/* Gender indicator */}
        <div
          className={`absolute top-3 left-3 w-3 h-3 rounded-full ${
            member.gender === "male"
              ? "bg-blue-400"
              : "bg-pink-400"
          }`}
        />
        {isDeceased && (
          <div
            className={`absolute bottom-3 left-3 px-2 py-0.5 rounded-full ${
              isElderly
                ? "bg-gray-800/70 text-white text-sm"
                : "bg-black/50 text-white text-xs"
            }`}
          >
            Đã mất
          </div>
        )}
      </div>

      {/* Info section */}
      <div className={`${isElderly ? "p-5" : "p-4"}`}>
        <h3
          className={`mb-1 ${
            isElderly
              ? "text-xl text-amber-900"
              : "text-base text-gray-900"
          }`}
        >
          {member.name}
        </h3>
        <p
          className={`mb-3 ${
            isElderly
              ? "text-base text-amber-600"
              : "text-xs text-gray-500"
          }`}
        >
          {member.role}
        </p>

        <div className={`space-y-1.5 ${isElderly ? "text-base" : "text-xs"}`}>
          <div
            className={`flex items-center gap-2 ${
              isElderly ? "text-amber-700" : "text-gray-500"
            }`}
          >
            <Calendar size={isElderly ? 18 : 14} />
            <span>
              {member.birthYear}
              {member.deathYear ? ` - ${member.deathYear}` : " - Nay"}
            </span>
          </div>
          {member.birthPlace && (
            <div
              className={`flex items-center gap-2 ${
                isElderly ? "text-amber-700" : "text-gray-500"
              }`}
            >
              <MapPin size={isElderly ? 18 : 14} />
              <span>{member.birthPlace}</span>
            </div>
          )}
          {member.occupation && (
            <div
              className={`flex items-center gap-2 ${
                isElderly ? "text-amber-700" : "text-gray-500"
              }`}
            >
              <Briefcase size={isElderly ? 18 : 14} />
              <span>{member.occupation}</span>
            </div>
          )}
        </div>

        {/* Footer badges */}
        <div className={`flex gap-2 mt-3 pt-3 border-t ${
          isElderly ? "border-amber-100" : "border-gray-50"
        }`}>
          {spouse && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                isElderly
                  ? "bg-red-50 text-red-700 text-sm"
                  : "bg-pink-50 text-pink-600 text-xs"
              }`}
            >
              <Heart size={isElderly ? 14 : 12} />
              <span>{spouse.name.split(" ").slice(-1)}</span>
            </div>
          )}
          {children.length > 0 && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                isElderly
                  ? "bg-blue-50 text-blue-700 text-sm"
                  : "bg-emerald-50 text-emerald-600 text-xs"
              }`}
            >
              <Users size={isElderly ? 14 : 12} />
              <span>{children.length} con</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
