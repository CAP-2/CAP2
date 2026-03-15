export interface FamilyMember {
  id: string;
  name: string;
  birthYear: number;
  deathYear?: number;
  gender: "male" | "female";
  generation: number;
  parentId?: string;
  spouseId?: string;
  avatar: string;
  role: string;
  birthPlace?: string;
  occupation?: string;
  bio?: string;
}

export const familyMembers: FamilyMember[] = [
  {
    id: "1",
    name: "Nguyễn Văn Tổ",
    birthYear: 1930,
    deathYear: 2010,
    gender: "male",
    generation: 1,
    avatar: "https://images.unsplash.com/photo-1766973305236-7788b8318d8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMGVsZGVybHklMjBncmFuZGZhdGhlciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzE0ODAzNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    role: "Ông Tổ - Đời thứ 1",
    birthPlace: "Hà Nội",
    occupation: "Nông dân",
    bio: "Người sáng lập dòng họ, một nông dân cần mẫn và đức độ. Ông đã xây dựng nền tảng vững chắc cho gia đình.",
    spouseId: "2",
  },
  {
    id: "2",
    name: "Trần Thị Hoa",
    birthYear: 1932,
    deathYear: 2015,
    gender: "female",
    generation: 1,
    avatar: "https://images.unsplash.com/photo-1772160042426-53ceedcf62b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMGdyYW5kbW90aGVyJTIwZWxkZXJseSUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzE0ODAzNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    role: "Bà Tổ - Đời thứ 1",
    birthPlace: "Hà Nam",
    occupation: "Nội trợ",
    bio: "Người phụ nữ hiền lành, đảm đang. Bà luôn là chỗ dựa vững chắc cho cả gia đình.",
    spouseId: "1",
  },
  {
    id: "3",
    name: "Nguyễn Văn Hùng",
    birthYear: 1955,
    gender: "male",
    generation: 2,
    parentId: "1",
    avatar: "https://images.unsplash.com/photo-1758600431242-54c6f0ca1d04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG1pZGRsZSUyMGFnZWQlMjBtYW4lMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMxNDgwMzZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    role: "Con trưởng - Đời thứ 2",
    birthPlace: "Hà Nội",
    occupation: "Giáo viên",
    bio: "Con trai cả, nối dõi truyền thống gia đình. Ông là giáo viên tận tâm với nghề.",
    spouseId: "4",
  },
  {
    id: "4",
    name: "Lê Thị Mai",
    birthYear: 1958,
    gender: "female",
    generation: 2,
    avatar: "https://images.unsplash.com/photo-1771924367247-3ea9ec09a258?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG1pZGRsZSUyMGFnZWQlMjB3b21hbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzE0ODAzN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    role: "Con dâu - Đời thứ 2",
    birthPlace: "Nam Định",
    occupation: "Bác sĩ",
    bio: "Người phụ nữ tài năng và nhân hậu, luôn chăm lo cho sức khỏe cả gia đình.",
    spouseId: "3",
  },
  {
    id: "5",
    name: "Nguyễn Minh Tuấn",
    birthYear: 1982,
    gender: "male",
    generation: 3,
    parentId: "3",
    avatar: "https://images.unsplash.com/photo-1770392988936-dc3d8581e0c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMGFzaWFuJTIwbWFuJTIwcG9ydHJhaXQlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzczMTQ4MDM3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    role: "Cháu trưởng - Đời thứ 3",
    birthPlace: "Hà Nội",
    occupation: "Kỹ sư CNTT",
    bio: "Thế hệ trẻ năng động, đam mê công nghệ. Anh đang làm việc tại một công ty công nghệ lớn.",
    spouseId: "6",
  },
  {
    id: "6",
    name: "Phạm Thị Lan",
    birthYear: 1985,
    gender: "female",
    generation: 3,
    avatar: "https://images.unsplash.com/photo-1758600587839-56ba05596c69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMGFzaWFuJTIwd29tYW4lMjBwb3J0cmFpdCUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NzMxNDgwMzd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    role: "Con dâu - Đời thứ 3",
    birthPlace: "Hải Phòng",
    occupation: "Kiến trúc sư",
    bio: "Kiến trúc sư tài năng, người mang đến sự sáng tạo cho gia đình.",
    spouseId: "5",
  },
  {
    id: "7",
    name: "Nguyễn Gia Bảo",
    birthYear: 2010,
    gender: "male",
    generation: 4,
    parentId: "5",
    avatar: "https://images.unsplash.com/photo-1617718860151-f7eb5e599d8e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMGNoaWxkJTIwYm95JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzczMTQ4MDM4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    role: "Chắt - Đời thứ 4",
    birthPlace: "Hà Nội",
    occupation: "Học sinh",
    bio: "Cậu bé thông minh, ham học hỏi. Niềm hy vọng của cả gia đình.",
  },
  {
    id: "8",
    name: "Nguyễn Minh Anh",
    birthYear: 2013,
    gender: "female",
    generation: 4,
    parentId: "5",
    avatar: "https://images.unsplash.com/photo-1571270237703-6ac8a769ad7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMGNoaWxkJTIwZ2lybCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzE0ODAzOHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    role: "Chắt - Đời thứ 4",
    birthPlace: "Hà Nội",
    occupation: "Học sinh",
    bio: "Cô bé đáng yêu, giỏi vẽ tranh và rất yêu thương mọi người trong gia đình.",
  },
];

export function getChildren(parentId: string): FamilyMember[] {
  return familyMembers.filter((m) => m.parentId === parentId);
}

export function getSpouse(member: FamilyMember): FamilyMember | undefined {
  if (!member.spouseId) return undefined;
  return familyMembers.find((m) => m.id === member.spouseId);
}

export function getParent(member: FamilyMember): FamilyMember | undefined {
  if (!member.parentId) return undefined;
  return familyMembers.find((m) => m.id === member.parentId);
}

export function getMembersByGeneration(generation: number): FamilyMember[] {
  return familyMembers.filter((m) => m.generation === generation);
}

export const totalGenerations = Math.max(...familyMembers.map((m) => m.generation));
export const totalMembers = familyMembers.length;
