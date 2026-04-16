const BASE_URL = "/api/member";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseResponse = async (res, fallbackMessage) => {
  const text = await res.text();
  let result = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = {};
  }
  if (!res.ok) {
    throw new Error(result.message || fallbackMessage);
  }
  return result;
};

export const getMemberDashboard = async () => {
  const res = await fetch(`${BASE_URL}/dashboard`, {
    headers: getAuthHeaders(),
  });
  return parseResponse(res, "Không thể tải dữ liệu thành viên");
};

export const updateMemberProfile = async (payload) => {
  const res = await fetch(`${BASE_URL}/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Không thể cập nhật thông tin");
};

export const changeMemberPassword = async (payload) => {
  const res = await fetch(`${BASE_URL}/password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Không thể đổi mật khẩu");
};

export const getMemberChat = async () => {
  const res = await fetch(`${BASE_URL}/chat`, {
    headers: getAuthHeaders(),
  });
  return parseResponse(res, "Không thể tải lịch sử chat");
};

export const sendMemberChat = async (message) => {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ message }),
  });
  return parseResponse(res, "Không thể gửi tin nhắn");
};

export const createMemberReminder = async (payload) => {
  const res = await fetch(`${BASE_URL}/reminders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Không thể tạo nhắc nhở");
};

export const getMemberTasks = async () => {
  const res = await fetch(`${BASE_URL}/tasks`, {
    headers: getAuthHeaders(),
  });
  return parseResponse(res, "Khong the tai cong viec duoc giao");
};

export const updateMemberTaskStatus = async (taskId, status) => {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ status }),
  });
  return parseResponse(res, "Khong the cap nhat trang thai cong viec");
};

export const proposeProfileUpdate = async (payload) => {
  const res = await fetch(`${BASE_URL}/content/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Không thể gửi yêu cầu cập nhật hồ sơ");
};

export const submitMaterial = async (payload) => {
  const res = await fetch(`${BASE_URL}/content/post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Không thể gửi tư liệu đóng góp");
};

export const getGeneralPosts = async () => {
  const res = await fetch(`${BASE_URL}/posts/general`, {
    headers: getAuthHeaders(),
  });
  return parseResponse(res, "Không thể tải bài viết");
};

export const getMySubmissions = async () => {
  const res = await fetch(`${BASE_URL}/submissions`, {
    headers: getAuthHeaders(),
  });
  return parseResponse(res, "Không thể tải danh sách đóng góp");
};

export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`/api/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
  return parseResponse(res, "Không thể tải ảnh lên");
};
