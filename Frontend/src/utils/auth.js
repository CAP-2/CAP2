import { postJson } from "../services/api";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function getDemoAccount() {
  return {
    email: "demo@example.com",
    password: "123456",
  };
}

export async function login(form) {
  const payload = {
    email: String(form.email || "").trim().toLowerCase(),
    password: String(form.password || ""),
  };

  const result = await postJson("/api/auth/login", payload);

  if (result?.token) {
    localStorage.setItem(TOKEN_KEY, result.token);
  }

  if (result?.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  }

  return result;
}

export async function register(form) {
  const displayName = String(form.display_name || "").trim();
  const parts = displayName.split(/\s+/).filter(Boolean);

  const payload = {
    email: String(form.email || "").trim().toLowerCase(),
    password: String(form.password || ""),
    display_name: displayName,
    first_name: parts[parts.length - 1] || displayName,
    middle_name: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
    surname: parts.length > 1 ? parts[0] : displayName,
    birth_date: form.birth_date || null,
    gender: form.gender || "other",
    hometown: form.hometown || "",
    clan_id: form.clan_id ? Number(form.clan_id) : null,
  };

  return postJson("/api/auth/register", payload);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  return getStoredUser();
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(getAuthToken() && getStoredUser());
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
