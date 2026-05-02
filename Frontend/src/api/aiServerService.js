const AI_PROXY_URL = "/api/ai/public-chat";

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

  return parseResponse(response, "Khong the goi tro ly AI");
}

export async function askAiServer(prompt) {
  return postPublicAiChat(prompt);
}

export async function sendPublicAiChat(message) {
  return postPublicAiChat(message);
}
