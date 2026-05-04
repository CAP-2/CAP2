import { apiRequest } from "../services/api";

const AI_PROXY_URL = "/api/ai/public-chat";
const AI_EVENT_FORM_URL = "/api/ai/event-form/generate";

const parseResponse = async (response, fallbackMessage) => {
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = result.message || result.details || fallbackMessage || `HTTP ${response.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return result;
};

async function postPublicAiChat(message) {
  const response = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  return parseResponse(response, "Không thể gọi trợ lý AI");
}

export async function askAiServer(prompt) {
  return postPublicAiChat(prompt);
}

export async function sendPublicAiChat(message) {
  return postPublicAiChat(message);
}

export async function generateEventFormAI(payload) {
  return apiRequest(AI_EVENT_FORM_URL, {
    method: "POST",
    body: JSON.stringify({
      mode: payload.mode,
      prompt: payload.prompt,
      today: payload.today || new Date().toISOString().slice(0, 10),
      clan_id: payload.clan_id || null,
      current_event: payload.current_event || null,
      existing_tasks: Array.isArray(payload.existing_tasks) ? payload.existing_tasks : [],
    }),
  });
}