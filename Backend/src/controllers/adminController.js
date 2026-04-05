const db = require("../config/db");
const bcrypt = require("bcryptjs");
const memberController = require("./memberController");

const buildDisplayNameFromParts = (surname, middleName, firstName) => {
  const s = surname == null ? "" : String(surname).trim();
  const m = middleName == null ? "" : String(middleName).trim();
  const f = firstName == null ? "" : String(firstName).trim();
  return [s, m, f].filter(Boolean).join(" ").trim();
};

/** Danh sách dòng họ + số thành viên + số manager */
exports.listClans = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.clan_name, c.created_at,
        (SELECT COUNT(*) FROM people p WHERE p.clan_id = c.id) AS member_count,
        (SELECT COUNT(*) FROM accounts a
         INNER JOIN people p ON a.person_id = p.id
         WHERE p.clan_id = c.id AND a.role_id = 2 AND a.status = 'active') AS manager_count
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
