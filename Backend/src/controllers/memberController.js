const db = require("../config/db");

const getAccountContext = async (accountId) => {
  const sql = `
    SELECT 
      a.id AS account_id,
      a.email AS account_email,
      a.role_id,
      a.status,
      a.person_id,
      p.display_name,
      p.first_name,
      p.middle_name,
      p.surname,
      p.hometown,
      p.gender,
      p.birth_date,
      p.generation,
      p.clan_id,
      c.clan_name,
      c.history AS clan_history
    FROM accounts a
    LEFT JOIN people p ON a.person_id = p.id
    LEFT JOIN clans c ON p.clan_id = c.id
    WHERE a.id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [accountId]);
  return rows[0] || null;
};

const getOrCreateConversationId = async (accountId) => {
  const [existing] = await db.query(
    "SELECT id FROM conversations WHERE account_id = ? ORDER BY id ASC LIMIT 1",
    [accountId]
  );
  if (existing.length > 0) return existing[0].id;

  const [created] = await db.query(
    "INSERT INTO conversations (account_id, title) VALUES (?, ?)",
    [accountId, "Hội thoại gia phả"]
  );
  return created.insertId;
};

const buildAiReply = (text) => {
  const t = String(text || "").toLowerCase();
  if (t.includes("đời") || t.includes("thế hệ")) {
    return "Bạn có thể vào mục Khám phá di sản để lọc thành viên theo đời và quê quán.";
  }
  if (t.includes("gia phả") || t.includes("cây")) {
    return "Mình đã ghi nhận. Bạn hãy mở mục Cây gia phả để xem sơ đồ trực quan các thế hệ.";
  }
  if (t.includes("sự kiện") || t.includes("giỗ") || t.includes("nhắc")) {
    return "Bạn có thể thêm lịch nhắc trong mục Reminders để lưu vào cơ sở dữ liệu.";
  }
  return "Mình đã nhận câu hỏi. Bạn có thể hỏi theo tên thành viên, đời hoặc sự kiện gia đình.";
};

const parseNullableId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseChildrenIds = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => Number(v)).filter((v) => Number.isFinite(v)))];
  }
  if (typeof value === "string") {
    return [
      ...new Set(
        value
          .split(",")
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isFinite(v))
      ),
    ];
  }
  return [];
};

const ensurePeopleExist = async (ids) => {
  if (!ids || ids.length === 0) return true;
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await db.query(`SELECT id FROM people WHERE id IN (${placeholders})`, ids);
  return rows.length === ids.length;
};

const getOwnedFamilyRelations = async (personId) => {
  if (!personId) {
    return { family_id: null, spouse_id: null, children_ids: [] };
  }

  const [familyRows] = await db.query(
    `
      SELECT id, father_id, mother_id
      FROM families
      WHERE father_id = ? OR mother_id = ?
      ORDER BY id ASC
      LIMIT 1
    `,
    [personId, personId]
  );

  const family = familyRows[0] || null;
  if (!family) {
    return { family_id: null, spouse_id: null, children_ids: [] };
  }

  const spouseId = family.father_id === personId ? family.mother_id : family.father_id;
  const [childrenRows] = await db.query(
    "SELECT person_id FROM children WHERE family_id = ? ORDER BY id ASC",
    [family.id]
  );

  return {
    family_id: family.id,
    spouse_id: spouseId || null,
    children_ids: childrenRows.map((r) => r.person_id),
  };
};

exports.getDashboard = async (req, res) => {
  try {
    const accountId = req.user.id;
    const context = await getAccountContext(accountId);
    if (!context) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    }

    const clanId = context.clan_id;
    let treeMembers = [];
    let reminders = [];

    if (clanId) {
      const [peopleRows] = await db.query(
        `
          SELECT id, display_name, first_name, middle_name, surname, generation, branch,
                 hometown, address, birth_date, death_date, is_living, gender,
                 phone, email, avatar_url, bio
          FROM people
          WHERE clan_id = ?
          ORDER BY generation, surname, first_name
        `,
        [clanId]
      );
      treeMembers = peopleRows;

      const [eventRows] = await db.query(
        `
          SELECT id, title, event_date, description
          FROM events
          WHERE clan_id = ?
          ORDER BY event_date DESC, id DESC
          LIMIT 50
        `,
        [clanId]
      );
      reminders = eventRows;
    }

    const discoverItems = [
      {
        title: context.clan_name || "Chưa liên kết dòng họ",
        desc: context.clan_name
          ? `Dòng họ hiện tại có ${treeMembers.length} thành viên.`
          : "Tài khoản của bạn chưa liên kết dòng họ.",
        tag: "Dòng họ",
      },
      ...treeMembers.map((m) => ({
        title: m.display_name || [m.surname, m.middle_name, m.first_name].filter(Boolean).join(" "),
        desc: `Đời thứ ${m.generation || "—"} • ${m.hometown || "Chưa cập nhật"}`,
        tag: "Thành viên",
      })),
    ];

    const relations = await getOwnedFamilyRelations(context.person_id);

    return res.json({
      success: true,
      profile: {
        account_id: context.account_id,
        person_id: context.person_id,
        role_id: context.role_id,
        status: context.status,
        email: context.account_email,
        display_name: context.display_name,
        first_name: context.first_name,
        middle_name: context.middle_name,
        surname: context.surname,
        hometown: context.hometown,
        gender: context.gender,
        birth_date: context.birth_date,
        generation: context.generation,
        family_id: relations.family_id,
        spouse_id: relations.spouse_id,
        children_ids: relations.children_ids,
      },
      clan: {
        clan_id: context.clan_id,
        clan_name: context.clan_name,
        history: context.clan_history,
      },
      treeMembers,
      discoverItems,
      reminders,
    });
  } catch (error) {
    console.error("getDashboard error:", error);
    return res.status(500).json({ success: false, message: "Lỗi lấy dữ liệu trang thành viên" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const accountId = req.user.id;
    const { display_name, email, hometown, generation, family_id, spouse_id, children_ids } = req.body;
    const hasFamilyField = Object.prototype.hasOwnProperty.call(req.body, "family_id");
    const hasSpouseField = Object.prototype.hasOwnProperty.call(req.body, "spouse_id");
    const hasChildrenField = Object.prototype.hasOwnProperty.call(req.body, "children_ids");
    const context = await getAccountContext(accountId);
    if (!context) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    }
    if (!context.person_id) {
      return res.status(400).json({ success: false, message: "Tài khoản chưa liên kết person" });
    }

    const familyIdInput = parseNullableId(family_id);
    const spouseId = parseNullableId(spouse_id);
    const childrenIds = parseChildrenIds(children_ids);
    const generationNumber =
      generation === undefined || generation === null || String(generation).trim() === ""
        ? null
        : Number(generation);

    const relationIdsToValidate = [spouseId, ...childrenIds].filter((v) => v !== null);
    const allRelationsOk = await ensurePeopleExist(relationIdsToValidate);
    if (!allRelationsOk) {
      return res.status(400).json({ success: false, message: "Một hoặc nhiều ID quan hệ không tồn tại trong bảng people" });
    }

    if (email && email !== context.account_email) {
      await db.query("UPDATE accounts SET email = ? WHERE id = ?", [email, accountId]);
    }

    await db.query("UPDATE people SET display_name = ?, hometown = ?, generation = ? WHERE id = ?", [
      display_name || context.display_name || "",
      hometown || context.hometown || "",
      Number.isFinite(generationNumber) ? generationNumber : context.generation || 1,
      context.person_id,
    ]);

    // Tìm family đang sở hữu (nếu có)
    const [selfFamilyRows] = await db.query(
      "SELECT id FROM families WHERE father_id = ? OR mother_id = ? ORDER BY id ASC LIMIT 1",
      [context.person_id, context.person_id]
    );
    let selfFamilyId = selfFamilyRows[0]?.id || null;
    const isMale = Number(context.gender) === 1;

    // Nếu có family_id: kiểm tra / tạo mới theo yêu cầu người dùng
    if (hasFamilyField && familyIdInput !== null) {
      const [existingFamily] = await db.query(
        "SELECT id, father_id, mother_id, clan_id FROM families WHERE id = ? LIMIT 1",
        [familyIdInput]
      );
      if (existingFamily.length === 0) {
        if (!context.clan_id) {
          return res.status(400).json({
            success: false,
            message: "Tài khoản chưa liên kết dòng họ nên không thể tạo families mới",
          });
        }
        await db.query(
          "INSERT INTO families (id, clan_id, father_id, mother_id) VALUES (?, ?, ?, ?)",
          [familyIdInput, context.clan_id, isMale ? context.person_id : spouseId, isMale ? spouseId : context.person_id]
        );
        selfFamilyId = familyIdInput;
      } else {
        const fam = existingFamily[0];
        if (fam.father_id !== context.person_id && fam.mother_id !== context.person_id) {
          return res.status(403).json({
            success: false,
            message: "Family ID đã tồn tại nhưng tài khoản hiện tại không phải bố/mẹ của family này",
          });
        }
        selfFamilyId = fam.id;
      }
    }

    if (hasSpouseField || hasChildrenField) {
      if (!selfFamilyId) {
        if (!context.clan_id) {
          return res.status(400).json({
            success: false,
            message: "Tài khoản chưa liên kết dòng họ nên chưa thể khai báo quan hệ vợ/chồng/con",
          });
        }
        const [createdFamily] = await db.query(
          "INSERT INTO families (clan_id, father_id, mother_id) VALUES (?, ?, ?)",
          [context.clan_id, isMale ? context.person_id : spouseId, isMale ? spouseId : context.person_id]
        );
        selfFamilyId = createdFamily.insertId;
      } else {
        await db.query("UPDATE families SET father_id = ?, mother_id = ? WHERE id = ?", [
          isMale ? context.person_id : spouseId,
          isMale ? spouseId : context.person_id,
          selfFamilyId,
        ]);
      }
    }

    if (selfFamilyId && hasChildrenField) {
      await db.query("DELETE FROM children WHERE family_id = ?", [selfFamilyId]);
      for (const childId of childrenIds) {
        await db.query("INSERT INTO children (family_id, person_id, sort_order) VALUES (?, ?, 0)", [
          selfFamilyId,
          childId,
        ]);
      }
    }

    const fresh = await getAccountContext(accountId);
    const relations = await getOwnedFamilyRelations(fresh.person_id);
    return res.json({
      success: true,
      message: "Cập nhật thông tin thành công",
      profile: {
        account_id: fresh.account_id,
        role_id: fresh.role_id,
        status: fresh.status,
        email: fresh.account_email,
        display_name: fresh.display_name,
        hometown: fresh.hometown,
        generation: fresh.generation,
        family_id: relations.family_id,
        spouse_id: relations.spouse_id,
        children_ids: relations.children_ids,
      },
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ success: false, message: "Lỗi cập nhật thông tin" });
  }
};

exports.getChatMessages = async (req, res) => {
  try {
    const accountId = req.user.id;
    const conversationId = await getOrCreateConversationId(accountId);
    const [rows] = await db.query(
      `
      SELECT id, sender_type, content, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY id ASC
      `,
      [conversationId]
    );
    return res.json({ success: true, conversation_id: conversationId, messages: rows });
  } catch (error) {
    console.error("getChatMessages error:", error);
    return res.status(500).json({ success: false, message: "Lỗi lấy lịch sử chat" });
  }
};

exports.sendChatMessage = async (req, res) => {
  try {
    const accountId = req.user.id;
    const { message } = req.body;
    const text = String(message || "").trim();
    if (!text) {
      return res.status(400).json({ success: false, message: "Tin nhắn không được để trống" });
    }

    const conversationId = await getOrCreateConversationId(accountId);
    await db.query(
      "INSERT INTO messages (conversation_id, sender_type, content) VALUES (?, 'user', ?)",
      [conversationId, text]
    );

    const aiReply = buildAiReply(text);
    await db.query(
      "INSERT INTO messages (conversation_id, sender_type, content) VALUES (?, 'ai', ?)",
      [conversationId, aiReply]
    );

    return res.json({
      success: true,
      conversation_id: conversationId,
      user_message: text,
      ai_message: aiReply,
    });
  } catch (error) {
    console.error("sendChatMessage error:", error);
    return res.status(500).json({ success: false, message: "Lỗi gửi tin nhắn" });
  }
};

exports.createReminder = async (req, res) => {
  try {
    const accountId = req.user.id;
    const { title, date, note } = req.body;
    if (!title || !date) {
      return res.status(400).json({ success: false, message: "Thiếu tiêu đề hoặc ngày sự kiện" });
    }

    const context = await getAccountContext(accountId);
    if (!context || !context.clan_id) {
      return res
        .status(400)
        .json({ success: false, message: "Tài khoản chưa liên kết dòng họ, không thể tạo reminder" });
    }

    const [created] = await db.query(
      "INSERT INTO events (clan_id, title, event_date, description) VALUES (?, ?, ?, ?)",
      [context.clan_id, String(title).trim(), date, note || ""]
    );

    return res.json({
      success: true,
      message: "Tạo nhắc nhở thành công",
      reminder: {
        id: created.insertId,
        title: String(title).trim(),
        event_date: date,
        description: note || "",
      },
    });
  } catch (error) {
    console.error("createReminder error:", error);
    return res.status(500).json({ success: false, message: "Lỗi tạo reminder" });
  }
};

