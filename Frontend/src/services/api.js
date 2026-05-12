const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("auth_token");
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || "Có lỗi xảy ra.");
  }

  return data;
}

export function postJson(endpoint, body) {
  return apiRequest(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
