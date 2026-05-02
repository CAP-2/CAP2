const db = require("../config/db");
const bcrypt = require("bcryptjs");
const { deletePersonCompletely } = require("../utils/personDeletion");
const memberController = require("./memberController");

const buildDisplayNameFromParts = (surname, middleName, firstName) => {
  const s = surname == null ? "" : String(surname).trim();
  const m = middleName == null ? "" : String(middleName).trim();
  const f = firstName == null ? "" : String(firstName).trim();
  return [s, m, f].filter(Boolean).join(" ").trim();
};

let hasEnsuredTaskTables = false;

const ensureManagerTaskEventLink = async () => {
    const [cols] = await db.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'manager_tasks'
          AND COLUMN_NAME = 'event_id'
    `);
    if (!cols.length) {
        await db.query(`ALTER TABLE manager_tasks ADD COLUMN event_id INT NULL AFTER due_date`);
    }

    const [idx] = await db.query(`
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'manager_tasks'
          AND INDEX_NAME = 'idx_manager_tasks_event'
    `);
    if (!idx.length) {
        await db.query(`ALTER TABLE manager_tasks ADD INDEX idx_manager_tasks_event (event_id)`);
    }

    const [fk] = await db.query(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'manager_tasks'
          AND CONSTRAINT_NAME = 'fk_manager_tasks_event'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `);
    if (!fk.length) {
        await db.query(`
            ALTER TABLE manager_tasks
            ADD CONSTRAINT fk_manager_tasks_event
            FOREIGN KEY (event_id) REFERENCES events(id)
            ON DELETE SET NULL
        `);
    }
};

