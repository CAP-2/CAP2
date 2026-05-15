import { useEffect, useMemo, useState } from "react";
import {
  getAdminAccounts,
  getAdminClans,
  createAdminAccount,
  updateAdminAccountAccess,
  deleteAdminAccount,
} from "../../../api/adminService";
import { formatDateVN } from "../../../shared/utils/dateFormat";

const emptyForm = {
  account_id: null,
  email: "",
  password: "",
  display_name: "",
  surname: "",
  middle_name: "",
  first_name: "",
  role_id: "3",
  status: "active",
  clan_id: "",
};

const roleLabel = (roleId) => {
  const id = Number(roleId);
  if (id === 1) return "Admin";
  if (id === 2) return "Manager";
  return "Member";
};

const accountName = (a) =>
  a.display_name || [a.surname, a.middle_name, a.first_name].filter(Boolean).join(" ").trim() || a.email || "Tài khoản";

export default function MembersPage() {
  const [accounts, setAccounts] = useState([]);
  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [clanSearchTerm, setClanSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [selectedClan, setSelectedClan] = useState(null);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [aRes, cRes] = await Promise.all([getAdminAccounts(), getAdminClans()]);
      setAccounts(aRes.accounts || []);
      setClans(cRes.clans || []);
    } catch (err) {
      setError(err.message || "Không tải được dữ liệu tài khoản");
    } finally {
      setLoading(false);
    }
  };

  const isAdminAccount = (account) => Number(account.role_id) === 1;

  const clanCards = useMemo(() => {
    const countMap = new Map();
    let normalAccountCount = 0;
    let adminAccountCount = 0;

    accounts.forEach((a) => {
      if (isAdminAccount(a)) {
        adminAccountCount += 1;
        return;
      }

      normalAccountCount += 1;
      const key = a.clan_id ? String(a.clan_id) : "none";
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });

    return [
      { id: "admin", clan_name: "Tài khoản Admin", member_count: adminAccountCount, is_admin_folder: true },
      { id: "all", clan_name: "Tất cả dòng họ", member_count: normalAccountCount },
      ...clans.map((c) => ({ ...c, member_count: countMap.get(String(c.id)) || 0 })),
      { id: "none", clan_name: "Chưa gán dòng họ", member_count: countMap.get("none") || 0 },
    ];
  }, [accounts, clans]);

  const filteredClanCards = useMemo(() => {
    const q = clanSearchTerm.trim().toLowerCase();
    if (!q) return clanCards;
    return clanCards.filter((clan) =>
      (clan.clan_name || "").toLowerCase().includes(q) || String(clan.member_count || 0).includes(q)
    );
  }, [clanCards, clanSearchTerm]);

  const filteredAccounts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return accounts.filter((a) => {
      const matchesSearch =
        !q ||
        (accountName(a).toLowerCase().includes(q)) ||
        (a.email || "").toLowerCase().includes(q) ||
        (a.clan_name || "").toLowerCase().includes(q);
      const matchesRole = filterRole === "all" || String(a.role_id) === filterRole;
      const matchesClan =
        selectedClan === "admin"
          ? isAdminAccount(a)
          : !isAdminAccount(a) && (
              selectedClan === "all" || selectedClan === null ||
              (selectedClan === "none" ? !a.clan_id : String(a.clan_id) === String(selectedClan))
            );
      return matchesSearch && matchesRole && matchesClan;
    });
  }, [accounts, searchTerm, filterRole, selectedClan]);

  const openClanFolder = (clanId) => {
    setSelectedClan(String(clanId));
    setSearchTerm("");
    setFilterRole("all");
  };

  const backToClanFolders = () => {
    setSelectedClan(null);
    setSearchTerm("");
    setFilterRole("all");
  };

  const openAdd = () => {
    setForm({
      ...emptyForm,
      role_id: selectedClan === "admin" ? "1" : "3",
      clan_id: selectedClan && selectedClan !== "all" && selectedClan !== "none" && selectedClan !== "admin" ? selectedClan : "",
    });
    setShowModal(true);
  };

  const openEdit = (account) => {
    setForm({
      account_id: account.account_id,
      email: account.email || "",
      password: "",
      display_name: account.display_name || accountName(account),
      surname: account.surname || "",
      middle_name: account.middle_name || "",
      first_name: account.first_name || "",
      role_id: String(account.role_id || 3),
      status: account.status || "active",
      clan_id: account.clan_id ? String(account.clan_id) : "",
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        role_id: Number(form.role_id),
        clan_id: Number(form.role_id) === 1 ? null : (form.clan_id || null),
      };
      if (!payload.password) delete payload.password;
      if (form.account_id) {
        await updateAdminAccountAccess(form.account_id, payload);
      } else {
        await createAdminAccount(payload);
      }
      setShowModal(false);
      setForm(emptyForm);
      await fetchData();
    } catch (err) {
      alert(err.message || "Lưu tài khoản thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account) => {
    if (!window.confirm(`Bạn có chắc muốn xóa tài khoản đăng nhập ${account.email}?`)) return;
    try {
      await deleteAdminAccount(account.account_id);
      await fetchData();
    } catch (err) {
      alert(err.message || "Xóa tài khoản thất bại");
    }
  };

  if (loading) return <div className="loading-state">Đang tải dữ liệu...</div>;

  const selectedClanName = clanCards.find((c) => String(c.id) === String(selectedClan))?.clan_name || "Tất cả dòng họ";

  return (
    <section className="members-management account-management-page">
      <div className="members-header account-header">
        <div className="header-info">
          <h2>Quản lý tài khoản đăng nhập</h2>
          <p>Quản lý toàn bộ tài khoản của hệ thống. Tài khoản Admin được tách thành một tệp riêng, không nằm trong các dòng họ.</p>
        </div>
        <div className="header-stats">
          <div className="stat-item"><span>Tổng tài khoản:</span><strong>{accounts.length}</strong></div>
          {selectedClan !== null && (
            <button className="admin-primary-btn" onClick={openAdd}>
              <span className="material-symbols-outlined">person_add</span>
              Thêm tài khoản
            </button>
          )}
        </div>
      </div>

      {selectedClan === null ? (
        <>
          <div className="account-folder-title account-folder-title-main">
            <div>
              <h3>Chọn tệp để xem tài khoản</h3>
              <p>Chọn “Tài khoản Admin” hoặc một dòng họ để mở danh sách tài khoản bên trong.</p>
            </div>
          </div>

          <div className="filter-bar clan-search-bar">
            <div className="search-box">
              <span className="material-symbols-outlined">search</span>
              <input
                type="text"
                placeholder="Tìm kiếm dòng họ hoặc tài khoản admin..."
                value={clanSearchTerm}
                onChange={(e) => setClanSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="account-clan-grid">
            {filteredClanCards.map((clan) => (
              <button
                type="button"
                key={clan.id}
                className={`account-clan-card ${clan.is_admin_folder ? "admin-folder-card" : ""}`}
                onClick={() => openClanFolder(clan.id)}
              >
                <span className="material-symbols-outlined">{clan.is_admin_folder ? "admin_panel_settings" : "folder_managed"}</span>
                <strong>{clan.clan_name}</strong>
                <small>{clan.member_count || 0} tài khoản</small>
              </button>
            ))}
          </div>

          {filteredClanCards.length === 0 && (
            <div className="empty-state">
              <span className="material-symbols-outlined">folder_off</span>
              <p>Không tìm thấy dòng họ phù hợp.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="account-folder-title account-folder-title-detail">
            <div>
              <button type="button" className="admin-secondary-btn account-back-btn" onClick={backToClanFolders}>
                <span className="material-symbols-outlined">arrow_back</span>
                Quay lại danh sách tệp
              </button>
              <h3>Tệp tài khoản: {selectedClanName}</h3>
              <p>{selectedClan === "admin" ? "Đang xem riêng các tài khoản Admin của hệ thống." : "Đang xem tài khoản thuộc tệp đã chọn. Có thể tìm kiếm, thêm, sửa hoặc xóa tài khoản bên dưới."}</p>
            </div>
          </div>

          <div className="filter-bar">
            <div className="search-box">
              <span className="material-symbols-outlined">search</span>
              <input
                type="text"
                placeholder="Tìm theo tên, email hoặc dòng họ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filters">
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                <option value="all">Tất cả vai trò</option>
                {selectedClan === "admin" && <option value="1">Admin</option>}
                <option value="2">Manager</option>
                <option value="3">Member</option>
              </select>
            </div>
          </div>
        </>
      )}

      {error && <div className="error-message">{error}</div>}

      {selectedClan !== null && (
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Dòng họ</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((a) => (
              <tr key={a.account_id}>
                <td>
                  <div className="member-cell">
                    <div className="account-avatar-letter">{accountName(a).charAt(0).toUpperCase()}</div>
                    <div className="member-info">
                      <div className="name">{accountName(a)}</div>
                      <div className="email">{a.email}</div>
                    </div>
                  </div>
                </td>
                <td><span className="clan-tag">{a.clan_name || "Chưa gán"}</span></td>
                <td><span className={`role-badge role-${a.role_id}`}>{roleLabel(a.role_id)}</span></td>
                <td><span className={`status-pill status-${a.status || "none"}`}>{a.status || "N/A"}</span></td>
                <td>{a.created_at ? formatDateVN(a.created_at) : "-"}</td>
                <td className="text-right">
                  <div className="action-buttons">
                    <button className="btn-icon btn-edit" title="Sửa" onClick={() => openEdit(a)}>
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    {Number(a.role_id) !== 1 && (
                      <button className="btn-icon btn-delete" title="Xóa" onClick={() => handleDelete(a)}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAccounts.length === 0 && (
          <div className="empty-state">
            <span className="material-symbols-outlined">manage_accounts</span>
            <p>Không tìm thấy tài khoản nào trong tệp này.</p>
          </div>
        )}
      </div>
      )}

      {showModal && (
        <div className="admin-modal-backdrop" onMouseDown={() => setShowModal(false)}>
          <form className="admin-account-modal" onSubmit={handleSave} onMouseDown={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <div>
                <h3>{form.account_id ? "Sửa tài khoản" : "Thêm tài khoản đăng nhập"}</h3>
                <p>{form.account_id ? "Cập nhật thông tin, vai trò và dòng họ." : "Tạo tài khoản mới và gán vào dòng họ."}</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="admin-form-grid">
              <label>Email đăng nhập<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>{form.account_id ? "Mật khẩu mới (bỏ trống nếu không đổi)" : "Mật khẩu"}<input required={!form.account_id} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              <label>Tên hiển thị<input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
              <label>Họ<input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} /></label>
              <label>Tên đệm<input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} /></label>
              <label>Tên<input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
              <label>Vai trò<select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value, clan_id: e.target.value === "1" ? "" : form.clan_id })}>{selectedClan === "admin" || form.role_id === "1" ? <option value="1">Admin</option> : null}<option value="2">Manager</option><option value="3">Member</option></select></label>
              <label>Trạng thái<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">active</option><option value="pending">pending</option><option value="rejected">rejected</option></select></label>
              {form.role_id !== "1" && <label className="admin-form-full">Dòng họ<select value={form.clan_id} onChange={(e) => setForm({ ...form, clan_id: e.target.value })}><option value="">Chưa gán dòng họ</option>{clans.map((c) => <option key={c.id} value={c.id}>{c.clan_name}</option>)}</select></label>}
            </div>

            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-btn" onClick={() => setShowModal(false)}>Hủy</button>
              <button type="submit" className="admin-primary-btn" disabled={saving}>{saving ? "Đang lưu..." : "Lưu tài khoản"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
