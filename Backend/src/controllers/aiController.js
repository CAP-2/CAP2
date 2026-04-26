const AI_SERVER_URL = (process.env.AI_SERVER_URL || "http://localhost:8001").replace(/\/+$/, "");

const extractAiText = (data) => {
  if (!data) return "";
  if (typeof data.answer === "string") return data.answer;
  if (typeof data.ai_message === "string") return data.ai_message;
  if (typeof data.message === "string") return data.message;
  if (typeof data.text === "string") return data.text;
  return "";
};

const publicFallback = (prompt) => {
  const text = String(prompt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "d");
  if (text.includes("dang nhap")) {
    return "Ban co the dang nhap bang tai khoan da duoc cap. Sau do he thong se dua ban vao trang phu hop voi vai tro cua minh.";
  }
  if (text.includes("dang ky")) {
    return "Ban co the dang ky tai khoan hoac dang ky dong ho moi tren trang chu. Sau khi gui thong tin, quan tri vien se xet duyet.";
  }
  return "Toi la tro ly AI cua Gia Pha Viet. Toi co the gioi thieu cach dang ky, dang nhap, quan ly cay gia pha, thanh vien, bai viet va su kien.";
};

exports.publicChat = async (req, res) => {
  try {
    const prompt = String(req.body?.message || req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ success: false, message: "Tin nhan khong duoc de trong" });
    }

    const response = await fetch(`${AI_SERVER_URL}/ask-db`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, scope: "public" }),
    });
    const data = await response.json().catch(() => ({}));
    const aiMessage = response.ok ? extractAiText(data) : "";

    return res.json({
      success: true,
      ai_message: aiMessage || publicFallback(prompt),
    });
  } catch (error) {
    return res.json({
      success: true,
      ai_message: publicFallback(req.body?.message || req.body?.prompt),
    });
  }
};
