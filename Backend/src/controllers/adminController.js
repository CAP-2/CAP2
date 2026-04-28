const db = require("../config/db");
const bcrypt = require("bcryptjs");
const memberController = require("./memberController");

const buildDisplayNameFromParts = (surname, middleName, firstName) => {
  const s = surname == null ? "" : String(surname).trim();
  const m = middleName == null ? "" : String(middleName).trim();
  const f = firstName == null ? "" : String(firstName).trim();
  return [s, m, f].filter(Boolean).join(" ").trim();
};

/** Danh sách dòng họ + số thành viên + số manager + số bài viết + chủ quản */
exports.listClans = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.clan_name, c.created_at,
        (SELECT COUNT(*) FROM people p WHERE p.clan_id = c.id) AS member_count,
        (SELECT COUNT(*) FROM posts po WHERE po.clan_id = c.id) AS post_count,
        (SELECT p.display_name FROM accounts a 
         JOIN people p ON a.person_id = p.id 
         WHERE p.clan_id = c.id AND a.role_id = 2 
         ORDER BY a.id ASC LIMIT 1) AS owner_name
      FROM clans c
      ORDER BY c.id ASC
    `);
    return res.json({ success: true, clans: rows });
  } catch (e) {
    console.error("listClans:", e);
    return res.status(500).json({ success: false, message: "Lỗi danh sách dòng họ" });
  }
};

/** Cây phả hệ + thông tin đầy đủ từng người (có account_id nếu có) */
exports.getClanTree = async (req, res) => {
  try {
    const clanId = Number(req.params.clanId);
    const result = await memberController.loadClanTreeForAdmin(clanId);
    if (result.error === "bad_id") {
      return res.status(400).json({ success: false, message: "clan_id không hợp lệ" });
    }
    if (result.error === "not_found") {
      return res.status(404).json({ success: false, message: "Không tìm thấy dòng họ" });
    }
    return res.json({ success: true, ...result });
  } catch (e) {
    console.error("getClanTree:", e);
    return res.status(500).json({ success: false, message: "Lỗi tải cây phả hệ" });
  }
};

/** Tất cả tài khoản — quản lý quyền & gán dòng họ */
exports.listAccounts = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.id AS account_id, a.email, a.role_id, a.status, a.person_id,
             p.first_name, p.middle_name, p.surname, p.display_name, p.clan_id,
             c.clan_name
      FROM accounts a
      LEFT JOIN people p ON a.person_id = p.id
      LEFT JOIN clans c ON p.clan_id = c.id
      ORDER BY a.role_id ASC, a.id ASC
    `);
    return res.json({ success: true, accounts: rows });
  } catch (e) {
    console.error("listAccounts:", e);
    return res.status(500).json({ success: false, message: "Lỗi danh sách tài khoản" });
  }
};

