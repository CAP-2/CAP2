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
      return res.status(400).json({
        success: false,
        message: "Tin nhan khong duoc de trong",
      });
    }

    const response = await fetch(`${AI_SERVER_URL}/ask-db`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

const stripVietnamese = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const toIsoDate = (value) => {
  if (!value) return null;

  const text = String(value).trim();

  const ddmmyyyy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const yyyymmdd = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return null;
};

const addDays = (isoDate, days) => {
  if (!isoDate) return null;

  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const inferTitle = (prompt) => {
  const normalized = stripVietnamese(prompt);

  if (normalized.includes("gio to")) return "Giỗ tổ";
  if (normalized.includes("hop mat") || normalized.includes("hop ho")) return "Họp mặt dòng họ";
  if (normalized.includes("mung tho")) return "Mừng thọ";
  if (
    normalized.includes("tu sua") ||
    normalized.includes("sua chua") ||
    normalized.includes("nha tho ho") ||
    normalized.includes("tu duong")
  ) {
    return "Tu sửa từ đường";
  }

  const cleaned = String(prompt || "")
    .replace(/ngày\s+\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/gi, "")
    .trim();

  return cleaned.length > 60 ? cleaned.slice(0, 60).trim() : cleaned || "Sự kiện dòng họ";
};

const buildTasksForEvent = (title, eventDate, eventId = null, existingTasks = []) => {
  const normalizedTitle = stripVietnamese(title);
  const existing = new Set((existingTasks || []).map((task) => stripVietnamese(task?.title)));

  const before1 = eventDate ? addDays(eventDate, -1) : null;
  const before3 = eventDate ? addDays(eventDate, -3) : null;
  const sameDay = eventDate || null;

  let templates;

  if (normalizedTitle.includes("gio to")) {
    templates = [
      ["Chuẩn bị mâm cúng", "Chuẩn bị lễ vật, hương hoa và các vật phẩm cần thiết cho lễ giỗ tổ.", before1],
      ["Dọn dẹp từ đường", "Vệ sinh khu vực thờ cúng, sân và nơi tiếp đón trước ngày giỗ tổ.", before1],
      [
        "Thông báo con cháu tham dự",
        "Gửi thông báo thời gian, địa điểm và nội dung buổi giỗ tổ cho các thành viên trong dòng họ.",
        before3,
      ],
      ["Chuẩn bị khu vực tiếp khách", "Sắp xếp bàn ghế, nước uống và khu vực đón tiếp con cháu.", before1],
      ["Ghi nhận đóng góp", "Tổng hợp danh sách đóng góp và các khoản chi cho sự kiện.", sameDay],
    ];
  } else if (normalizedTitle.includes("mung tho")) {
    templates = [
      ["Chuẩn bị quà mừng thọ", "Chuẩn bị quà và lời chúc dành cho người được mừng thọ.", before1],
      ["Liên hệ gia đình tham dự", "Xác nhận danh sách người thân và con cháu tham dự lễ mừng thọ.", before3],
      ["Trang trí khu vực tổ chức", "Chuẩn bị phông nền, bàn ghế và khu vực chụp ảnh.", before1],
      ["Chụp ảnh và ghi hình", "Phân công người ghi lại hình ảnh trong buổi lễ.", sameDay],
    ];
  } else if (normalizedTitle.includes("tu sua") || normalizedTitle.includes("sua chua")) {
    templates = [
      ["Khảo sát hiện trạng", "Kiểm tra tình trạng từ đường hoặc nhà thờ họ trước khi tu sửa.", before3],
      ["Lập dự toán chi phí", "Tổng hợp hạng mục cần sửa và dự trù kinh phí.", before3],
      ["Liên hệ thợ sửa chữa", "Tìm và thống nhất lịch làm việc với đội thợ phù hợp.", before1],
      ["Kêu gọi đóng góp", "Thông báo kế hoạch tu sửa và ghi nhận đóng góp từ các thành viên.", sameDay],
    ];
  } else {
    templates = [
      ["Lập danh sách tham dự", "Tổng hợp danh sách thành viên dự kiến tham gia sự kiện.", before3],
      ["Chuẩn bị địa điểm", "Kiểm tra và sắp xếp không gian tổ chức sự kiện.", before1],
      ["Chuẩn bị chương trình", "Lên nội dung chính và trình tự hoạt động trong sự kiện.", before1],
      ["Phân công đón khách", "Sắp xếp người phụ trách đón tiếp và hướng dẫn khách tham dự.", sameDay],
    ];
  }

  return templates
    .filter(([taskTitle]) => !existing.has(stripVietnamese(taskTitle)))
    .map(([taskTitle, description, dueDate]) => ({
      event_id: eventId,
      member_id: null,
      title: taskTitle,
      description,
      due_date: dueDate,
      status: "assigned",
    }));
};

const unsupportedEventForm = (mode) => ({
  success: true,
  status: "unsupported",
  mode,
  event: {
    title: "",
    event_date: null,
    description: "",
    clan_id: null,
  },
  manager_tasks: [],
});

const deterministicEventForm = (body) => {
  const mode = body.mode === "task_create" ? "task_create" : "event_create";
  const prompt = String(body.prompt || "").trim();
  const normalized = stripVietnamese(prompt);

  const related =
    /(su kien|gio to|hop mat|hop ho|mung tho|tu sua|nha tho ho|tu duong|cong viec|giao viec|chuan bi|don dep|mam cung)/.test(
      normalized
    );

  if (!related) return unsupportedEventForm(mode);

  if (mode === "task_create") {
    const currentEvent = body.current_event || {};
    const eventId = Number(currentEvent.id);

    if (!Number.isFinite(eventId) || eventId <= 0) {
      return unsupportedEventForm(mode);
    }

    const eventDate = toIsoDate(currentEvent.event_date);

    return {
      success: true,
      status: "success",
      mode,
      event: {
        title: currentEvent.title || "",
        event_date: eventDate,
        description: currentEvent.description || "",
        clan_id: currentEvent.clan_id || body.clan_id || null,
      },
      manager_tasks: buildTasksForEvent(currentEvent.title || prompt, eventDate, eventId, body.existing_tasks || []),
    };
  }

  const eventDate = toIsoDate(prompt);
  const title = inferTitle(prompt);

  return {
    success: true,
    status: "success",
    mode,
    event: {
      title,
      event_date: eventDate,
      description: prompt.length > 12 ? prompt : `Tổ chức ${title.toLowerCase()} cho dòng họ.`,
      clan_id: body.clan_id || null,
    },
    manager_tasks: buildTasksForEvent(title, eventDate, null, []),
  };
};

const normalizeEventFormPayload = (payload, fallbackBody) => {
  const mode =
    payload?.mode === "task_create"
      ? "task_create"
      : fallbackBody.mode === "task_create"
        ? "task_create"
        : "event_create";

  const event = payload?.event || {};
  const tasks = Array.isArray(payload?.manager_tasks)
    ? payload.manager_tasks
    : Array.isArray(payload?.tasks)
      ? payload.tasks
      : [];

  return {
    success: true,
    status: payload?.status === "unsupported" ? "unsupported" : "success",
    mode,
    event: {
      title: String(event.title || "").trim(),
      event_date: event.event_date || null,
      description: String(event.description || "").trim(),
      clan_id: event.clan_id || fallbackBody.clan_id || fallbackBody.current_event?.clan_id || null,
    },
    manager_tasks: tasks
      .map((task) => ({
        event_id: task.event_id || (mode === "task_create" ? fallbackBody.current_event?.id || null : null),
        member_id: null,
        title: String(task.title || "").trim(),
        description: String(task.description || "").trim(),
        due_date: task.due_date || null,
        status: "assigned",
      }))
      .filter((task) => task.title),
  };
};

exports.generateEventForm = async (req, res) => {
  const body = req.body || {};
  const prompt = String(body.prompt || "").trim();
  const mode = body.mode === "task_create" ? "task_create" : "event_create";

  if (!prompt) {
    return res.status(400).json({
      success: false,
      message: "Nội dung AI không được để trống",
    });
  }

  const secureBody = {
    mode,
    prompt,
    today: body.today || new Date().toISOString().slice(0, 10),
    clan_id: body.clan_id || null,
    current_event: body.current_event || null,
    existing_tasks: Array.isArray(body.existing_tasks) ? body.existing_tasks : [],
  };

  try {
    const response = await fetch(`${AI_SERVER_URL}/event-form/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(secureBody),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data && data.status) {
      return res.json(normalizeEventFormPayload(data, secureBody));
    }
  } catch (error) {
    // AI server is optional in local development. Fall back to deterministic generation.
  }

  return res.json(deterministicEventForm(secureBody));
};