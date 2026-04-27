import { useEffect, useState } from "react";
import { getAdminMembers, updateAdminAccountAccess, deleteAdminMember } from "../../api/adminService";
import { getAdminClans } from "../../api/adminService";

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterClan, setFilterClan] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([getAdminMembers(), getAdminClans()]);
      setMembers(mRes.members || []);
      setClans(cRes.clans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await updateAdminAccountAccess(id, { status });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa thành viên này? Hành động này không thể hoàn tác.")) {
      try {
        await deleteAdminMember(id);
        fetchData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch = 
      (m.display_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (m.account_email?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || String(m.role_id) === filterRole;
    const matchesClan = filterClan === "all" || String(m.clan_id) === filterClan;
    return matchesSearch && matchesRole && matchesClan;
  });

  if (loading) return <div className="loading-state">Đang tải dữ liệu...</div>;

  return (
    <section className="members-management">
      <div className="members-header">
        <div className="header-info">
          <h2>Quản lý thành viên</h2>
          <p>Danh sách toàn bộ thành viên và quản trị viên trong hệ thống.</p>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span>Tổng số:</span>
            <strong>{members.length}</strong>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <span className="material-symbols-outlined">search</span>
          <input 
            type="text" 
            placeholder="Tìm theo tên hoặc email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filters">
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="all">Tất cả vai trò</option>
            <option value="1">Admin</option>
            <option value="2">Manager</option>
            <option value="3">Member</option>
          </select>

          <select value={filterClan} onChange={(e) => setFilterClan(e.target.value)}>
            <option value="all">Tất cả dòng họ</option>
            {clans.map(c => (
              <option key={c.id} value={c.id}>{c.clan_name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Thành viên</th>
              <th>Dòng họ</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tham gia</th>
              <th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="member-cell">
                    <img 
                      src={m.avatar_url || "/default-avatar.png"} 
                      alt="" 
                      className="member-avatar"
                      onError={(e) => e.target.src = "/default-avatar.png"}
                    />
                    <div className="member-info">
                      <div className="name">{m.display_name}</div>
                      <div className="email">{m.account_email || "Chưa tạo tài khoản"}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="clan-tag">{m.clan_name || "N/A"}</span>
                </td>
                <td>
                  <span className={`role-badge role-${m.role_id}`}>
                    {m.role_id === 1 ? "Admin" : m.role_id === 2 ? "Manager" : "Member"}
                  </span>
                </td>
                <td>
                  <span className={`status-pill status-${m.account_status || 'none'}`}>
                    {m.account_status || 'N/A'}
                  </span>
                </td>
                <td>{new Date(m.created_at).toLocaleDateString('vi-VN')}</td>
                <td className="text-right">
                  <div className="action-buttons">
                    {m.account_status === "pending" && (
                      <button 
                        className="btn-icon btn-approve" 
                        title="Duyệt"
                        onClick={() => handleUpdateStatus(m.account_id, "active")}
                      >
                        <span className="material-symbols-outlined">check_circle</span>
                      </button>
                    )}
                    <button 
                      className="btn-icon btn-delete" 
                      title="Xóa"
                      onClick={() => handleDelete(m.id)}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredMembers.length === 0 && (
          <div className="empty-state">
            <span className="material-symbols-outlined">group_off</span>
            <p>Không tìm thấy thành viên nào khớp với điều kiện lọc.</p>
          </div>
        )}
      </div>
    </section>
  );
}