/** Cập nhật vai trò (2|3), trạng thái, dòng họ (people.clan_id) */
exports.updateAccountAccess = async (req, res) => {
  const targetId = Number(req.params.id);
  const selfId = req.user.id;
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ success: false, message: "account_id không hợp lệ" });
  }

  const body = req.body;
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  try {
    const [accRows] = await db.query(
      "SELECT id, person_id, role_id FROM accounts WHERE id = ? LIMIT 1",
      [targetId]
    );
    if (!accRows.length) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    }
    const acc = accRows[0];

    if (acc.role_id === 1) {
      return res
        .status(400)
        .json({ success: false, message: "Không chỉnh quyền tài khoản Admin qua màn hình này" });
    }

    if (has("role_id")) {
      if (targetId === selfId) {
        return res.status(400).json({ success: false, message: "Không thể đổi quyền của chính mình" });
      }
      const rid = Number(body.role_id);
      if (rid !== 2 && rid !== 3) {
        return res
          .status(400)
          .json({ success: false, message: "Chỉ gán vai trò Manager (2) hoặc Member (3)" });
      }
      await db.query("UPDATE accounts SET role_id = ? WHERE id = ?", [rid, targetId]);
    }

    if (has("status")) {
      const st = String(body.status || "").trim();
      if (["pending", "active", "rejected"].includes(st)) {
        if (targetId === selfId && st !== "active") {
          return res
            .status(400)
            .json({ success: false, message: "Không thể khóa tài khoản admin đang đăng nhập" });
        }
        await db.query("UPDATE accounts SET status = ? WHERE id = ?", [st, targetId]);
      }
    }

    if (acc.person_id != null && has("clan_id")) {
      const raw = body.clan_id;
      const cid = raw === null || raw === "" ? null : Number(raw);
      if (cid !== null && !Number.isFinite(cid)) {
        return res.status(400).json({ success: false, message: "clan_id không hợp lệ" });
      }
      if (cid !== null) {
        const [crows] = await db.query("SELECT id FROM clans WHERE id = ? LIMIT 1", [cid]);
        if (!crows.length) {
          return res.status(400).json({ success: false, message: "Dòng họ không tồn tại" });
        }
      }
      await db.query("UPDATE people SET clan_id = ? WHERE id = ?", [cid, acc.person_id]);
    }

    return res.json({ success: true, message: "Đã cập nhật quyền truy cập" });
  } catch (e) {
    console.error("updateAccountAccess:", e);
    return res.status(500).json({ success: false, message: "Lỗi cập nhật" });
  }
};

/** Tạo tài khoản Manager mới (role 2, active) gắn một dòng họ */
exports.createManagerAccount = async (req, res) => {
  try {
    const {
      email,
      password,
      surname,
      middle_name,
      first_name,
      gender,
      birth_date,
      hometown,
      generation,
      clan_id: bodyClanId,
    } = req.body;

    const emailTrim = String(email || "")
      .trim()
      .toLowerCase();
    const pwd = String(password || "");
    if (!emailTrim || !pwd) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập email và mật khẩu" });
    }
    if (pwd.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu tối thiểu 6 ký tự" });
    }
    const sn = surname != null ? String(surname).trim() : "";
    const mid = middle_name != null ? String(middle_name).trim() : "";
    const fn = first_name != null ? String(first_name).trim() : "";
    if (!sn && !fn) {
      return res.status(400).json({ success: false, message: "Cần ít nhất họ hoặc tên" });
    }

    const cid = Number(bodyClanId);
    if (!Number.isFinite(cid)) {
      return res.status(400).json({ success: false, message: "Cần clan_id (dòng họ) hợp lệ" });
    }
    const [crows] = await db.query("SELECT id FROM clans WHERE id = ? LIMIT 1", [cid]);
    if (!crows.length) {
      return res.status(400).json({ success: false, message: "clan_id không tồn tại" });
    }

    const genRaw =
      generation === undefined || generation === null || String(generation).trim() === ""
        ? 1
        : Number(generation);
    const gen = Number.isFinite(genRaw) && genRaw > 0 ? genRaw : 1;

    let gVal = null;
    if (gender !== undefined && gender !== null && String(gender).trim() !== "") {
      const g = Number(gender);
      gVal = g === 1 || g === 2 ? g : null;
    }

    const bd = birth_date && String(birth_date).trim() !== "" ? String(birth_date).trim() : null;
    const ht = hometown != null ? String(hometown).trim() : "";

    const displayName = buildDisplayNameFromParts(sn, mid, fn) || emailTrim;
    const hashedPassword = await bcrypt.hash(pwd, 10);

    const [personResult] = await db.query(
      `INSERT INTO people (clan_id, display_name, first_name, middle_name, surname, gender, birth_date, hometown, generation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cid, displayName, fn, mid, sn, gVal, bd, ht, gen]
    );
    const personId = personResult.insertId;

    const [accResult] = await db.query(
      `INSERT INTO accounts (email, password, person_id, role_id, status) VALUES (?, ?, ?, 2, 'active')`,
      [emailTrim, hashedPassword, personId]
    );

    return res.status(201).json({
      success: true,
      message: "Đã tạo tài khoản Manager và gán dòng họ",
      account_id: accResult.insertId,
      person_id: personId,
    });
  } catch (error) {
    console.error("createManagerAccount:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Email đã tồn tại trong hệ thống" });
    }
    return res.status(500).json({ success: false, message: "Lỗi tạo manager" });
  }
};

/** Quản lý Thành viên (People + Accounts) */
exports.getMembers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, a.id AS account_id, a.email AS account_email, a.role_id, a.status AS account_status, c.clan_name
      FROM people p
      LEFT JOIN accounts a ON p.id = a.person_id
      LEFT JOIN clans c ON p.clan_id = c.id
      ORDER BY p.id DESC
    `);
    return res.json({ success: true, members: rows });
  } catch (e) {
    console.error("getMembers:", e);
    return res.status(500).json({ success: false, message: "Lỗi danh sách thành viên" });
  }
};

