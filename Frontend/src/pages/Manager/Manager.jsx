import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./manager.css";
import {
  getStats,
  getMembers,
  getMemberRelations,
  updateMemberRelations,
  getMemberDetail,
  updateMemberByManager,
  createMember,
  getPendingUsers,
  approveUserAPI,
  rejectUserAPI,
  getPendingPosts,
  approvePostAPI,
  rejectPostAPI,
  getMediaAPI,
  createPersonAPI,
  linkRelationsAPI,
  assignTaskAPI, 
  getTasksAPI,   
} from "../../api/managerService";
import {
  getMemberDashboard,
  updateMemberProfile,
  changeMemberPassword,
} from "../../api/memberService";

function readSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

const emptyMemberEditForm = () => ({
  email: "",
  status: "active",
  role_id: "3",
  new_password: "",
  surname: "",
  middle_name: "",
  first_name: "",
  gender: "1",
  birth_date: "",
  death_date: "",
  is_living: "1",
  generation: "1",
  branch: "",
  hometown: "",
  address: "",
  phone: "",
  people_email: "",
  zalo: "",
  facebook: "",
  avatar_url: "",
  bio: "",
  note: "",
  clan_id: "",
  family_id: "",
  spouse_id: "",
  children_ids: "",
  parent_father_id: "",
  parent_mother_id: "",
});

function mapMemberToForm(m) {
  return {
    email: m.email || "",
    status: m.status || "active",
    role_id: String(m.role_id ?? 3),
    new_password: "",
    surname: m.surname ?? "",
    middle_name: m.middle_name ?? "",
    first_name: m.first_name ?? "",
    gender: m.gender == null || m.gender === "" ? "" : String(m.gender),
    birth_date: m.birth_date || "",
    death_date: m.death_date || "",
    is_living: m.is_living === 0 || m.is_living === false ? "0" : "1",
    generation: m.generation != null ? String(m.generation) : "1",
    branch: m.branch != null ? String(m.branch) : "",
    hometown: m.hometown || "",
    address: m.address || "",
    phone: m.phone || "",
    people_email: m.people_email || "",
    zalo: m.zalo || "",
    facebook: m.facebook || "",
    avatar_url: m.avatar_url || "",
    bio: m.bio || "",
    note: m.note || "",
    clan_id: m.clan_id != null ? String(m.clan_id) : "",
    family_id: m.marriage?.family_id != null ? String(m.marriage.family_id) : "",
    spouse_id: m.marriage?.spouse_id != null ? String(m.marriage.spouse_id) : "",
    children_ids: Array.isArray(m.marriage?.children_ids) ? m.marriage.children_ids.join(", ") : "",
    parent_father_id: m.bloodline?.parent_father_id != null ? String(m.bloodline.parent_father_id) : "",
    parent_mother_id: m.bloodline?.parent_mother_id != null ? String(m.bloodline.parent_mother_id) : "",
  };
}

