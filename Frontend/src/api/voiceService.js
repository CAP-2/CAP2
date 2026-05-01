const BASE_URL = "/api/voice";

const getAuthHeaders = () => {
  const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseResponse = async (response, fallbackMessage) => {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof result.message === "string" && result.message ? result.message : fallbackMessage;
    const error = new Error(message);
    error.status = response.status;
    error.data = result;
    throw error;
  }
  return result;
};

export const uploadVoiceRecording = async (blob, options = {}) => {
  const formData = new FormData();
  formData.append("audio", blob, options.filename || "recording.webm");
  if (options.durationSeconds) {
    formData.append("duration_seconds", String(Math.round(options.durationSeconds)));
  }

  const response = await fetch(`${BASE_URL}/recordings`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return parseResponse(response, "Khong the tai ghi am len.");
};

export const getVoiceRecording = async (id) => {
  const response = await fetch(`${BASE_URL}/recordings/${id}`, {
    headers: getAuthHeaders(),
  });

  return parseResponse(response, "Khong the tai ket qua ghi am.");
};

export const getVoiceRecordings = async (limit = 50) => {
  const response = await fetch(`${BASE_URL}/recordings?limit=${encodeURIComponent(limit)}`, {
    headers: getAuthHeaders(),
  });

  return parseResponse(response, "Khong the tai danh sach ghi am.");
};