exports.updateMember = async (req, res) => {
  const personId = Number(req.params.id);
  const data = req.body;
  try {
    const sql = `
      UPDATE people 
      SET display_name = ?, first_name = ?, middle_name = ?, surname = ?, 
          gender = ?, birth_date = ?, hometown = ?, clan_id = ?, generation = ?
      WHERE id = ?
    `;
    await db.query(sql, [
      data.display_name, data.first_name, data.middle_name, data.surname,
      data.gender, data.birth_date, data.hometown, data.clan_id, data.generation,
      personId
    ]);
    return res.json({ success: true, message: "Đã cập nhật thông tin thành viên" });
  } catch (e) {
    console.error("updateMember:", e);
    return res.status(500).json({ success: false, message: "Lỗi cập nhật thành viên" });
  }
};

exports.deleteMember = async (req, res) => {
  const personId = Number(req.params.id);
  try {
    // Xóa account liên quan trước (nếu có)
    await db.query("DELETE FROM accounts WHERE person_id = ?", [personId]);
    await db.query("DELETE FROM people WHERE id = ?", [personId]);
    return res.json({ success: true, message: "Đã xóa thành viên" });
  } catch (e) {
    console.error("deleteMember:", e);
    return res.status(500).json({ success: false, message: "Lỗi xóa thành viên" });
  }
};

/** Quản lý Cấu hình hệ thống */
exports.getSettings = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM system_settings");
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    return res.json({ success: true, settings });
  } catch (e) {
    console.error("getSettings:", e);
    return res.status(500).json({ success: false, message: "Lỗi tải cài đặt" });
  }
};

exports.updateSettings = async (req, res) => {
  const settings = req.body; // { key1: value1, key2: value2 }
  try {
    for (const key in settings) {
      await db.query(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [key, settings[key]]
      );
    }
    return res.json({ success: true, message: "Đã lưu cài đặt" });
  } catch (e) {
    console.error("updateSettings:", e);
    return res.status(500).json({ success: false, message: "Lỗi lưu cài đặt" });
  }
};

