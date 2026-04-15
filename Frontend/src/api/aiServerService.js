const AI_SERVER_URL = (import.meta.env.VITE_AI_SERVER_URL || "http://localhost:8001").replace(/\/+$/, "");

export async function askAiServer(prompt) {
  const response = await fetch(`${AI_SERVER_URL}/ask-db`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = result.message || result.details || `HTTP ${response.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return result;
}
