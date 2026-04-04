const db = require("../config/db");
const bcrypt = require("bcryptjs");

/** Ghép họ + tên đệm + tên → display_name (khoảng trắng gọn) */
const buildDisplayNameFromParts = (surname, middleName, firstName) => {
  const s = surname == null ? "" : String(surname).trim();
  const m = middleName == null ? "" : String(middleName).trim();
  const f = firstName == null ? "" : String(firstName).trim();
  return [s, m, f].filter(Boolean).join(" ").trim();
};

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

/**
 * Cây gia phả: gốc = đời 1 (hoặc đời nhỏ nhất nếu không có đời 1).
 * Con cái: bảng children + families; ưu tiên nối con với cha (father_id), không có cha thì mẹ.
 */
const buildFamilyTree = (peopleRows, familyRows, childRows) => {
  const peopleMap = Object.fromEntries(peopleRows.map((p) => [p.id, p]));
  const childrenByFamily = new Map();
  for (const row of childRows) {
    if (!childrenByFamily.has(row.family_id)) childrenByFamily.set(row.family_id, []);
    childrenByFamily.get(row.family_id).push(row.person_id);
  }

  const childrenByParent = new Map();
  /** Cha/mẹ “chính” nối con (ưu tiên cha) → id vợ/chồng còn lại trong cùng gia đình, để hiển thị cặp trên một nhánh */
  const spouseByPrimary = new Map();
  for (const fam of familyRows) {
    const kids = childrenByFamily.get(fam.id) || [];
    const parentId = fam.father_id || fam.mother_id;
    if (!parentId) continue;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    const list = childrenByParent.get(parentId);
    for (const cid of kids) {
      if (!list.includes(cid)) list.push(cid);
    }
    if (kids.length > 0 && fam.father_id && fam.mother_id) {
      const spouseId = parentId === fam.father_id ? fam.mother_id : fam.father_id;
      if (!spouseByPrimary.has(parentId)) spouseByPrimary.set(parentId, spouseId);
    }
  }

  const sortRoots = (arr) =>
    [...arr].sort((a, b) => {
      const ak = (childrenByParent.get(a.id) || []).length;
      const bk = (childrenByParent.get(b.id) || []).length;
      if (ak > 0 && bk === 0) return -1;
      if (ak === 0 && bk > 0) return 1;
      return a.id - b.id;
    });

  let roots = sortRoots(peopleRows.filter((p) => Number(p.generation) === 1));
  if (roots.length === 0 && peopleRows.length > 0) {
    const gens = peopleRows.map((p) => Number(p.generation)).filter((g) => Number.isFinite(g) && g > 0);
    const minGen = gens.length ? Math.min(...gens) : 1;
    roots = sortRoots(peopleRows.filter((p) => Number(p.generation) === minGen));
  }

  const placed = new Set();

  const buildNode = (personId) => {
    const person = peopleMap[personId];
    if (!person) return null;
    if (placed.has(personId)) return null;
    placed.add(personId);
    const spouseId = spouseByPrimary.get(personId);
    let spouse = null;
    if (spouseId && peopleMap[spouseId] && !placed.has(spouseId)) {
      spouse = peopleMap[spouseId];
      placed.add(spouseId);
    }
    const rawChildIds = childrenByParent.get(personId) || [];
    const children = [];
    for (const cid of rawChildIds) {
      const childNode = buildNode(cid);
      if (childNode) children.push(childNode);
    }
    return { person, spouse, children };
  };

  const rootNodes = [];
  for (const r of roots) {
    if (placed.has(r.id)) continue;
    const node = buildNode(r.id);
    if (node) rootNodes.push(node);
  }

  return { roots: rootNodes };
};

/**
 * Cây gia phả + danh sách người cho một dòng họ (Admin).
 * Mỗi người có thể có `account_id` nếu đã liên kết tài khoản.
 */
