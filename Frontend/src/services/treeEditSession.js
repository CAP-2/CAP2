const STORAGE_KEY = "member_tree_edit_session";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function readTreeEditSession() {
  if (!canUseStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const key = typeof parsed?.key === "string" ? parsed.key.trim() : "";
    const expiresAt = typeof parsed?.expiresAt === "string" ? parsed.expiresAt : "";
    if (!key || !expiresAt) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.parse(expiresAt) <= Date.now()) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { key, expiresAt };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveTreeEditSession(session) {
  if (!canUseStorage()) return;
  const key = typeof session?.key === "string" ? session.key.trim() : "";
  const expiresAt = typeof session?.expiresAt === "string" ? session.expiresAt : "";
  if (!key || !expiresAt) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ key, expiresAt }));
}

export function clearTreeEditSession() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function getTreeEditKeyHeader() {
  const session = readTreeEditSession();
  return session?.key ? { "x-tree-edit-key": session.key } : {};
}
