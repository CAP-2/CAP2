import React from "react";
import { useMode } from "./ModeContext";
import { FamilyMember, familyMembers, getChildren, getSpouse } from "./familyData";
import { Heart, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface FamilyTreeProps {
  onSelectMember: (member: FamilyMember) => void;
}

function TreeNode({
  member,
  onSelectMember,
  depth = 0,
}: {
  member: FamilyMember;
  onSelectMember: (member: FamilyMember) => void;
  depth?: number;
}) {
  const { isElderly } = useMode();
  const spouse = getSpouse(member);
  const children = getChildren(member.id);

  return (
    <div className="flex flex-col items-center">
      {/* Couple */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: depth * 0.15, duration: 0.4 }}
        className="flex items-center gap-2"
      >
        {/* Member */}
        <button
          onClick={() => onSelectMember(member)}
          className={`flex flex-col items-center rounded-2xl border transition-all ${
            isElderly
              ? "p-4 bg-white border-amber-200 hover:border-amber-400 hover:shadow-lg min-w-[140px]"
              : "p-3 bg-white border-gray-100 hover:border-emerald-300 hover:shadow-lg min-w-[120px]"
          }`}
        >
          <div
            className={`rounded-full overflow-hidden ring-2 mb-2 ${
              isElderly
                ? `w-16 h-16 ${
                    member.gender === "male"
                      ? "ring-blue-300"
                      : "ring-pink-300"
                  }`
                : `w-12 h-12 ${
                    member.gender === "male"
                      ? "ring-blue-200"
                      : "ring-pink-200"
                  }`
            }`}
          >
            <ImageWithFallback
              src={member.avatar}
              alt={member.name}
              className="w-full h-full object-cover"
            />
          </div>
          <p
            className={`text-center ${
              isElderly
                ? "text-base text-amber-900"
                : "text-xs text-gray-800"
            }`}
          >
            {member.name.split(" ").slice(-2).join(" ")}
          </p>
          <p
            className={`${
              isElderly
                ? "text-sm text-amber-500"
                : "text-xs text-gray-400"
            }`}
          >
            {member.birthYear}
            {member.deathYear ? ` - ${member.deathYear}` : ""}
          </p>
        </button>

        {/* Spouse */}
        {spouse && (
          <>
            <div className="flex items-center">
              <div
                className={`w-6 h-px ${
                  isElderly ? "bg-red-300" : "bg-pink-200"
                }`}
              />
              <Heart
                size={isElderly ? 18 : 14}
                className={`mx-1 ${
                  isElderly ? "text-red-400" : "text-pink-300"
                }`}
                fill="currentColor"
              />
              <div
                className={`w-6 h-px ${
                  isElderly ? "bg-red-300" : "bg-pink-200"
                }`}
              />
            </div>
            <button
              onClick={() => onSelectMember(spouse)}
              className={`flex flex-col items-center rounded-2xl border transition-all ${
                isElderly
                  ? "p-4 bg-white border-amber-200 hover:border-amber-400 hover:shadow-lg min-w-[140px]"
                  : "p-3 bg-white border-gray-100 hover:border-emerald-300 hover:shadow-lg min-w-[120px]"
              }`}
            >
              <div
                className={`rounded-full overflow-hidden ring-2 mb-2 ${
                  isElderly
                    ? `w-16 h-16 ${
                        spouse.gender === "male"
                          ? "ring-blue-300"
                          : "ring-pink-300"
                      }`
                    : `w-12 h-12 ${
                        spouse.gender === "male"
                          ? "ring-blue-200"
                          : "ring-pink-200"
                      }`
                }`}
              >
                <ImageWithFallback
                  src={spouse.avatar}
                  alt={spouse.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p
                className={`text-center ${
                  isElderly
                    ? "text-base text-amber-900"
                    : "text-xs text-gray-800"
                }`}
              >
                {spouse.name.split(" ").slice(-2).join(" ")}
              </p>
              <p
                className={`${
                  isElderly
                    ? "text-sm text-amber-500"
                    : "text-xs text-gray-400"
                }`}
              >
                {spouse.birthYear}
                {spouse.deathYear ? ` - ${spouse.deathYear}` : ""}
              </p>
            </button>
          </>
        )}
      </motion.div>

      {/* Children */}
      {children.length > 0 && (
        <>
          {/* Vertical connector */}
          <div
            className={`w-px h-8 ${
              isElderly ? "bg-amber-300" : "bg-gray-200"
            }`}
          />
          {children.length > 1 && (
            <div
              className={`h-px self-stretch mx-auto ${
                isElderly ? "bg-amber-300" : "bg-gray-200"
              }`}
              style={{
                width: `${Math.max(50, children.length * 40)}%`,
                maxWidth: "100%",
              }}
            />
          )}
          <div className="flex gap-6 sm:gap-10 flex-wrap justify-center">
            {children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div
                  className={`w-px h-8 ${
                    isElderly ? "bg-amber-300" : "bg-gray-200"
                  }`}
                />
                <TreeNode
                  member={child}
                  onSelectMember={onSelectMember}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FamilyTree({ onSelectMember }: FamilyTreeProps) {
  const { isElderly } = useMode();
  const rootMember = familyMembers.find((m) => !m.parentId && m.gender === "male");

  if (!rootMember) return null;

  return (
    <div
      className={`rounded-2xl border p-6 overflow-x-auto ${
        isElderly
          ? "bg-amber-50/50 border-amber-200"
          : "bg-gradient-to-br from-gray-50 to-white border-gray-100"
      }`}
    >
      <h2
        className={`mb-6 text-center ${
          isElderly
            ? "text-2xl text-amber-800"
            : "text-lg text-gray-700"
        }`}
      >
        🌳 Cây Gia Phả Dòng Họ Nguyễn
      </h2>
      <div className="flex justify-center min-w-[600px]">
        <TreeNode member={rootMember} onSelectMember={onSelectMember} />
      </div>
    </div>
  );
}