exports.loadClanTreeForAdmin = async (clanId) => {
  const cid = Number(clanId);
  if (!Number.isFinite(cid)) return { error: "bad_id" };
  const [crows] = await db.query(
    "SELECT id, clan_name, history FROM clans WHERE id = ? LIMIT 1",
    [cid]
  );
  if (!crows.length) return { error: "not_found" };
  const clan = crows[0];

  const [peopleRows] = await db.query(
    `
    SELECT p.id, p.display_name, p.first_name, p.middle_name, p.surname, p.generation, p.branch,
           p.hometown, p.address, p.birth_date, p.death_date, p.is_living, p.gender,
           p.phone, p.email, p.avatar_url, p.bio,
           a.id AS account_id
    FROM people p
    LEFT JOIN accounts a ON a.person_id = p.id
    WHERE p.clan_id = ?
    ORDER BY p.generation, p.surname, p.first_name
  `,
    [cid]
  );

  const [familyRows] = await db.query(
    `SELECT id, father_id, mother_id FROM families WHERE clan_id = ? ORDER BY id ASC`,
    [cid]
  );
  const [childRows] = await db.query(
    `
    SELECT c.family_id, c.person_id, c.sort_order
    FROM children c
    INNER JOIN families f ON c.family_id = f.id
    WHERE f.clan_id = ?
    ORDER BY c.family_id, c.sort_order, c.id
  `,
    [cid]
  );

  const familyTree = buildFamilyTree(peopleRows, familyRows, childRows);
  return { clan, treeMembers: peopleRows, familyTree };
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
    let familyTree = { roots: [] };

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

      const [familyRows] = await db.query(
        `SELECT id, father_id, mother_id FROM families WHERE clan_id = ? ORDER BY id ASC`,
        [clanId]
      );
      const [childRows] = await db.query(
        `
          SELECT c.family_id, c.person_id, c.sort_order
          FROM children c
          INNER JOIN families f ON c.family_id = f.id
          WHERE f.clan_id = ?
          ORDER BY c.family_id, c.sort_order, c.id
        `,
        [clanId]
      );
      familyTree = buildFamilyTree(peopleRows, familyRows, childRows);

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
      familyTree,
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
    const { surname, middle_name, first_name, email, hometown, generation, family_id, spouse_id, children_ids } =
      req.body;
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

    if (email && String(email).trim() !== String(context.account_email || "").trim()) {
      const [dupEmail] = await db.query("SELECT id FROM accounts WHERE email = ? AND id <> ?", [
        String(email).trim(),
        accountId,
      ]);
      if (dupEmail.length > 0) {
        return res.status(400).json({ success: false, message: "Email đã được tài khoản khác sử dụng" });
      }
      await db.query("UPDATE accounts SET email = ? WHERE id = ?", [String(email).trim(), accountId]);
    }

    const nextSurname = surname !== undefined && surname !== null ? String(surname).trim() : (context.surname || "") || "";
    const nextMiddle =
      middle_name !== undefined && middle_name !== null ? String(middle_name).trim() : (context.middle_name || "") || "";
    const nextFirst =
      first_name !== undefined && first_name !== null ? String(first_name).trim() : (context.first_name || "") || "";
    const nextDisplay =
      buildDisplayNameFromParts(nextSurname, nextMiddle, nextFirst) || (context.display_name || "").trim() || "";

    await db.query(
      "UPDATE people SET surname = ?, middle_name = ?, first_name = ?, display_name = ?, hometown = ?, generation = ? WHERE id = ?",
      [
        nextSurname,
        nextMiddle,
        nextFirst,
        nextDisplay,
        hometown !== undefined && hometown !== null ? String(hometown).trim() : context.hometown || "",
        Number.isFinite(generationNumber) ? generationNumber : context.generation || 1,
        context.person_id,
      ]
    );

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

    // Chỉ tạo/sửa bản ghi families khi thực sự gửi vợ/chồng hoặc có ít nhất một ID con (tránh 400 khi client gửi children_ids rỗng)
    const needsNewOrUpdateFamilyRow =
      hasSpouseField || (hasChildrenField && childrenIds.length > 0);
    if (needsNewOrUpdateFamilyRow) {
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
        person_id: fresh.person_id,
        role_id: fresh.role_id,
        status: fresh.status,
        email: fresh.account_email,
        display_name: fresh.display_name,
        surname: fresh.surname,
        middle_name: fresh.middle_name,
        first_name: fresh.first_name,
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

exports.changePassword = async (req, res) => {
  try {
    const accountId = req.user.id;
    const { current_password, new_password } = req.body;
    const cur = String(current_password ?? "");
    const next = String(new_password ?? "").trim();

    if (!next || next.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }
    if (cur === "") {
      return res.status(400).json({ success: false, message: "Vui lòng nhập mật khẩu hiện tại" });
    }

    const [rows] = await db.query("SELECT password FROM accounts WHERE id = ? LIMIT 1", [accountId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    }

    const stored = rows[0].password;
    let match = false;
    try {
      match = await bcrypt.compare(cur, stored);
    } catch {
      match = false;
    }
    if (!match && stored === cur) {
      match = true;
    }

    if (!match) {
      return res.status(401).json({ success: false, message: "Mật khẩu hiện tại không đúng" });
    }

    const hashed = await bcrypt.hash(next, 10);
    await db.query("UPDATE accounts SET password = ? WHERE id = ?", [hashed, accountId]);

    return res.json({ success: true, message: "Đã đổi mật khẩu thành công" });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({ success: false, message: "Lỗi đổi mật khẩu" });
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