const ensureTaskTables = async () => {
  if (hasEnsuredTaskTables) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS manager_tasks (
      id INT PRIMARY KEY AUTO_INCREMENT,
      manager_account_id INT NOT NULL,
      clan_id INT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      due_date DATE NULL,
      event_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_manager_tasks_manager (manager_account_id),
      KEY idx_manager_tasks_clan (clan_id),
      KEY idx_manager_tasks_event (event_id),
      CONSTRAINT fk_manager_tasks_account FOREIGN KEY (manager_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      CONSTRAINT fk_manager_tasks_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS manager_task_assignments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      task_id INT NOT NULL,
      member_account_id INT NOT NULL,
      member_person_id INT NOT NULL,
      status ENUM('assigned','in_progress','completed') DEFAULT 'assigned',
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL DEFAULT NULL,
      UNIQUE KEY uk_task_member (task_id, member_account_id),
      KEY idx_task_assignments_member (member_account_id),
      KEY idx_task_assignments_person (member_person_id),
      CONSTRAINT fk_task_assignments_task FOREIGN KEY (task_id) REFERENCES manager_tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_task_assignments_account FOREIGN KEY (member_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      CONSTRAINT fk_task_assignments_person FOREIGN KEY (member_person_id) REFERENCES people(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await ensureManagerTaskEventLink();
  hasEnsuredTaskTables = true;
};
const getDashboardDateFilter = (period = "all") => {
  const value = String(period || "all").toLowerCase();
  if (value === "day") return "created_at >= CURDATE()";
  if (value === "week") return "created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
  if (value === "month") return "created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')";
  return "1=1";
};

const withDateFilter = (period, alias = "") => {
  const filter = getDashboardDateFilter(period);
  if (filter === "1=1") return filter;
  return alias ? filter.replace(/created_at/g, `${alias}.created_at`) : filter;
};

/** Danh sách dòng họ + số thành viên + số manager + số bài viết + chủ quản */
exports.listClans = async (req, res) => {
  try {
    await ensureTaskTables();
    const period = req.query.period || req.query.range || "all";
    const peopleFilter = withDateFilter(period, "p");
    const postFilter = withDateFilter(period, "po");
    const taskFilter = withDateFilter(period, "mt");

    const [rows] = await db.query(`
      SELECT c.id, c.clan_name, c.history, c.hall_address, c.created_at,
        (SELECT COUNT(*) FROM people p WHERE p.clan_id = c.id AND ${peopleFilter}) AS member_count,
        (SELECT COUNT(*) FROM posts po WHERE po.clan_id = c.id AND ${postFilter}) AS post_count,
        (
          SELECT COUNT(*)
          FROM manager_task_assignments mta
          INNER JOIN manager_tasks mt ON mt.id = mta.task_id
          WHERE mt.clan_id = c.id AND ${taskFilter}
        ) AS task_count,
        (
          SELECT COUNT(*)
          FROM manager_task_assignments mta
          INNER JOIN manager_tasks mt ON mt.id = mta.task_id
          WHERE mt.clan_id = c.id AND mta.status <> 'completed' AND ${taskFilter}
        ) AS open_task_count,
        (
          SELECT COUNT(*)
          FROM manager_task_assignments mta
          INNER JOIN manager_tasks mt ON mt.id = mta.task_id
          WHERE mt.clan_id = c.id AND mta.status = 'completed' AND ${taskFilter}
        ) AS completed_task_count,
        (
          SELECT COUNT(DISTINCT a.id)
          FROM accounts a
          LEFT JOIN people mp ON mp.id = a.person_id
          LEFT JOIN account_clans ac ON ac.account_id = a.id AND ac.status = 'active'
          WHERE a.role_id = 2 AND (mp.clan_id = c.id OR ac.clan_id = c.id)
        ) AS manager_count,
        (
          SELECT COALESCE(NULLIF(mp.display_name, ''), a.email)
          FROM accounts a
          LEFT JOIN people mp ON mp.id = a.person_id
          LEFT JOIN account_clans ac ON ac.account_id = a.id AND ac.status = 'active'
          WHERE a.role_id = 2 AND (mp.clan_id = c.id OR ac.clan_id = c.id)
          ORDER BY a.id ASC LIMIT 1
        ) AS owner_name
      FROM clans c
      ORDER BY c.id ASC
    `);
    return res.json({ success: true, clans: rows });
  } catch (e) {
    console.error("listClans:", e);
    return res.status(500).json({ success: false, message: "Lỗi danh sách dòng họ" });
  }
};

exports.getTasksByClan = async (req, res) => {
  try {
    await ensureTaskTables();
    const clanId = Number(req.params.clanId);
    if (!Number.isFinite(clanId) || clanId <= 0) {
      return res.status(400).json({ success: false, message: "clan_id không hợp lệ" });
    }

    const [clans] = await db.query(
      "SELECT id, clan_name, history, hall_address FROM clans WHERE id = ? LIMIT 1",
      [clanId]
    );
    if (!clans.length) {
      return res.status(404).json({ success: false, message: "Không tìm thấy dòng họ" });
    }

    const [tasks] = await db.query(
      `
        SELECT
          a.id,
          a.task_id,
          t.title,
          t.description,
          t.due_date,
          t.created_at,
          t.clan_id,
          t.event_id,
          e.title AS event_title,
          e.event_date,
          e.description AS event_description,
          c.clan_name,
          a.status,
          a.assigned_at,
          a.completed_at,
          m.id AS manager_id,
          COALESCE(mp.display_name, m.email) AS manager_name,
          member.id AS member_person_id,
          ma.id AS member_id,
          member.display_name AS member_name,
          member.surname,
          member.middle_name,
          member.first_name
        FROM manager_task_assignments a
        INNER JOIN manager_tasks t ON t.id = a.task_id
        LEFT JOIN events e ON e.id = t.event_id
        LEFT JOIN clans c ON c.id = t.clan_id
        INNER JOIN accounts m ON m.id = t.manager_account_id
        LEFT JOIN people mp ON mp.id = m.person_id
        INNER JOIN accounts ma ON ma.id = a.member_account_id
        INNER JOIN people member ON member.id = a.member_person_id
        WHERE t.clan_id = ?
        ORDER BY
          CASE a.status
            WHEN 'assigned' THEN 0
            WHEN 'in_progress' THEN 1
            WHEN 'completed' THEN 2
            ELSE 3
          END,
          t.created_at DESC,
          a.id DESC
      `,
      [clanId]
    );

    return res.json({ success: true, clan: clans[0], tasks });
  } catch (e) {
    console.error("getTasksByClan:", e);
    return res.status(500).json({ success: false, message: "Lỗi lấy công việc theo dòng họ" });
  }
};



const normalizeOptionalString = (value) => (value == null ? "" : String(value).trim());

const managerPayloadPresent = (body = {}) => {
  return [
    body.manager_email,
    body.manager_password,
    body.manager_surname,
    body.manager_middle_name,
    body.manager_first_name,
    body.manager_display_name,
  ].some((value) => normalizeOptionalString(value) !== "");
};

async function createManagerForClan(connection, clanId, body = {}) {
  const email = normalizeOptionalString(body.manager_email || body.email).toLowerCase();
  const password = String(body.manager_password || body.password || "");
  const surname = normalizeOptionalString(body.manager_surname || body.surname);
  const middleName = normalizeOptionalString(body.manager_middle_name || body.middle_name);
  const firstName = normalizeOptionalString(body.manager_first_name || body.first_name);
  const displayName =
    normalizeOptionalString(body.manager_display_name || body.display_name) ||
    buildDisplayNameFromParts(surname, middleName, firstName) ||
    email;

  if (!email || !password) {
    const err = new Error("Vui lòng nhập email và mật khẩu Manager phụ trách dòng họ");
    err.status = 400;
    throw err;
  }
  if (password.length < 6) {
    const err = new Error("Mật khẩu Manager tối thiểu 6 ký tự");
    err.status = 400;
    throw err;
  }
  if (!surname && !firstName && !displayName) {
    const err = new Error("Vui lòng nhập họ tên Manager phụ trách dòng họ");
    err.status = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const [personResult] = await connection.query(
    `INSERT INTO people (clan_id, display_name, first_name, middle_name, surname, generation)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [clanId, displayName, firstName || null, middleName || null, surname || null]
  );
  const personId = personResult.insertId;

  const [accountResult] = await connection.query(
    `INSERT INTO accounts (email, password, person_id, role_id, status) VALUES (?, ?, ?, 2, 'active')`,
    [email, hashedPassword, personId]
  );
  const accountId = accountResult.insertId;

  await connection.query(
    `INSERT INTO account_clans (account_id, clan_id, person_id, status)
     VALUES (?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE person_id = VALUES(person_id), status = 'active'`,
    [accountId, clanId, personId]
  );

  return { account_id: accountId, person_id: personId, email, display_name: displayName };
}

exports.createClan = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const clanName = String(req.body.clan_name || req.body.name || "").trim();
    const history = req.body.history == null ? null : String(req.body.history).trim();
    const hallAddress = req.body.hall_address == null ? null : String(req.body.hall_address).trim();

    if (!clanName) {
      return res.status(400).json({ success: false, message: "Tên dòng họ không được để trống" });
    }

    await connection.beginTransaction();
    const [exists] = await connection.query("SELECT id FROM clans WHERE LOWER(clan_name) = LOWER(?) LIMIT 1", [clanName]);
    if (exists.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Dòng họ này đã tồn tại" });
    }

    const [result] = await connection.query(
      "INSERT INTO clans (clan_name, history, hall_address) VALUES (?, ?, ?)",
      [clanName, history || null, hallAddress || null]
    );
    const clanId = result.insertId;

    let manager = null;
    if (managerPayloadPresent(req.body)) {
      manager = await createManagerForClan(connection, clanId, req.body);
    }

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: manager ? "Đã thêm dòng họ và tài khoản Manager phụ trách" : "Đã thêm dòng họ",
      clan: { id: clanId, clan_name: clanName, history, hall_address: hallAddress },
      manager,
    });
  } catch (e) {
    try { await connection.rollback(); } catch (_) {}
    console.error("createClan:", e);
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Email Manager đã tồn tại trong hệ thống" });
    }
    return res.status(e.status || 500).json({ success: false, message: e.message || "Lỗi tạo dòng họ" });
  } finally {
    connection.release();
  }
};
exports.updateClan = async (req, res) => {
  try {
    const clanId = Number(req.params.clanId);
    const clanName = String(req.body.clan_name || req.body.name || "").trim();
    const history = req.body.history == null ? null : String(req.body.history).trim();
    const hallAddress = req.body.hall_address == null ? null : String(req.body.hall_address).trim();

    if (!Number.isInteger(clanId) || clanId <= 0) {
      return res.status(400).json({ success: false, message: "clan_id không hợp lệ" });
    }
    if (!clanName) {
      return res.status(400).json({ success: false, message: "Tên dòng họ không được để trống" });
    }

    const [rows] = await db.query("SELECT id FROM clans WHERE id = ? LIMIT 1", [clanId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Không tìm thấy dòng họ" });
    }

    const [dups] = await db.query(
      "SELECT id FROM clans WHERE LOWER(clan_name) = LOWER(?) AND id <> ? LIMIT 1",
      [clanName, clanId]
    );
    if (dups.length) {
      return res.status(409).json({ success: false, message: "Tên dòng họ này đã tồn tại" });
    }

    await db.query(
      "UPDATE clans SET clan_name = ?, history = ?, hall_address = ? WHERE id = ?",
      [clanName, history || null, hallAddress || null, clanId]
    );

    return res.json({ success: true, message: "Đã cập nhật dòng họ" });
  } catch (e) {
    console.error("updateClan:", e);
    return res.status(500).json({ success: false, message: "Lỗi cập nhật dòng họ" });
  }
};

exports.deleteClan = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const clanId = Number(req.params.clanId);
    if (!Number.isInteger(clanId) || clanId <= 0) {
      return res.status(400).json({ success: false, message: "clan_id không hợp lệ" });
    }

    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT id, clan_name FROM clans WHERE id = ? LIMIT 1", [clanId]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy dòng họ" });
    }

    // Xóa dòng họ sẽ xóa toàn bộ phả hệ liên quan nhờ các khóa ngoại ON DELETE CASCADE.
    // Account có person_id thuộc dòng họ bị xóa sẽ tự set NULL theo ràng buộc FK_Account_Person.
    await connection.query("DELETE FROM manager_tasks WHERE clan_id = ?", [clanId]);
    await connection.query("DELETE FROM clans WHERE id = ?", [clanId]);
    await connection.commit();
    return res.json({ success: true, message: "Đã xóa dòng họ và phả hệ liên quan" });
  } catch (e) {
    try { await connection.rollback(); } catch (_) {}
    console.error("deleteClan:", e);
    return res.status(500).json({ success: false, message: "Lỗi xóa dòng họ" });
  } finally {
    connection.release();
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

    await db.query(
      `INSERT INTO account_clans (account_id, clan_id, person_id, status)
       VALUES (?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE person_id = VALUES(person_id), status = 'active'`,
      [accResult.insertId, cid, personId]
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
    await deletePersonCompletely(personId, { deleteAccounts: true });
    return res.json({ success: true, message: "Đã xóa thành viên và toàn bộ liên kết gia phả liên quan" });
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
    const period = req.query.period || req.query.range || "all";
    const accountsFilter = withDateFilter(period, "a");
    const peopleFilter = withDateFilter(period, "p");
    const clansFilter = withDateFilter(period, "c");
    const postsFilter = withDateFilter(period, "po");

    const [[{ total_accounts }]] = await db.query(`SELECT COUNT(*) AS total_accounts FROM accounts a WHERE ${accountsFilter}`);
    const [[{ total_members }]] = await db.query(`SELECT COUNT(*) AS total_members FROM people p WHERE ${peopleFilter}`);
    const [[{ total_clans }]] = await db.query(`SELECT COUNT(*) AS total_clans FROM clans c WHERE ${clansFilter}`);
    const [[{ total_events }]] = await db.query("SELECT COUNT(*) AS total_events FROM events");
    const [[{ total_photos }]] = await db.query(`SELECT COUNT(*) AS total_photos FROM posts po WHERE po.image_url IS NOT NULL AND po.image_url != '' AND ${postsFilter}`);
    const [[{ total_posts }]] = await db.query(`SELECT COUNT(*) AS total_posts FROM posts po WHERE ${postsFilter}`);

    const [monthly_clans] = await db.query(`
      SELECT DATE_FORMAT(c.created_at, '%Y-%m') AS month_key,
             DATE_FORMAT(c.created_at, '%m/%Y') AS label,
             COUNT(*) AS total
      FROM clans c
      WHERE c.created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01')
      GROUP BY month_key, label
      ORDER BY month_key ASC
    `);

    return res.json({
      success: true,
      period,
      stats: {
        total_accounts,
        total_members,
        total_clans,
        total_events,
        total_photos,
        total_posts
      },
      monthly_clans
    });
  } catch (e) {
    console.error("getDashboardStats:", e);
    return res.status(500).json({ success: false, message: "Lỗi thống kê" });
  }
};

// === Admin account management full CRUD (override/extend) ===
const normalizeText = (value) => (value == null ? "" : String(value).trim());
const normalizeNullable = (value) => {
  const text = normalizeText(value);
  return text === "" ? null : text;
};

async function ensurePersonForAccount(connection, account, data) {
  const displayName = normalizeText(data.display_name) || buildDisplayNameFromParts(data.surname, data.middle_name, data.first_name) || normalizeText(data.email);
  const clanId = data.clan_id === null || data.clan_id === "" || data.clan_id === undefined ? null : Number(data.clan_id);
  if (clanId !== null && !Number.isFinite(clanId)) {
    const err = new Error("clan_id không hợp lệ");
    err.status = 400;
    throw err;
  }
  if (clanId !== null) {
    const [clans] = await connection.query("SELECT id FROM clans WHERE id = ? LIMIT 1", [clanId]);
    if (!clans.length) {
      const err = new Error("Dòng họ không tồn tại");
      err.status = 400;
      throw err;
    }
  }

  const personPayload = [
    clanId,
    displayName,
    normalizeNullable(data.first_name),
    normalizeNullable(data.middle_name),
    normalizeNullable(data.surname),
  ];

  if (account.person_id) {
    await connection.query(
      `UPDATE people SET clan_id = ?, display_name = ?, first_name = ?, middle_name = ?, surname = ? WHERE id = ?`,
      [...personPayload, account.person_id]
    );
    return account.person_id;
  }

  const [result] = await connection.query(
    `INSERT INTO people (clan_id, display_name, first_name, middle_name, surname, generation) VALUES (?, ?, ?, ?, ?, 1)`,
    personPayload
  );
  await connection.query("UPDATE accounts SET person_id = ? WHERE id = ?", [result.insertId, account.id]);
  return result.insertId;
}

exports.listAccounts = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        a.id AS account_id,
        a.email,
        a.role_id,
        a.status,
        a.person_id,
        a.created_at,
        a.updated_at,
        p.first_name,
        p.middle_name,
        p.surname,
        p.display_name,
        CASE WHEN a.role_id = 1 THEN NULL ELSE COALESCE(p.clan_id, ac_primary.clan_id) END AS clan_id,
        CASE WHEN a.role_id = 1 THEN NULL ELSE COALESCE(c_person.clan_name, ac_names.clan_names) END AS clan_name,
        CASE WHEN a.role_id = 1 THEN NULL ELSE ac_names.clan_ids END AS managed_clan_ids,
        CASE WHEN a.role_id = 1 THEN NULL ELSE ac_names.clan_names END AS managed_clan_names
      FROM accounts a
      LEFT JOIN people p ON a.person_id = p.id
      LEFT JOIN clans c_person ON p.clan_id = c_person.id
      LEFT JOIN (
        SELECT account_id, MIN(clan_id) AS clan_id
        FROM account_clans
        WHERE status = 'active'
        GROUP BY account_id
      ) ac_primary ON ac_primary.account_id = a.id
      LEFT JOIN (
        SELECT ac.account_id,
               GROUP_CONCAT(DISTINCT ac.clan_id ORDER BY ac.clan_id SEPARATOR ',') AS clan_ids,
               GROUP_CONCAT(DISTINCT c.clan_name ORDER BY c.clan_name SEPARATOR ', ') AS clan_names
        FROM account_clans ac
        JOIN clans c ON c.id = ac.clan_id
        WHERE ac.status = 'active'
        GROUP BY ac.account_id
      ) ac_names ON ac_names.account_id = a.id
      ORDER BY
        CASE WHEN a.role_id = 1 THEN 0 ELSE 1 END,
        COALESCE(c_person.clan_name, ac_names.clan_names, 'zzz'),
        a.role_id ASC,
        a.id DESC
    `);
    return res.json({ success: true, accounts: rows });
  } catch (e) {
    console.error("listAccounts:", e);
    return res.status(500).json({ success: false, message: "Lỗi danh sách tài khoản" });
  }
};

exports.createAccount = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const email = normalizeText(req.body.email).toLowerCase();
    const password = String(req.body.password || "");
    const roleId = Number(req.body.role_id || 3);
    const status = normalizeText(req.body.status) || "active";

    if (!email || !password) return res.status(400).json({ success: false, message: "Vui lòng nhập email và mật khẩu" });
    if (password.length < 6) return res.status(400).json({ success: false, message: "Mật khẩu tối thiểu 6 ký tự" });
    if (![2, 3].includes(roleId)) return res.status(400).json({ success: false, message: "Chỉ được tạo Manager hoặc Member" });
    if (!["pending", "active", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });

    await connection.beginTransaction();
    const displayName = normalizeText(req.body.display_name) || buildDisplayNameFromParts(req.body.surname, req.body.middle_name, req.body.first_name) || email;
    const clanId = req.body.clan_id === null || req.body.clan_id === "" || req.body.clan_id === undefined ? null : Number(req.body.clan_id);
    if (clanId !== null && !Number.isFinite(clanId)) throw Object.assign(new Error("clan_id không hợp lệ"), { status: 400 });
    if (clanId !== null) {
      const [clans] = await connection.query("SELECT id FROM clans WHERE id = ? LIMIT 1", [clanId]);
      if (!clans.length) throw Object.assign(new Error("Dòng họ không tồn tại"), { status: 400 });
    }

    const [personResult] = await connection.query(
      `INSERT INTO people (clan_id, display_name, first_name, middle_name, surname, generation) VALUES (?, ?, ?, ?, ?, 1)`,
      [clanId, displayName, normalizeNullable(req.body.first_name), normalizeNullable(req.body.middle_name), normalizeNullable(req.body.surname)]
    );
    const hashedPassword = await bcrypt.hash(password, 10);
    const [accResult] = await connection.query(
      `INSERT INTO accounts (email, password, person_id, role_id, status) VALUES (?, ?, ?, ?, ?)`,
      [email, hashedPassword, personResult.insertId, roleId, status]
    );

    // Manager phải được ghi cả vào bảng account_clans để màn hình Admin
    // đọc đúng dòng họ quản lý, kể cả khi sau này person_id/clan_id thay đổi.
    if (Number(roleId) === 2 && clanId !== null) {
      await connection.query(
        `INSERT INTO account_clans (account_id, clan_id, person_id, status)
         VALUES (?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE clan_id = VALUES(clan_id), person_id = VALUES(person_id), status = 'active'`,
        [accResult.insertId, clanId, personResult.insertId]
      );
    }

    await connection.commit();
    return res.status(201).json({ success: true, message: "Đã tạo tài khoản", account_id: accResult.insertId, person_id: personResult.insertId });
  } catch (e) {
    try { await connection.rollback(); } catch (_) {}
    console.error("createAccount:", e);
    if (e.code === "ER_DUP_ENTRY") return res.status(400).json({ success: false, message: "Email đã tồn tại" });
    return res.status(e.status || 500).json({ success: false, message: e.message || "Lỗi tạo tài khoản" });
  } finally {
    connection.release();
  }
};

exports.updateAccountAccess = async (req, res) => {
  const targetId = Number(req.params.id);
  const selfId = Number(req.user.id);
  const connection = await db.getConnection();
  try {
    if (!Number.isFinite(targetId)) return res.status(400).json({ success: false, message: "account_id không hợp lệ" });
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT id, person_id, role_id FROM accounts WHERE id = ? LIMIT 1", [targetId]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    }
    const acc = rows[0];
    const body = req.body || {};

    const email = normalizeText(body.email).toLowerCase();
    if (email) await connection.query("UPDATE accounts SET email = ? WHERE id = ?", [email, targetId]);

    if (body.password != null && String(body.password).trim() !== "") {
      const pwd = String(body.password);
      if (pwd.length < 6) throw Object.assign(new Error("Mật khẩu tối thiểu 6 ký tự"), { status: 400 });
      const hashed = await bcrypt.hash(pwd, 10);
      await connection.query("UPDATE accounts SET password = ? WHERE id = ?", [hashed, targetId]);
    }

    if (body.role_id !== undefined) {
      if (targetId === selfId) throw Object.assign(new Error("Không thể đổi quyền của chính mình"), { status: 400 });
      if (Number(acc.role_id) === 1) throw Object.assign(new Error("Không chỉnh quyền tài khoản Admin qua màn hình này"), { status: 400 });
      const rid = Number(body.role_id);
      if (![2, 3].includes(rid)) throw Object.assign(new Error("Chỉ gán vai trò Manager hoặc Member"), { status: 400 });
      await connection.query("UPDATE accounts SET role_id = ? WHERE id = ?", [rid, targetId]);
    }

    if (body.status !== undefined) {
      const st = normalizeText(body.status);
      if (["pending", "active", "rejected"].includes(st)) {
        if (targetId === selfId && st !== "active") throw Object.assign(new Error("Không thể khóa tài khoản admin đang đăng nhập"), { status: 400 });
        await connection.query("UPDATE accounts SET status = ? WHERE id = ?", [st, targetId]);
      }
    }

    let ensuredPersonId = acc.person_id;
    if (["display_name", "first_name", "middle_name", "surname", "clan_id"].some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
      ensuredPersonId = await ensurePersonForAccount(connection, acc, body);
    }

    // Đồng bộ quan hệ tài khoản - dòng họ cho Manager.
    // Đây là nguồn dữ liệu chính để Admin lọc/tách tài khoản theo dòng họ.
    const [[freshAcc]] = await connection.query("SELECT id, person_id, role_id FROM accounts WHERE id = ? LIMIT 1", [targetId]);
    const finalRoleId = Number(freshAcc?.role_id || acc.role_id);
    const finalPersonId = ensuredPersonId || freshAcc?.person_id || acc.person_id;
    if (Object.prototype.hasOwnProperty.call(body, "clan_id") || body.role_id !== undefined) {
      const clanId = body.clan_id === null || body.clan_id === "" || body.clan_id === undefined ? null : Number(body.clan_id);
      if (finalRoleId === 2 && clanId !== null && Number.isFinite(clanId) && finalPersonId) {
        await connection.query(
          `INSERT INTO account_clans (account_id, clan_id, person_id, status)
           VALUES (?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE clan_id = VALUES(clan_id), person_id = VALUES(person_id), status = 'active'`,
          [targetId, clanId, finalPersonId]
        );
      } else if (finalRoleId !== 2 || clanId === null) {
        await connection.query("DELETE FROM account_clans WHERE account_id = ?", [targetId]);
      }
    }

    await connection.commit();
    return res.json({ success: true, message: "Đã cập nhật tài khoản" });
  } catch (e) {
    try { await connection.rollback(); } catch (_) {}
    console.error("updateAccountAccess:", e);
    if (e.code === "ER_DUP_ENTRY") return res.status(400).json({ success: false, message: "Email đã tồn tại" });
    return res.status(e.status || 500).json({ success: false, message: e.message || "Lỗi cập nhật tài khoản" });
  } finally {
    connection.release();
  }
};

exports.deleteAccount = async (req, res) => {
  const targetId = Number(req.params.id);
  const selfId = Number(req.user.id);
  const connection = await db.getConnection();
  try {
    if (!Number.isFinite(targetId)) return res.status(400).json({ success: false, message: "account_id không hợp lệ" });
    if (targetId === selfId) return res.status(400).json({ success: false, message: "Không thể xóa tài khoản đang đăng nhập" });
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT id, person_id, role_id FROM accounts WHERE id = ? LIMIT 1", [targetId]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    }
    if (Number(rows[0].role_id) === 1) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Không xóa tài khoản Admin qua màn hình này" });
    }
    const personId = rows[0].person_id ? Number(rows[0].person_id) : null;
    if (personId) {
      await deletePersonCompletely(personId, { connection, deleteAccounts: false });
    }
    await connection.query("DELETE FROM accounts WHERE id = ?", [targetId]);
    await connection.commit();
    return res.json({ success: true, message: "Đã xóa tài khoản và dữ liệu gia phả liên quan" });
  } catch (e) {
    try { await connection.rollback(); } catch (_) {}
    console.error("deleteAccount:", e);
    return res.status(500).json({ success: false, message: "Lỗi xóa tài khoản" });
  } finally {
    connection.release();
  }
};
