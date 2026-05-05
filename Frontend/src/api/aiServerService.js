import { apiRequest } from "../services/api";

export const generateEventFormAI = async (payload) => {
  return apiRequest("/api/ai/event-form/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export default {
  generateEventFormAI,
};