const Manager = () => {
  const navigate = useNavigate();
  
  // --- STATE TỔNG QUAN ---
  const [stats, setStats] = useState({ total_members: 0, total_managers: 0, total_pending: 0 });
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- STATE TRANG DUY TRÌ MỐI QUAN HỆ ---
  const [selectedRelPerson, setSelectedRelPerson] = useState(null);

  // --- STATE CHỨC NĂNG CŨ (PROFILE & MODAL) ---
  const sessionRoleId = readSessionUser().role_id;
  const [overviewCreate, setOverviewCreate] = useState({
    email: "", password: "", surname: "", middle_name: "", first_name: "", gender: "1", birth_date: "", hometown: "", generation: "1", clan_id: "",
  });
  const [overviewCreateMsg, setOverviewCreateMsg] = useState("");
  const [overviewCreateSaving, setOverviewCreateSaving] = useState(false);

  const [managerMeta, setManagerMeta] = useState({ person_id: null, role_id: null });
  const [overviewAccount, setOverviewAccount] = useState({
    email: "", surname: "", middle_name: "", first_name: "", hometown: "", generation: "",
  });
  const [overviewPassword, setOverviewPassword] = useState({ current: "", next: "", confirm: "" });
  const [overviewAccountMsg, setOverviewAccountMsg] = useState("");
  const [overviewAccountLoading, setOverviewAccountLoading] = useState(false);
  const [overviewAccountSaving, setOverviewAccountSaving] = useState(false);
  const [overviewPasswordSaving, setOverviewPasswordSaving] = useState(false);

  const [memberEditId, setMemberEditId] = useState(null);
  const [memberEditLoading, setMemberEditLoading] = useState(false);
  const [memberEditSaving, setMemberEditSaving] = useState(false);
  const [memberEditMsg, setMemberEditMsg] = useState("");
  const [memberEditForm, setMemberEditForm] = useState(() => emptyMemberEditForm());

  // --- STATE TRANG LINEAGE ---
  const [formData, setFormData] = useState({
    first_name: "", surname: "", middle_name: "", display_name: "", gender: "Nam", birth_date: "", hometown: "", clan_id: 1, generation: 1,
  });
  const [linkData, setLinkData] = useState({ person_id: "", father_id: "", mother_id: "", spouse_id: "" });
  const [maritalStatus, setMaritalStatus] = useState("Độc thân");

  // --- STATE TRANG PHÂN CÔNG CÔNG VIỆC ---
  const [taskData, setTaskData] = useState({ member_id: "", title: "", description: "", due_date: "" });
  const [allTasks, setAllTasks] = useState([]);

  // --- LOGIC LẤY DỮ LIỆU ---
  const loadAll = async () => {
    setError("");
    setLoading(true);
    try {
      const [statsData, membersData, pendingData, postsData, mediaData, tasksData] = await Promise.all([
        getStats(),
        getMembers(),
        getPendingUsers(),
        getPendingPosts(),
        getMediaAPI(),
        getTasksAPI().catch(() => []), 
      ]);
      setStats(statsData);
      setMembers(membersData);
      setPending(pendingData);
      setPendingPosts(postsData);
      setMediaList(mediaData);
      setAllTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (e) {
      setError(e?.message || "Không thể tải dữ liệu manager");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // --- LOGIC PROFILE QUẢN LÝ ---
  const loadOverviewProfile = useCallback(async () => {
    setOverviewAccountLoading(true);
    setOverviewAccountMsg("");
    try {
      const dash = await getMemberDashboard();
      const p = dash.profile || {};
      setManagerMeta({ person_id: p.person_id ?? null, role_id: p.role_id ?? null });
      setOverviewAccount({
        email: p.email || "", surname: p.surname ?? "", middle_name: p.middle_name ?? "",
        first_name: p.first_name ?? "", hometown: p.hometown || "", generation: p.generation ?? "",
      });
    } catch (e) {
      setOverviewAccountMsg(e?.message || "Không tải được hồ sơ cá nhân.");
      setManagerMeta({ person_id: null, role_id: readSessionUser().role_id ?? null });
    } finally {
      setOverviewAccountLoading(false);
    }
  }, []);

  useEffect(() => { if (activeSection === "overview") loadOverviewProfile(); }, [activeSection, loadOverviewProfile]);

  // --- LOGIC MODAL CHỈNH SỬA THÀNH VIÊN ---
  useEffect(() => {
    if (!memberEditId) { setMemberEditForm(emptyMemberEditForm()); return; }
    let cancelled = false;
    (async () => {
      setMemberEditLoading(true); setMemberEditMsg("");
      try {
        const data = await getMemberDetail(memberEditId);
        if (!cancelled) setMemberEditForm(mapMemberToForm(data.member));
      } catch (e) {
        if (!cancelled) setMemberEditMsg(e?.message || "Không tải được chi tiết thành viên");
      } finally {
        if (!cancelled) setMemberEditLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberEditId]);

  const saveMemberEdit = async () => {
    if (!memberEditId) return;
    setMemberEditSaving(true); setMemberEditMsg("");
    try {
      const f = memberEditForm;
      const payload = {
        email: f.email.trim(), status: f.status, surname: f.surname, middle_name: f.middle_name, first_name: f.first_name,
        gender: f.gender === "" ? null : Number(f.gender), birth_date: f.birth_date || null, death_date: f.death_date || null,
        is_living: f.is_living === "1", generation: Number(f.generation) || 1, branch: f.branch.trim() === "" ? null : Number(f.branch),
        hometown: f.hometown, address: f.address, phone: f.phone, people_email: f.people_email, zalo: f.zalo, facebook: f.facebook,
        avatar_url: f.avatar_url.trim() === "" ? null : f.avatar_url.trim(), bio: f.bio, note: f.note,
        children_ids: f.children_ids.trim() === "" ? [] : f.children_ids.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)),
      };
      if (f.new_password.trim()) payload.new_password = f.new_password.trim();
      if (sessionRoleId === 1) { payload.role_id = Number(f.role_id); if (f.clan_id.trim() !== "") payload.clan_id = Number(f.clan_id); }
      const fid = f.family_id.trim(); const sid = f.spouse_id.trim();
      if (fid !== "") payload.family_id = Number(fid); if (sid !== "") payload.spouse_id = Number(sid);
      const pf = f.parent_father_id.trim(); const pm = f.parent_mother_id.trim();
      if (pf !== "" || pm !== "") { payload.parent_father_id = pf === "" ? null : Number(pf); payload.parent_mother_id = pm === "" ? null : Number(pm); }
      
      const res = await updateMemberByManager(memberEditId, payload);
      setMemberEditMsg("Đã lưu thành công.");
      setMemberEditForm(mapMemberToForm(res.member));
      await loadAll();
    } catch (e) {
      setMemberEditMsg(e?.message || "Không thể lưu");
    } finally {
      setMemberEditSaving(false);
    }
  };

  const submitOverviewCreateMember = async () => {
    setOverviewCreateMsg(""); setOverviewCreateSaving(true);
    try {
      const payload = {
        email: overviewCreate.email.trim(), password: overviewCreate.password, surname: overviewCreate.surname.trim(), middle_name: overviewCreate.middle_name.trim(),
        first_name: overviewCreate.first_name.trim(), gender: overviewCreate.gender === "" ? null : Number(overviewCreate.gender), birth_date: overviewCreate.birth_date.trim() || null,
        hometown: overviewCreate.hometown.trim(), generation: overviewCreate.generation.trim() === "" ? 1 : Number(overviewCreate.generation),
      };
      if (sessionRoleId === 1) {
        const cid = Number(overviewCreate.clan_id);
        if (!Number.isFinite(cid)) return setOverviewCreateMsg("Admin cần nhập mã dòng họ (clan_id).");
        payload.clan_id = cid;
      }
      await createMember(payload);
      setOverviewCreateMsg("Đã tạo thành viên và kích hoạt tài khoản.");
      setOverviewCreate((p) => ({ ...p, email: "", password: "", surname: "", middle_name: "", first_name: "", birth_date: "", hometown: "" }));
      await loadAll();
    } catch (e) {
      setOverviewCreateMsg(e?.message || "Không thể tạo thành viên");
    } finally {
      setOverviewCreateSaving(false);
    }
  };

  const saveOverviewAccount = async () => {
    setOverviewAccountMsg("");
    if (managerMeta.person_id == null) return setOverviewAccountMsg("Tài khoản chưa liên kết hồ sơ người.");
    const genNum = String(overviewAccount.generation).trim() === "" ? null : Number(String(overviewAccount.generation).trim());
    setOverviewAccountSaving(true);
    try {
      await updateMemberProfile({ surname: overviewAccount.surname, middle_name: overviewAccount.middle_name, first_name: overviewAccount.first_name, email: overviewAccount.email, hometown: overviewAccount.hometown, generation: genNum });
      setOverviewAccountMsg("Đã cập nhật thông tin tài khoản.");
      await loadOverviewProfile();
    } catch (e) {
      setOverviewAccountMsg(e?.message || "Không thể lưu hồ sơ");
    } finally {
      setOverviewAccountSaving(false);
    }
  };

  const saveOverviewPassword = async () => {
    setOverviewAccountMsg("");
    if (overviewPassword.next !== overviewPassword.confirm) return setOverviewAccountMsg("Mật khẩu không khớp.");
    setOverviewPasswordSaving(true);
    try {
      await changeMemberPassword({ current_password: overviewPassword.current, new_password: overviewPassword.next });
      setOverviewPassword({ current: "", next: "", confirm: "" });
      setOverviewAccountMsg("Đã đổi mật khẩu thành công.");
    } catch (e) {
      setOverviewAccountMsg(e?.message || "Không thể đổi mật khẩu");
    } finally {
      setOverviewPasswordSaving(false);
    }
  };

  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login", { replace: true }); };

  // --- API HANDLERS KHÁC ---
  const doApprove = async (id) => { await approveUserAPI(id); await loadAll(); };
  const doReject = async (id) => { await rejectUserAPI(id); await loadAll(); };
  const doApprovePost = async (id) => { await approvePostAPI(id); await loadAll(); };
  const doRejectPost = async (id) => { await rejectPostAPI(id); await loadAll(); };

  // --- LOGIC LINEAGE MỚI ---
  const handleCreatePerson = async (e) => {
    e.preventDefault();
    try {
      await createPersonAPI(formData);
      alert("Đã tạo thành viên mới thành công!");
      setFormData({ surname: "", middle_name: "", first_name: "", display_name: "", gender: "Nam", birth_date: "", hometown: "", clan_id: 1, generation: 1 });
      loadAll();
    } catch (err) { alert("Lỗi: " + err.message); }
  };

  const handleLinkRelations = async () => {
    if (!linkData.person_id) return alert("Vui lòng chọn một người cần thiết lập!");
    try {
      await linkRelationsAPI(linkData);
      alert("Liên kết thành công!");
      loadAll();
    } catch (err) { alert("Lỗi: " + err.message); }
  };

  // --- LOGIC PHÂN CÔNG ---
  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!taskData.member_id) return alert("Vui lòng chọn thành viên!");
    try {
      await assignTaskAPI(taskData);
      alert("Đã giao việc thành công!");
      setTaskData({ member_id: "", title: "", description: "", due_date: "" }); 
      loadAll(); 
    } catch (err) { alert("Lỗi phân công: " + err.message); }
  };

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = activeSection === "approvals" ? pending : members;
    return source.filter((u) => {
      const fullName = `${u.first_name ?? ""} ${u.surname ?? ""}`.trim().toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      return !q || fullName.includes(q) || email.includes(q);
    });
  }, [activeSection, members, pending, search]);

  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case "overview": return "Tổng quan";
      case "members": return "Danh sách thành viên";
      case "approvals": return "Duyệt tài khoản";
      case "lineage": return "Lineage Management";
      case "tasks": return "Phân công công việc"; 
      case "relationships": return "Duy trì mối quan hệ";
      case "moderation": return "Content Moderation";
      case "media": return "Media Management";
      default: return "Quản lý";
    }
  }, [activeSection]);

  // --- RENDER GIAO DIỆN ---
  return (
    <div className="mgr-shell">
      <aside className="mgr-sidebar">
        <div className="mgr-brand">
          <div className="mgr-logo" aria-hidden="true">G</div>
          <div className="mgr-brandText">
            <div className="mgr-brandTitle">Gia Phả</div>
            <div className="mgr-brandSub">Quản trị gia phả</div>
          </div>
        </div>

        <div className="mgr-sidebarBlock">
          <div className="mgr-sidebarHeading">Thống kê gia phả</div>
          <div className="mgr-miniStats">
            <div className="mgr-miniStat">
              <div className="mgr-miniValue">{stats.total_members}</div>
              <div className="mgr-miniLabel">Thành viên</div>
            </div>
            <div className="mgr-miniStat">
              <div className="mgr-miniValue">{stats.total_managers}</div>
              <div className="mgr-miniLabel">Manager</div>
            </div>
            <div className="mgr-miniStat">
              <div className="mgr-miniValue">{stats.total_pending}</div>
              <div className="mgr-miniLabel">Chờ duyệt</div>
            </div>
          </div>
        </div>

        <nav className="mgr-nav" aria-label="Điều hướng quản trị">
          <button className={`mgr-navItem ${activeSection === "overview" ? "isActive" : ""}`} onClick={() => setActiveSection("overview")}>Tổng quan</button>
          <button className={`mgr-navItem ${activeSection === "members" ? "isActive" : ""}`} onClick={() => setActiveSection("members")}>Danh sách</button>
          <button className={`mgr-navItem ${activeSection === "approvals" ? "isActive" : ""}`} onClick={() => setActiveSection("approvals")}>Duyệt tài khoản</button>
          <div className="mgr-navDivider" />
          <button className={`mgr-navItem ${activeSection === "lineage" ? "isActive" : ""}`} onClick={() => setActiveSection("lineage")}>Lineage Management</button>
          <button className={`mgr-navItem ${activeSection === "tasks" ? "isActive" : ""}`} onClick={() => setActiveSection("tasks")}>Phân công công việc</button>
          <button className={`mgr-navItem ${activeSection === "relationships" ? "isActive" : ""}`} onClick={() => setActiveSection("relationships")}>Duy trì mối quan hệ</button>
          <button className={`mgr-navItem ${activeSection === "moderation" ? "isActive" : ""}`} onClick={() => setActiveSection("moderation")}>Content Moderation</button>
          <button className={`mgr-navItem ${activeSection === "media" ? "isActive" : ""}`} onClick={() => setActiveSection("media")}>Media Management</button>
        </nav>
      </aside>

      <main className="mgr-main">
        <div className="mgr-topbar">
          <div className="mgr-search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm thành viên…" aria-label="Tìm kiếm thành viên" />
          </div>
          <div className="mgr-topActions">
            <button className="mgr-pill" type="button">Trẻ</button>
            <button className="mgr-pill" type="button">Người già</button>
            <button className="mgr-iconBtn" type="button" onClick={loadAll} title="Tải lại">↻</button>
            <button className="mgr-btnGhost mgr-logoutBtn" type="button" onClick={logout} title="Đăng xuất">Đăng xuất</button>
          </div>
        </div>

        <section className="mgr-hero" aria-label="Banner">
          <div className="mgr-heroOverlay" />
          <div className="mgr-heroContent">
            <div className="mgr-heroKicker">Phần mềm Gia phả AI</div>
            <div className="mgr-heroTitle">Bảng điều khiển Manager</div>
            <div className="mgr-heroDesc">Quản lý dữ liệu gia phả, mối quan hệ nhiều thế hệ, kiểm duyệt nội dung và hồ sơ đa phương tiện.</div>
            <div className="mgr-heroBadges">
              <span className="mgr-badge">{stats.total_members} thành viên</span>
              <span className="mgr-badge">{stats.total_pending} chờ duyệt</span>
              <span className="mgr-badge">JWT</span>
            </div>
          </div>
        </section>

        <section className="mgr-sectionHeader">
          <h2>{sectionTitle}</h2>
          {error ? <div className="mgr-alert">{error}</div> : null}
          {loading ? <div className="mgr-subtle">Đang tải dữ liệu…</div> : null}
        </section>

        {/* --- TAB TỔNG QUAN --- */}
        {activeSection === "overview" && (
          <section className="mgr-grid2">
            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="mgr-panelTitle" style={{ fontSize: '1.1rem', color: 'var(--mgr-primary)' }}>Quản lý dữ liệu gia phả (Lineage)</div>
                <div className="mgr-panelText">Tạo mới, cập nhật và liên kết các thành viên để xây dựng cây gia phả kỹ thuật số.</div>
              </div>
              <div className="mgr-panelActions" style={{ marginTop: '20px' }}>
                <button className="mgr-btnPrimary" type="button" onClick={() => setActiveSection("lineage")}>Tạo thành viên mới</button>
                <button className="mgr-btnGhost" type="button" onClick={() => setActiveSection("lineage")}>Liên kết quan hệ</button>
              </div>
            </div>

            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="mgr-panelTitle" style={{ fontSize: '1.1rem', color: '#ff9800' }}>Content Moderation</div>
                <div className="mgr-panelText">Kiểm soát thông tin, hình ảnh và tư liệu do các thành viên đóng góp.</div>
              </div>
              <div className="mgr-panelActions" style={{ marginTop: '20px' }}>
                <button className="mgr-btnPrimary" type="button" style={{ background: '#ff9800' }} onClick={() => setActiveSection("moderation")}>Hàng chờ duyệt ({pendingPosts.length})</button>
              </div>
            </div>

            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="mgr-panelTitle" style={{ fontSize: '1.1rem', color: '#8b5cf6' }}>Phân công công việc</div>
                <div className="mgr-panelText">Giao nhiệm vụ (chuẩn bị giỗ họ, thu họ phí, dọn dẹp từ đường...) cho các thành viên.</div>
              </div>
              <div className="mgr-panelActions" style={{ marginTop: '20px' }}>
                <button className="mgr-btnPrimary" type="button" style={{ background: '#8b5cf6' }} onClick={() => setActiveSection("tasks")}>Giao việc mới</button>
              </div>
            </div>

            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="mgr-panelTitle" style={{ fontSize: '1.1rem', color: '#2f9bff' }}>Media Management</div>
                <div className="mgr-panelText">Lưu trữ và tổ chức hồ sơ số hóa, kho hình ảnh truyền thống và lịch sử.</div>
              </div>
              <div className="mgr-panelActions" style={{ marginTop: '20px' }}>
                <button className="mgr-btnPrimary" type="button" style={{ background: '#2f9bff' }} onClick={() => setActiveSection("media")}>Mở Thư viện Media</button>
              </div>
            </div>

            <div className="mgr-panel mgr-panel--wide">
              <div className="mgr-panelTitle">Tạo tài khoản đăng nhập cho thành viên mới</div>
              <div className="mgr-panelText">Tạo tài khoản để thành viên đăng nhập. Sau đó, vào Lineage Management để tạo hồ sơ và liên kết phả hệ.</div>
              <div className="mgr-overviewFormGrid" style={{ marginTop: '15px' }}>
                <input className="mgr-field" type="email" placeholder="Email đăng nhập *" value={overviewCreate.email} onChange={(e) => setOverviewCreate((p) => ({ ...p, email: e.target.value }))} autoComplete="off" />
                <input className="mgr-field" type="password" placeholder="Mật khẩu (≥6 ký tự) *" value={overviewCreate.password} onChange={(e) => setOverviewCreate((p) => ({ ...p, password: e.target.value }))} autoComplete="new-password" />
                <input className="mgr-field" placeholder="Họ *" value={overviewCreate.surname} onChange={(e) => setOverviewCreate((p) => ({ ...p, surname: e.target.value }))} />
                <input className="mgr-field" placeholder="Tên đệm" value={overviewCreate.middle_name} onChange={(e) => setOverviewCreate((p) => ({ ...p, middle_name: e.target.value }))} />
                <input className="mgr-field" placeholder="Tên *" value={overviewCreate.first_name} onChange={(e) => setOverviewCreate((p) => ({ ...p, first_name: e.target.value }))} />
                <select className="mgr-field" value={overviewCreate.gender} onChange={(e) => setOverviewCreate((p) => ({ ...p, gender: e.target.value }))} >
                  <option value="1">Nam</option>
                  <option value="2">Nữ</option>
                  <option value="">Không khai báo</option>
                </select>
                <input className="mgr-field" type="date" value={overviewCreate.birth_date} onChange={(e) => setOverviewCreate((p) => ({ ...p, birth_date: e.target.value }))} />
                <input className="mgr-field" type="number" min={1} placeholder="Đời (generation)" value={overviewCreate.generation} onChange={(e) => setOverviewCreate((p) => ({ ...p, generation: e.target.value }))} />
                <input className="mgr-field" style={{ gridColumn: sessionRoleId === 1 ? "span 1" : "1 / -1" }} placeholder="Quê quán" value={overviewCreate.hometown} onChange={(e) => setOverviewCreate((p) => ({ ...p, hometown: e.target.value }))} />
                {sessionRoleId === 1 && (
                  <input className="mgr-field" type="number" placeholder="Mã dòng họ (clan_id) *" value={overviewCreate.clan_id} onChange={(e) => setOverviewCreate((p) => ({ ...p, clan_id: e.target.value }))} />
                )}
              </div>
              {overviewCreateMsg && <div className={overviewCreateMsg.startsWith("Đã ") ? "mgr-subtle" : "mgr-alert"} style={{ marginTop: 10 }}>{overviewCreateMsg}</div>}
              <div className="mgr-panelActions" style={{ marginTop: 12 }}>
                <button className="mgr-btnPrimary" type="button" disabled={overviewCreateSaving} onClick={submitOverviewCreateMember}>
                  {overviewCreateSaving ? "Đang tạo…" : "Tạo tài khoản"}
                </button>
              </div>
            </div>

            <div className="mgr-panel mgr-panel--wide">
              <div className="mgr-panelTitle">Thông tin tài khoản Manager của bạn</div>
              <div className="mgr-panelText">Chỉnh họ tên, email, quê quán. Đổi mật khẩu cần nhập đúng mật khẩu hiện tại.</div>
              {overviewAccountLoading && <div className="mgr-subtle">Đang tải hồ sơ…</div>}
              <div className="mgr-overviewFormGrid" style={{ marginTop: 15 }}>
                <input className="mgr-field" type="email" placeholder="Email" value={overviewAccount.email} onChange={(e) => setOverviewAccount((p) => ({ ...p, email: e.target.value }))} disabled={managerMeta.person_id == null} />
                <input className="mgr-field" placeholder="Họ" value={overviewAccount.surname} onChange={(e) => setOverviewAccount((p) => ({ ...p, surname: e.target.value }))} disabled={managerMeta.person_id == null} />
                <input className="mgr-field" placeholder="Tên đệm" value={overviewAccount.middle_name} onChange={(e) => setOverviewAccount((p) => ({ ...p, middle_name: e.target.value }))} disabled={managerMeta.person_id == null} />
                <input className="mgr-field" placeholder="Tên" value={overviewAccount.first_name} onChange={(e) => setOverviewAccount((p) => ({ ...p, first_name: e.target.value }))} disabled={managerMeta.person_id == null} />
                <input className="mgr-field" placeholder="Quê quán" value={overviewAccount.hometown} onChange={(e) => setOverviewAccount((p) => ({ ...p, hometown: e.target.value }))} disabled={managerMeta.person_id == null} />
                <input className="mgr-field" type="number" min={1} placeholder="Đời" value={overviewAccount.generation} onChange={(e) => setOverviewAccount((p) => ({ ...p, generation: e.target.value }))} disabled={managerMeta.person_id == null} />
              </div>
              <div className="mgr-panelActions">
                <button className="mgr-btnPrimary" type="button" disabled={overviewAccountSaving || managerMeta.person_id == null} onClick={saveOverviewAccount}>
                  {overviewAccountSaving ? "Đang lưu…" : "Lưu hồ sơ"}
                </button>
              </div>

              <div className="mgr-panelTitle" style={{ marginTop: 25, fontSize: "1rem" }}>Đổi mật khẩu</div>
              <div className="mgr-overviewFormGrid" style={{ marginTop: 10 }}>
                <input className="mgr-field" type="password" placeholder="Mật khẩu hiện tại" value={overviewPassword.current} onChange={(e) => setOverviewPassword((p) => ({ ...p, current: e.target.value }))} autoComplete="current-password" />
                <input className="mgr-field" type="password" placeholder="Mật khẩu mới" value={overviewPassword.next} onChange={(e) => setOverviewPassword((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" />
                <input className="mgr-field" type="password" placeholder="Nhập lại mật khẩu mới" value={overviewPassword.confirm} onChange={(e) => setOverviewPassword((p) => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" />
              </div>
              <div className="mgr-panelActions">
                <button className="mgr-btnPrimary" type="button" disabled={overviewPasswordSaving} onClick={saveOverviewPassword}>
                  {overviewPasswordSaving ? "Đang đổi…" : "Đổi mật khẩu"}
                </button>
              </div>
              {overviewAccountMsg && <div className={overviewAccountMsg.includes("Đã") ? "mgr-subtle" : "mgr-alert"} style={{ marginTop: 10 }}>{overviewAccountMsg}</div>}
            </div>
          </section>
        )}

        {/* --- TAB DANH SÁCH & DUYỆT TÀI KHOẢN --- */}
        {(activeSection === "members" || activeSection === "approvals") && (
          <section>
            <div className="mgr-listHeader">
              <div className="mgr-listTitle">
                {activeSection === "approvals" ? `Tài khoản chờ duyệt (${filteredMembers.length})` : `Tất cả thành viên (${filteredMembers.length})`}
              </div>
              <div className="mgr-listHint">
                {activeSection === "approvals" ? "Duyệt/từ chối tài khoản (dữ liệu từ backend)." : "Nhấn vào một thẻ để mở form chỉnh sửa toàn bộ hồ sơ, tài khoản và quan hệ."}
              </div>
            </div>

            <div className="mgr-cardGrid">
              {filteredMembers.map((user) => (
                <div
                  className={`mgr-card ${activeSection === "members" ? "mgr-card--clickable" : ""}`}
                  key={user.account_id}
                  onClick={() => { if (activeSection === "members") setMemberEditId(user.account_id); }}
                >
                  <div className="mgr-cardCover">
                    <div className="mgr-dot" aria-hidden="true" />
                    <div className="mgr-chip">Đời {user.generation ?? "—"}</div>
                  </div>

                  <div className="mgr-cardBody">
                    <div className="mgr-cardName">{user.first_name} {user.surname}</div>
                    <div className="mgr-cardMeta">{user.email}</div>

                    <div className="mgr-cardRows">
                      <div className="mgr-row"><span className="mgr-rowKey">Clan</span><span className="mgr-rowVal">{user.clan_id || "—"}</span></div>
                      <div className="mgr-row"><span className="mgr-rowKey">Năm sinh</span><span className="mgr-rowVal">{user.birth_date ? new Date(user.birth_date).getFullYear() : "—"}</span></div>
                      <div className="mgr-row"><span className="mgr-rowKey">Vai trò</span><span className="mgr-rowVal">{user.role_id === 2 ? "Manager" : user.role_id === 3 ? "Member" : `Role ${user.role_id}`}</span></div>
                      <div className="mgr-row"><span className="mgr-rowKey">Trạng thái</span><span className="mgr-rowVal">{user.status || "—"}</span></div>
                    </div>

                    {activeSection === "approvals" && (
                      <div className="mgr-cardActions">
                        <button className="mgr-btnOk" onClick={(e) => { e.stopPropagation(); doApprove(user.account_id); }}>Duyệt</button>
                        <button className="mgr-btnDanger" onClick={(e) => { e.stopPropagation(); doReject(user.account_id); }}>Từ chối</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!loading && filteredMembers.length === 0 && <div className="mgr-empty">Không tìm thấy dữ liệu</div>}
            </div>
          </section>
        )}

        {/* --- TAB LINEAGE MANAGEMENT --- */}
        {activeSection === "lineage" && (
          <section className="mgr-grid2">
            <div className="mgr-panel">
              <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: 'var(--mgr-primary)' }}>1. Thêm thành viên mới</div>
              <div className="mgr-panelText">Điền thông tin cá nhân cơ bản để khởi tạo hồ sơ (Bảng People).</div>
              
              <form style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }} onSubmit={handleCreatePerson}>
                <div>
                  <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Họ và Tên khai sinh <span style={{color: 'red'}}>*</span></label>
                  <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <input className="mgr-search" style={{ flex: '1.2', minWidth: '0' }} placeholder="Họ" value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} required />
                    <input className="mgr-search" style={{ flex: '1', minWidth: '0' }} placeholder="Tên đệm" value={formData.middle_name} onChange={e => setFormData({...formData, middle_name: e.target.value})} />
                    <input className="mgr-search" style={{ flex: '1.2', minWidth: '0' }} placeholder="Tên" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required />
                  </div>
                </div>
                
                <div>
                  <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Tên hiển thị / Tên thường gọi</label>
                  <input className="mgr-search" style={{ width: '100%' }} placeholder="VD: Cụ Trưởng, Chú Hai..." value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Giới tính <span style={{color: 'red'}}>*</span></label>
                    <select className="mgr-search" style={{ width: '100%', color: 'var(--mgr-text)' }} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>
                  <div>
                    <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Ngày sinh</label>
                    <input className="mgr-search" type="date" style={{ width: '100%' }} value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Quê quán / Nơi sinh</label>
                  <input className="mgr-search" style={{ width: '100%' }} placeholder="VD: Hải Lăng, Quảng Trị" value={formData.hometown} onChange={e => setFormData({...formData, hometown: e.target.value})} />
                </div>

                <div style={{ marginTop: '10px', paddingTop: '15px', borderTop: '1px solid var(--mgr-border)' }}>
                  <button className="mgr-btnPrimary" type="submit" style={{ width: '100%', padding: '12px', fontSize: '1rem' }}>+ Lưu thành viên vào danh sách</button>
                </div>
              </form>
            </div>

            <div className="mgr-panel" style={{ backgroundColor: '#fafbfc' }}>
              <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: 'var(--mgr-primary-2)' }}>2. Xây dựng cây (Build Tree)</div>
              <div className="mgr-panelText">Chỉ định huyết thống và hôn nhân cho thành viên.</div>
              
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--mgr-border)', boxShadow: 'var(--mgr-shadow-soft)' }}>
                  <label className="mgr-rowKey" style={{ display: 'block', marginBottom: '8px', color: '#1d2b44' }}>👉 Chọn hồ sơ cần thiết lập:</label>
                  <select className="mgr-search" style={{ width: '100%', border: '2px solid var(--mgr-primary-2)' }} value={linkData.person_id} onChange={e => setLinkData({...linkData, person_id: e.target.value})}>
                    <option value="">-- Click để chọn thành viên --</option>
                    {members.map(m => (
                      <option key={m.account_id} value={m.account_id}>{m.surname} {m.middle_name || ""} {m.first_name} (ID: {m.account_id})</option>
                    ))}
                  </select>
                </div>

                <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--mgr-border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                        <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>👤 Người Cha:</label>
                        <select className="mgr-search" style={{ width: '100%', fontSize: '0.9rem' }} value={linkData.father_id} onChange={e => setLinkData({...linkData, father_id: e.target.value})}>
                          <option value="">-- Khuyết / Chưa rõ --</option>
                          {members.filter(m => m.gender === 'Nam' || m.gender === '1').map(m => (
                            <option key={m.account_id} value={m.account_id}>{m.surname} {m.middle_name || ""} {m.first_name}</option>
                          ))}
                        </select>
                    </div>
                    <div>
                        <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>👩 Người Mẹ:</label>
                        <select className="mgr-search" style={{ width: '100%', fontSize: '0.9rem' }} value={linkData.mother_id} onChange={e => setLinkData({...linkData, mother_id: e.target.value})}>
                          <option value="">-- Khuyết / Chưa rõ --</option>
                          {members.filter(m => m.gender === 'Nữ' || m.gender === '2').map(m => (
                            <option key={m.account_id} value={m.account_id}>{m.surname} {m.middle_name || ""} {m.first_name}</option>
                          ))}
                        </select>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--mgr-border)' }}>
                  <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>💍 Tình trạng hôn nhân:</label>
                  <select className="mgr-search" style={{ width: '100%', marginBottom: '10px' }} value={maritalStatus} 
                    onChange={e => {
                      setMaritalStatus(e.target.value);
                      if(e.target.value === "Độc thân") setLinkData({...linkData, spouse_id: ""});
                    }}>
                    <option value="Độc thân">Độc thân</option>
                    <option value="Đã kết hôn">Đã kết hôn</option>
                  </select>

                  {maritalStatus === "Đã kết hôn" && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--mgr-border)' }}>
                      <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px', color: '#e83e8c' }}>Chọn Vợ / Chồng:</label>
                      <select className="mgr-search" style={{ width: '100%' }} value={linkData.spouse_id} onChange={e => setLinkData({...linkData, spouse_id: e.target.value})}>
                        <option value="">-- Chọn hồ sơ Vợ/Chồng --</option>
                        {members.map(m => (
                          <option key={m.account_id} value={m.account_id}>{m.surname} {m.middle_name || ""} {m.first_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <button className="mgr-btnPrimary" type="button" style={{ padding: '12px', fontSize: '1rem', background: 'linear-gradient(135deg, #2f9bff, #007bff)' }} onClick={handleLinkRelations}>
                   🔗 Xác nhận Lưu Liên kết
                </button>
              </div>
            </div>
          </section>
        )}

        {/* --- TAB PHÂN CÔNG CÔNG VIỆC --- */}
        {activeSection === "tasks" && (
          <section className="mgr-grid2">
              <div className="mgr-panel">
                  <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: '#8b5cf6' }}>Giao việc cho thành viên</div>
                  <div className="mgr-panelText">Phân công chuẩn bị giỗ họ, thu quỹ, dọn dẹp từ đường...</div>
                  
                  <form style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }} onSubmit={handleAssignTask}>
                      <div>
                        <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>Chọn người thực hiện <span style={{color: 'red'}}>*</span></label>
                        <select className="mgr-search" style={{ width: '100%' }} value={taskData.member_id} onChange={e => setTaskData({...taskData, member_id: e.target.value})} required>
                            <option value="">-- Click để chọn thành viên --</option>
                            {members.map(m => <option key={m.account_id} value={m.account_id}>{m.surname} {m.middle_name || ""} {m.first_name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>Tiêu đề công việc <span style={{color: 'red'}}>*</span></label>
                        <input className="mgr-search" style={{ width: '100%' }} placeholder="VD: Sắm lễ cúng Rằm tháng 7" value={taskData.title} onChange={e => setTaskData({...taskData, title: e.target.value})} required />
                      </div>

                      <div>
                        <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>Mô tả chi tiết</label>
                        <textarea className="mgr-search" style={{ width: '100%', height: '80px', resize: 'vertical' }} placeholder="Ghi chú cụ thể những việc cần làm..." value={taskData.description} onChange={e => setTaskData({...taskData, description: e.target.value})} />
                      </div>

                      <div>
                        <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>Hạn chót (Due Date)</label>
                        <input className="mgr-search" type="date" style={{ width: '100%' }} value={taskData.due_date} onChange={e => setTaskData({...taskData, due_date: e.target.value})} />
                      </div>

                      <button className="mgr-btnPrimary" type="submit" style={{ padding: '12px', background: '#8b5cf6', fontSize: '1rem' }}>
                        🚀 Phân công ngay
                      </button>
                  </form>
              </div>

              <div className="mgr-panel" style={{ backgroundColor: '#fafbfc' }}>
                  <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: '#1d2b44' }}>Lịch sử phân công</div>
                  <div className="mgr-panelText">Theo dõi tiến độ các công việc đã giao.</div>
                  
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
                      {allTasks.length === 0 ? (
                        <div className="mgr-empty" style={{ padding: '30px', background: '#fff' }}>Chưa có công việc nào được giao.</div>
                      ) : (
                        allTasks.map(t => (
                            <div key={t.id} style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--mgr-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#1d2b44' }}>{t.title}</div>
                                  <span style={{ padding: '4px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold', background: t.status === 'pending' ? '#fff3cd' : '#d4edda', color: t.status === 'pending' ? '#856404' : '#155724' }}>
                                    {t.status === 'pending' ? 'Đang chờ' : 'Đã xong'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--mgr-muted)' }}>
                                  👤 Người nhận: <span style={{ fontWeight: '600' }}>{t.surname} {t.first_name}</span>
                                </div>
                                {t.due_date && (
                                  <div style={{ fontSize: '0.85rem', color: '#dc3545' }}>
                                    ⏰ Hạn chót: {new Date(t.due_date).toLocaleDateString('vi-VN')}
                                  </div>
                                )}
                            </div>
                        ))
                      )}
                  </div>
              </div>
          </section>
        )}

        {/* --- TAB DUY TRÌ MỐI QUAN HỆ --- */}
        {activeSection === "relationships" && (
          <section className="mgr-grid2">
            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', height: '650px' }}>
              <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: '#e83e8c' }}>Danh bạ Gia tộc</div>
              <div className="mgr-panelText">Chọn một thành viên để kiểm tra và điều chỉnh huyết thống.</div>
              
              <div style={{ marginTop: '15px', flex: 1, overflowY: 'auto', border: '1px solid var(--mgr-border)', borderRadius: '8px', padding: '10px', background: '#fff' }}>
                {filteredMembers.length === 0 ? (
                  <div className="mgr-empty" style={{ padding: '20px' }}>Không có dữ liệu</div>
                ) : (
                  filteredMembers.map(m => (
                    <div key={m.account_id} 
                         onClick={() => setSelectedRelPerson(m)}
                         style={{ 
                           padding: '12px 15px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                           backgroundColor: selectedRelPerson?.account_id === m.account_id ? '#fdf2f8' : 'transparent',
                           borderLeft: selectedRelPerson?.account_id === m.account_id ? '4px solid #e83e8c' : '4px solid transparent',
                           borderRadius: '4px', transition: 'all 0.2s', marginBottom: '4px'
                         }}>
                      <div style={{ fontWeight: '600', color: selectedRelPerson?.account_id === m.account_id ? '#e83e8c' : '#1d2b44' }}>
                        {m.surname} {m.middle_name || ''} {m.first_name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--mgr-muted)', marginTop: '4px' }}>
                        Đời thứ {m.generation || '?'} • Giới tính: {m.gender == '1' ? 'Nam' : m.gender == '2' ? 'Nữ' : 'Chưa rõ'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mgr-panel" style={{ backgroundColor: '#fafbfc', height: '650px', overflowY: 'auto' }}>
              {!selectedRelPerson ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--mgr-muted)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '15px' }}>👨‍👩‍👧‍👦</div>
                  <h3 style={{ color: '#1d2b44' }}>Chưa chọn thành viên</h3>
                  <p>Vui lòng click chọn một người ở danh sách bên trái để xem Hồ sơ Quan hệ.</p>
                </div>
              ) : (
                <div>
                  <div style={{ textAlign: 'center', paddingBottom: '20px', borderBottom: '1px solid var(--mgr-border)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #e83e8c, #ff758c)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', margin: '0 auto 15px', boxShadow: '0 4px 10px rgba(232,62,140,0.3)' }}>
                      {selectedRelPerson.first_name?.charAt(0) || 'U'}
                    </div>
                    <h2 style={{ color: '#1d2b44', margin: '0 0 5px 0' }}>{selectedRelPerson.surname} {selectedRelPerson.first_name}</h2>
                    <div style={{ color: 'var(--mgr-muted)', fontSize: '0.9rem' }}>
                      ID Tài khoản: {selectedRelPerson.account_id} | Năm sinh: {selectedRelPerson.birth_date ? new Date(selectedRelPerson.birth_date).getFullYear() : 'Chưa cập nhật'}
                    </div>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ color: 'var(--mgr-primary)', marginBottom: '15px', fontSize: '1rem' }}>Mạng lưới gia đình hiện tại:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--mgr-muted)', marginBottom: '4px', fontWeight: 'bold' }}>NGƯỜI CHA</div>
                          <div style={{ color: '#1d2b44', fontWeight: '500' }}>{selectedRelPerson.father_id ? `ID Cha: ${selectedRelPerson.father_id}` : 'Khuyết / Chưa có liên kết'}</div>
                        </div>
                        <button className="mgr-btnGhost" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => { setActiveSection("lineage"); setLinkData({...linkData, person_id: selectedRelPerson.account_id}); }}>Sửa</button>
                      </div>

                      <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--mgr-muted)', marginBottom: '4px', fontWeight: 'bold' }}>NGƯỜI MẸ</div>
                          <div style={{ color: '#1d2b44', fontWeight: '500' }}>{selectedRelPerson.mother_id ? `ID Mẹ: ${selectedRelPerson.mother_id}` : 'Khuyết / Chưa có liên kết'}</div>
                        </div>
                        <button className="mgr-btnGhost" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => { setActiveSection("lineage"); setLinkData({...linkData, person_id: selectedRelPerson.account_id}); }}>Sửa</button>
                      </div>

                      <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--mgr-muted)', marginBottom: '4px', fontWeight: 'bold' }}>VỢ / CHỒNG</div>
                          <div style={{ color: '#1d2b44', fontWeight: '500' }}>{selectedRelPerson.spouse_id ? `ID Vợ/Chồng: ${selectedRelPerson.spouse_id}` : 'Độc thân / Chưa liên kết'}</div>
                        </div>
                        <button className="mgr-btnGhost" style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#dc3545', borderColor: '#f5c6cb' }} onClick={() => { setActiveSection("lineage"); setLinkData({...linkData, person_id: selectedRelPerson.account_id}); }}>Hủy liên kết</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* --- TAB CONTENT MODERATION --- */}
        {activeSection === "moderation" && (
          <section>
            <div className="mgr-listHeader">
              <div>
                <div className="mgr-listTitle" style={{ fontSize: '1.2rem', color: 'var(--mgr-primary)' }}>Bài viết chờ kiểm duyệt ({pendingPosts.length})</div>
                <div className="mgr-listHint" style={{ marginTop: '5px' }}>Đảm bảo các bài viết và hình ảnh do thành viên đóng góp phù hợp với văn hóa dòng họ.</div>
              </div>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {pendingPosts.map((post) => (
                <div key={post.post_id} className="mgr-panel" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <div style={{ width: '160px', height: '160px', borderRadius: '12px', backgroundColor: '#f0f4f8', border: '1px solid var(--mgr-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {post.image_url ? ( <img src={post.image_url} alt="Post content" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> ) : ( <div style={{ color: 'var(--mgr-muted)', textAlign: 'center', fontSize: '0.85rem', padding: '10px' }}>📷<br/>Chỉ có văn bản</div> )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '160px' }}>
                    <div style={{ borderBottom: '1px solid var(--mgr-border)', paddingBottom: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#1d2b44' }}>{post.author_name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--mgr-muted)' }}>{post.author_email}</div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--mgr-muted)', textAlign: 'right' }}>🕒 Đăng lúc:<br/>{new Date(post.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                    <div style={{ flex: 1, color: '#334155', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.content ? `"${post.content}"` : <span style={{ fontStyle: 'italic', color: 'var(--mgr-muted)' }}>[Không có nội dung văn bản]</span>}
                    </div>
                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                      <button className="mgr-btnPrimary" style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => doApprovePost(post.post_id)}>✅ Phê duyệt hiển thị</button>
                      <button className="mgr-btnGhost" style={{ padding: '8px 16px', fontSize: '0.9rem', color: '#dc3545', borderColor: '#f5c6cb', backgroundColor: '#fff' }} onClick={() => { if(window.confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) { doRejectPost(post.post_id); } }}>❌ Từ chối / Xóa</button>
                    </div>
                  </div>
                </div>
              ))}
              {!loading && pendingPosts.length === 0 && (
                <div className="mgr-empty" style={{ padding: '40px 20px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🎉</div>
                  <div style={{ fontSize: '1.1rem', color: '#1d2b44' }}>Tuyệt vời! Không có bài viết nào đang chờ duyệt.</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '5px' }}>Tất cả nội dung đóng góp đã được xử lý xong.</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* --- TAB MEDIA MANAGEMENT --- */}
        {activeSection === "media" && (
          <section>
            <div className="mgr-listHeader">
              <div>
                <div className="mgr-listTitle" style={{ fontSize: '1.2rem', color: '#2f9bff' }}>Kho lưu trữ số hóa (Media Gallery)</div>
                <div className="mgr-listHint" style={{ marginTop: '5px' }}>Quản lý hình ảnh lịch sử, gia phả cổ, và tài liệu được đóng góp từ các thành viên.</div>
              </div>
            </div>

            <div className="mgr-panel" style={{ marginTop: '20px', background: 'linear-gradient(to bottom right, #f8fafc, #e0f2fe)', border: '2px dashed #bae6fd', textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📸</div>
              <h3 style={{ color: '#0369a1', margin: '0 0 10px 0', fontSize: '1.3rem' }}>Số hóa hình ảnh & Tài liệu (AI OCR)</h3>
              <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '25px', maxWidth: '600px', margin: '0 auto 25px auto', lineHeight: '1.5' }}>
                Tải lên ảnh gia phả cũ hoặc tài liệu giấy. Hệ thống AI sẽ tự động phục hồi ảnh, tăng độ nét và trích xuất văn bản (OCR) để lưu trữ vĩnh viễn.
              </p>
              <input type="file" id="ai-upload" style={{ display: "none" }} accept="image/*" onChange={async (e) => { const file = e.target.files[0]; if (!file) return; alert("Đang chuẩn bị đẩy file '" + file.name + "' lên hệ thống AI Vision..."); }} />
              <label htmlFor="ai-upload" className="mgr-btnPrimary" style={{ display: "inline-block", cursor: "pointer", background: '#0284c7', padding: '12px 30px', borderRadius: '99px', fontSize: '1rem', boxShadow: '0 4px 10px rgba(2,132,199,0.3)' }}>
                ☁️ Nhấn để chọn tệp tải lên
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "25px", marginTop: "30px" }}>
              {mediaList.map((media) => (
                <div key={media.post_id} style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid var(--mgr-border)", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
                  <div style={{ height: "220px", width: "100%", position: "relative", backgroundColor: '#f1f5f9' }}>
                    <img src={media.image_url} alt="Media" style={{ width: "100%", height: "100%", objectFit: "cover", transition: 'transform 0.3s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'} />
                  </div>
                  <div style={{ padding: "15px", fontSize: "0.85rem", color: "var(--mgr-text-mute)" }}>
                    <div style={{ fontWeight: "bold", color: "#1d2b44", marginBottom: "6px", fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      👤 {media.author_name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                      <span>📅 {new Date(media.created_at).toLocaleDateString('vi-VN')}</span>
                      <button style={{ background: '#fee2e2', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '0.8rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 'bold' }} onClick={() => alert("Chức năng xóa ảnh đang phát triển")}>Xóa ảnh</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!loading && mediaList.length === 0 && (
              <div className="mgr-empty" style={{ padding: '60px 20px', marginTop: '20px', background: '#fff', borderRadius: '16px', border: '1px solid var(--mgr-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🖼️</div>
                <div style={{ fontSize: '1.2rem', color: '#1d2b44', fontWeight: '600' }}>Thư viện hiện đang trống</div>
                <div style={{ fontSize: '0.95rem', marginTop: '8px', color: 'var(--mgr-muted)' }}>Hãy là người đầu tiên tải lên các bức ảnh lịch sử, kỷ vật hoặc tài liệu của dòng họ.</div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* --- MODAL CHỈNH SỬA TÀI KHOẢN (GIỮ NGUYÊN) --- */}
      {memberEditId ? (
        <div className="mgr-modalOverlay" role="presentation" onClick={() => !memberEditSaving && setMemberEditId(null)}>
          <div className="mgr-modal" role="dialog" aria-modal="true" aria-labelledby="mgr-member-edit-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mgr-modalClose" aria-label="Đóng" disabled={memberEditSaving} onClick={() => setMemberEditId(null)}>×</button>
            <h2 className="mgr-modalTitle" id="mgr-member-edit-title">Chỉnh sửa thành viên</h2>
            <p className="mgr-modalMeta">Tài khoản #{memberEditId}</p>

            {memberEditLoading ? (
              <div className="mgr-subtle">Đang tải dữ liệu…</div>
            ) : (
              <>
                <div className="mgr-modalSectionTitle">Tài khoản</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input className="mgr-field" type="email" placeholder="Email đăng nhập" value={memberEditForm.email} onChange={(e) => setMemberEditForm((p) => ({ ...p, email: e.target.value }))} />
                  <select className="mgr-field" value={memberEditForm.status} onChange={(e) => setMemberEditForm((p) => ({ ...p, status: e.target.value }))}>
                    <option value="active">active</option>
                    <option value="pending">pending</option>
                    <option value="rejected">rejected</option>
                  </select>
                  {sessionRoleId === 1 ? (
                    <>
                      <select className="mgr-field" value={memberEditForm.role_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, role_id: e.target.value }))}>
                        <option value="3">Member</option>
                        <option value="2">Manager</option>
                      </select>
                      <input className="mgr-field" type="number" placeholder="clan_id (dòng họ)" value={memberEditForm.clan_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, clan_id: e.target.value }))} />
                    </>
                  ) : null}
                  <input className="mgr-field" style={{ gridColumn: "1 / -1" }} type="password" placeholder="Mật khẩu mới (để trống nếu không đổi)" value={memberEditForm.new_password} onChange={(e) => setMemberEditForm((p) => ({ ...p, new_password: e.target.value }))} autoComplete="new-password" />
                </div>

                <div className="mgr-modalSectionTitle">Hồ sơ người (people)</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input className="mgr-field" placeholder="Họ" value={memberEditForm.surname} onChange={(e) => setMemberEditForm((p) => ({ ...p, surname: e.target.value }))} />
                  <input className="mgr-field" placeholder="Tên đệm" value={memberEditForm.middle_name} onChange={(e) => setMemberEditForm((p) => ({ ...p, middle_name: e.target.value }))} />
                  <input className="mgr-field" placeholder="Tên" value={memberEditForm.first_name} onChange={(e) => setMemberEditForm((p) => ({ ...p, first_name: e.target.value }))} />
                  <select className="mgr-field" value={memberEditForm.gender} onChange={(e) => setMemberEditForm((p) => ({ ...p, gender: e.target.value }))}>
                    <option value="1">Nam</option>
                    <option value="2">Nữ</option>
                    <option value="">Không khai báo</option>
                  </select>
                  <input className="mgr-field" type="date" value={memberEditForm.birth_date} onChange={(e) => setMemberEditForm((p) => ({ ...p, birth_date: e.target.value }))} />
                  <input className="mgr-field" type="date" placeholder="Ngày mất" value={memberEditForm.death_date} onChange={(e) => setMemberEditForm((p) => ({ ...p, death_date: e.target.value }))} />
                  <select className="mgr-field" value={memberEditForm.is_living} onChange={(e) => setMemberEditForm((p) => ({ ...p, is_living: e.target.value }))}>
                    <option value="1">Còn sống</option>
                    <option value="0">Đã mất</option>
                  </select>
                  <input className="mgr-field" type="number" min={1} placeholder="Đời" value={memberEditForm.generation} onChange={(e) => setMemberEditForm((p) => ({ ...p, generation: e.target.value }))} />
                  <input className="mgr-field" type="number" placeholder="Chi (branch)" value={memberEditForm.branch} onChange={(e) => setMemberEditForm((p) => ({ ...p, branch: e.target.value }))} />
                  <input className="mgr-field" placeholder="Quê quán" value={memberEditForm.hometown} onChange={(e) => setMemberEditForm((p) => ({ ...p, hometown: e.target.value }))} />
                  <input className="mgr-field" style={{ gridColumn: "1 / -1" }} placeholder="Địa chỉ" value={memberEditForm.address} onChange={(e) => setMemberEditForm((p) => ({ ...p, address: e.target.value }))} />
                  <input className="mgr-field" placeholder="Điện thoại" value={memberEditForm.phone} onChange={(e) => setMemberEditForm((p) => ({ ...p, phone: e.target.value }))} />
                  <input className="mgr-field" type="email" placeholder="Email (trong hồ sơ people)" value={memberEditForm.people_email} onChange={(e) => setMemberEditForm((p) => ({ ...p, people_email: e.target.value }))} />
                  <input className="mgr-field" placeholder="Zalo" value={memberEditForm.zalo} onChange={(e) => setMemberEditForm((p) => ({ ...p, zalo: e.target.value }))} />
                  <input className="mgr-field" placeholder="Facebook" value={memberEditForm.facebook} onChange={(e) => setMemberEditForm((p) => ({ ...p, facebook: e.target.value }))} />
                  <input className="mgr-field" style={{ gridColumn: "1 / -1" }} placeholder="URL ảnh đại diện" value={memberEditForm.avatar_url} onChange={(e) => setMemberEditForm((p) => ({ ...p, avatar_url: e.target.value }))} />
                  <textarea className="mgr-field mgr-fieldTextarea" style={{ gridColumn: "1 / -1" }} placeholder="Giới thiệu (bio)" rows={2} value={memberEditForm.bio} onChange={(e) => setMemberEditForm((p) => ({ ...p, bio: e.target.value }))} />
                  <textarea className="mgr-field mgr-fieldTextarea" style={{ gridColumn: "1 / -1" }} placeholder="Ghi chú nội bộ" rows={2} value={memberEditForm.note} onChange={(e) => setMemberEditForm((p) => ({ ...p, note: e.target.value }))} />
                </div>

                <div className="mgr-modalSectionTitle">Quan hệ huyết thống (cha/mẹ → người này là con)</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input className="mgr-field" type="number" placeholder="ID cha (people.id)" value={memberEditForm.parent_father_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, parent_father_id: e.target.value }))} />
                  <input className="mgr-field" type="number" placeholder="ID mẹ (people.id)" value={memberEditForm.parent_mother_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, parent_mother_id: e.target.value }))} />
                </div>

                <div className="mgr-modalSectionTitle">Quan hệ hôn nhân (vợ/chồng, con)</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input className="mgr-field" type="number" placeholder="ID families (tùy chọn)" value={memberEditForm.family_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, family_id: e.target.value }))} />
                  <input className="mgr-field" type="number" placeholder="ID vợ/chồng (people.id)" value={memberEditForm.spouse_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, spouse_id: e.target.value }))} />
                  <input className="mgr-field" style={{ gridColumn: "1 / -1" }} placeholder="ID con (people.id, cách nhau dấu phẩy)" value={memberEditForm.children_ids} onChange={(e) => setMemberEditForm((p) => ({ ...p, children_ids: e.target.value }))} />
                </div>

                {memberEditMsg && (
                  <div className={memberEditMsg.includes("thành công") || memberEditMsg.includes("Đã lưu") ? "mgr-subtle" : "mgr-alert"} style={{ marginTop: 12 }}>
                    {memberEditMsg}
                  </div>
                )}

                <div className="mgr-modalActions">
                  <button className="mgr-btnPrimary" type="button" disabled={memberEditSaving} onClick={saveMemberEdit}>
                    {memberEditSaving ? "Đang lưu…" : "Lưu thay đổi"}
                  </button>
                  <button className="mgr-btnGhost" type="button" disabled={memberEditSaving} onClick={() => setMemberEditId(null)}>Đóng</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Manager;