/** Quản lý Sự kiện */
exports.getEvents = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.*, c.clan_name 
      FROM events e 
      JOIN clans c ON e.clan_id = c.id 
      ORDER BY e.event_date DESC
    `);
    return res.json({ success: true, events: rows });
  } catch (e) {
    console.error("getEvents:", e);
    return res.status(500).json({ success: false, message: "Lỗi tải sự kiện" });
  }
};

exports.createEvent = async (req, res) => {
  const { clan_id, title, event_date, description } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO events (clan_id, title, event_date, description) VALUES (?, ?, ?, ?)",
      [clan_id, title, event_date, description]
    );
    return res.status(201).json({ success: true, message: "Đã tạo sự kiện", event_id: result.insertId });
  } catch (e) {
    console.error("createEvent:", e);
    return res.status(500).json({ success: false, message: "Lỗi tạo sự kiện" });
  }
};

exports.updateEvent = async (req, res) => {
  const eventId = Number(req.params.id);
  const { title, event_date, description } = req.body;
  try {
    await db.query(
      "UPDATE events SET title = ?, event_date = ?, description = ? WHERE id = ?",
      [title, event_date, description, eventId]
    );
    return res.json({ success: true, message: "Đã cập nhật sự kiện" });
  } catch (e) {
    console.error("updateEvent:", e);
    return res.status(500).json({ success: false, message: "Lỗi cập nhật sự kiện" });
  }
};

exports.deleteEvent = async (req, res) => {
  const eventId = Number(req.params.id);
  try {
    await db.query("DELETE FROM events WHERE id = ?", [eventId]);
    return res.json({ success: true, message: "Đã xóa sự kiện" });
  } catch (e) {
    console.error("deleteEvent:", e);
    return res.status(500).json({ success: false, message: "Lỗi xóa sự kiện" });
  }
};

/** Quản lý Thư viện / Gallery */
exports.getGallery = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, c.clan_name, author.display_name AS author_name 
      FROM posts p 
      LEFT JOIN clans c ON p.clan_id = c.id 
      LEFT JOIN accounts a ON p.author_id = a.id
      LEFT JOIN people author ON a.person_id = author.id
      WHERE p.image_url IS NOT NULL AND p.image_url != ''
      ORDER BY p.created_at DESC
    `);
    return res.json({ success: true, gallery: rows });
  } catch (e) {
    console.error("getGallery:", e);
    return res.status(500).json({ success: false, message: "Lỗi tải thư viện" });
  }
};

exports.deleteGalleryItem = async (req, res) => {
  const postId = Number(req.params.id);
  try {
    await db.query("DELETE FROM posts WHERE id = ?", [postId]);
    return res.json({ success: true, message: "Đã xóa ảnh" });
  } catch (e) {
    console.error("deleteGalleryItem:", e);
    return res.status(500).json({ success: false, message: "Lỗi xóa ảnh" });
  }
};

/** Quản lý Bài viết theo Clan */
exports.getPostsByClan = async (req, res) => {
  try {
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId)) {
      return res.status(400).json({ success: false, message: "clan_id không hợp lệ" });
    }
    const [rows] = await db.query(`
      SELECT p.*, author.display_name AS author_name
      FROM posts p
      LEFT JOIN accounts a ON p.author_id = a.id
      LEFT JOIN people author ON a.person_id = author.id
      WHERE p.clan_id = ?
      ORDER BY p.created_at DESC
    `, [clanId]);
    return res.json({ success: true, posts: rows });
  } catch (e) {
    console.error("getPostsByClan:", e);
    return res.status(500).json({ success: false, message: "Lỗi tải bài viết của dòng họ" });
  }
};

/** Lấy thống kê cho Dashboard */
exports.getDashboardStats = async (req, res) => {
  try {
    const [[{ total_members }]] = await db.query("SELECT COUNT(*) AS total_members FROM people");
    const [[{ total_clans }]] = await db.query("SELECT COUNT(*) AS total_clans FROM clans");
    const [[{ total_events }]] = await db.query("SELECT COUNT(*) AS total_events FROM events");
    const [[{ total_photos }]] = await db.query("SELECT COUNT(*) AS total_photos FROM posts WHERE image_url IS NOT NULL AND image_url != ''");
    const [[{ total_posts }]] = await db.query("SELECT COUNT(*) AS total_posts FROM posts");
    
    const [recent_activities] = await db.query(`
      SELECT 'member' as type, display_name as content, created_at as time FROM people ORDER BY created_at DESC LIMIT 5
    `);

    return res.json({
      success: true,
      stats: {
        total_members,
        total_clans,
        total_events,
        total_photos,
        total_posts
      },
      recent_activities
    });
  } catch (e) {
    console.error("getDashboardStats:", e);
    return res.status(500).json({ success: false, message: "Lỗi thống kê" });
  }
};
