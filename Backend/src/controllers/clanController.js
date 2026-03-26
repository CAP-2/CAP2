const db = require("../config/db");

// Đăng ký dòng họ mới + chỉ định trưởng họ
// Nếu tài khoản trưởng họ hiện chưa thuộc clan (people.clan_id IS NULL) thì tự nâng role_id = 2 và gán clan_id.
exports.registerClan = async (req, res) => {
  const { clan_name, chief_account_id } = req.body;

  const normalizedChiefId =
    chief_account_id === undefined || chief_account_id === null || String(chief_account_id).trim() === ""
      ? NaN
      : Number(chief_account_id);

  if (!clan_name || String(clan_name).trim() === "") {
    return res.status(400).json({ success: false, message: "Thiếu tên dòng họ (clan_name)" });
  }

  if (!Number.isFinite(normalizedChiefId)) {
    return res
      .status(400)
      .json({ success: false, message: "Thiếu id trưởng họ (chief_account_id) hoặc không hợp lệ" });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [clanResult] = await connection.query("INSERT INTO clans (clan_name) VALUES (?)", [
      String(clan_name).trim(),
    ]);
    const clanId = clanResult.insertId;

    const [accounts] = await connection.query("SELECT id, person_id FROM accounts WHERE id = ?", [
      normalizedChiefId,
    ]);

    if (!accounts || accounts.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản trưởng họ" });
    }

    const chief = accounts[0];
    if (!chief.person_id) {
      await connection.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Tài khoản trưởng họ chưa liên kết person_id" });
    }

    const [peopleRows] = await connection.query("SELECT id, clan_id FROM people WHERE id = ?", [chief.person_id]);
    const person = peopleRows && peopleRows.length ? peopleRows[0] : null;

    if (!person) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy person của trưởng họ" });
    }

    let promoted = false;

    // Chỉ tự động nâng role + gán clan nếu tài khoản chưa thuộc clan nào
    if (person.clan_id === null) {
      await connection.query("UPDATE people SET clan_id = ? WHERE id = ?", [clanId, chief.person_id]);
      await connection.query("UPDATE accounts SET role_id = 2, status = 'active' WHERE id = ?", [
        normalizedChiefId,
      ]);
      promoted = true;
    }

    await connection.commit();

    return res.json({
      success: true,
      message: promoted ? "Đăng ký dòng họ thành công! Đã nâng trưởng họ lên Manager." : "Đăng ký dòng họ thành công!",
      clan_id: clanId,
      chief_account_id: normalizedChiefId,
      chief_promoted: promoted,
    });
  } catch (error) {
    await connection.rollback();
    console.error("registerClan error:", error);
    return res.status(500).json({ success: false, message: "Lỗi đăng ký dòng họ" });
  } finally {
    connection.release();
  }
};

