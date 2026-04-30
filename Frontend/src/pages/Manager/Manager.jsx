import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./manager.css";
// --- 🌟 SỬA ĐƯỜNG DẪN IMPORT SOCKET CHO ĐÚNG CẤU TRÚC THƯ MỤC 🌟 ---
import { socket } from "../../utils/socket"; 
import {
  getDashboardData,
  getMembers,
  getMemberDetail,
  updateMemberByManager,
  archiveMemberAPI,
  getArchivedMembersAPI,
  restoreArchivedMemberAPI,
  deleteArchivedMemberAPI,
  createMember,
  approveUserAPI,
  rejectUserAPI,
  approvePostAPI,
  rejectPostAPI,
  getMediaLibraryData,
  createPersonAPI,
  assignTaskAPI, 
  approveProfileUpdateAPI,
  rejectProfileUpdateAPI,
  updateMemberRelations,
} from "../../api/managerService";
import { fullName } from "./managerData";
import {
  getMemberDashboard,
  updateMemberProfile,
  changeMemberPassword,
} from "../../api/memberService";
import ImageUpload from "../../components/ImageUpload/ImageUpload";

function readSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function memberDisplayName(m) {
  return fullName(m, "");
}

function isMaleMember(m) {
  const g = m?.gender;
  return g === 1 || g === "1" || g === "Nam";
}

function isFemaleMember(m) {
  const g = m?.gender;
  return g === 2 || g === "2" || g === "Nữ";
}

const emptyMemberEditForm = () => ({
  email: "", status: "active", role_id: "3", new_password: "", surname: "", middle_name: "", first_name: "",
  gender: "1", birth_date: "", death_date: "", is_living: "1", generation: "1", branch: "", hometown: "", address: "",
  phone: "", people_email: "", zalo: "", facebook: "", avatar_url: "", bio: "", note: "", clan_id: "", family_id: "",
  spouse_id: "", children_ids: "", parent_father_id: "", parent_mother_id: "",
});

function mapMemberToForm(m) {
  return {
    email: m.email || "", status: m.status || "active", role_id: String(m.role_id ?? 3), new_password: "",
    surname: m.surname ?? "", middle_name: m.middle_name ?? "", first_name: m.first_name ?? "",
    gender: m.gender == null || m.gender === "" ? "" : String(m.gender), birth_date: m.birth_date || "", death_date: m.death_date || "",
    is_living: m.is_living === 0 || m.is_living === false ? "0" : "1", generation: m.generation != null ? String(m.generation) : "1",
    branch: m.branch != null ? String(m.branch) : "", hometown: m.hometown || "", address: m.address || "", phone: m.phone || "",
    people_email: m.people_email || "", zalo: m.zalo || "", facebook: m.facebook || "", avatar_url: m.avatar_url || "",
    bio: m.bio || "", note: m.note || "", clan_id: m.clan_id != null ? String(m.clan_id) : "",
    family_id: m.marriage?.family_id != null ? String(m.marriage.family_id) : "",
    spouse_id: m.marriage?.spouse_id != null ? String(m.marriage.spouse_id) : "",
    children_ids: Array.isArray(m.marriage?.children_ids) ? m.marriage.children_ids.join(", ") : "",
    parent_father_id: m.bloodline?.parent_father_id != null ? String(m.bloodline.parent_father_id) : "",
    parent_mother_id: m.bloodline?.parent_mother_id != null ? String(m.bloodline.parent_mother_id) : "",
  };
}

const Manager = () => {
  const navigate = useNavigate();
  const currentUser = useMemo(() => readSessionUser(), []);

  // --- 🌟 SOCKET REGISTER 🌟 ---
  useEffect(() => {
    if (currentUser?.id) {
      socket.emit("register_user", currentUser.id);
      console.log("Manager registered to socket with ID:", currentUser.id);
      socket.on("new_notification", (data) => {
        alert(`🔔 THÔNG BÁO: ${data.message}`);
      });
    }
    return () => {
      socket.off("new_notification");
    };
  }, [currentUser]);
  
  const [stats, setStats] = useState({ total_members: 0, total_managers: 0, total_pending: 0 });
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [archivedMembers, setArchivedMembers] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedRelPerson, setSelectedRelPerson] = useState(null);
  const [relDetail, setRelDetail] = useState(null);
  const [relDetailLoading, setRelDetailLoading] = useState(false);

  const sessionRoleId = currentUser.role_id;
  const [overviewCreate, setOverviewCreate] = useState({ email: "", password: "", surname: "", middle_name: "", first_name: "", gender: "1", birth_date: "", hometown: "", generation: "1", clan_id: "" });
  const [overviewCreateMsg, setOverviewCreateMsg] = useState("");
  const [overviewCreateSaving, setOverviewCreateSaving] = useState(false);

  const [managerMeta, setManagerMeta] = useState({ person_id: null, role_id: null });
  const [overviewAccount, setOverviewAccount] = useState({ email: "", surname: "", middle_name: "", first_name: "", hometown: "", generation: "" });
  const [overviewPassword, setOverviewPassword] = useState({ current: "", next: "", confirm: "" });
  const [overviewAccountMsg, setOverviewAccountMsg] = useState("");
  const [overviewAccountLoading, setOverviewAccountLoading] = useState(false);
  const [overviewAccountSaving, setOverviewAccountSaving] = useState(false);
  const [overviewPasswordSaving, setOverviewPasswordSaving] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [profileContentForm, setProfileContentForm] = useState({ bio: "", avatar_url: "" });
  const [profileStatus, setProfileStatus] = useState("none");

  const [memberEditId, setMemberEditId] = useState(null);
  const [memberEditLoading, setMemberEditLoading] = useState(false);
  const [memberEditSaving, setMemberEditSaving] = useState(false);
  const [memberEditMsg, setMemberEditMsg] = useState("");
  const [memberEditForm, setMemberEditForm] = useState(() => emptyMemberEditForm());

  const [formData, setFormData] = useState({ first_name: "", surname: "", middle_name: "", display_name: "", gender: "Nam", birth_date: "", hometown: "", clan_id: 1, generation: 1 });
  const [treeBuildAccountId, setTreeBuildAccountId] = useState("");
  const [treeBuildLoading, setTreeBuildLoading] = useState(false);
  const [linkData, setLinkData] = useState({
    father_person_id: "",
    mother_person_id: "",
    spouse_person_id: "",
    children_person_ids: [],
  });
  const [maritalStatus, setMaritalStatus] = useState("Độc thân");

  const [taskData, setTaskData] = useState({ member_ids: [], title: "", description: "", due_date: "" });

  const loadAll = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setLoading(true);
    setError("");
    try {
      const [dashboardData, membersData, mediaData, archivedData] = await Promise.all([
        getDashboardData(),
        getMembers(),
        getMediaLibraryData(),
        getArchivedMembersAPI().catch(() => ({ success: true, items: [] }))
      ]);
      setStats(dashboardData.stats);
      setMembers(membersData);
      setPending(dashboardData.pendingUsers);
      setPendingPosts(dashboardData.pendingPosts);
      setPendingProfiles(dashboardData.pendingProfiles);
      setMediaList(mediaData);
      setAllTasks(dashboardData.tasks);
      setArchivedMembers(Array.isArray(archivedData?.items) ? archivedData.items : []);
    } catch (e) {
      if (!silent) setError(e?.message || "Không thể tải dữ liệu manager");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!selectedRelPerson?.account_id) {
      setRelDetail(null);
      return;
    }
    let cancelled = false;
    setRelDetailLoading(true);
    getMemberRelations(selectedRelPerson.account_id)
      .then((data) => {
        if (!cancelled && data?.success) setRelDetail(data);
        else if (!cancelled) setRelDetail(null);
      })
      .catch(() => {
        if (!cancelled) setRelDetail(null);
      })
      .finally(() => {
        if (!cancelled) setRelDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRelPerson?.account_id]);

  useEffect(() => {
    if (!treeBuildAccountId) {
      setLinkData({
        father_person_id: "",
        mother_person_id: "",
        spouse_person_id: "",
        children_person_ids: [],
      });
      setMaritalStatus("Độc thân");
      return;
    }
    let cancelled = false;
    setTreeBuildLoading(true);
    (async () => {
      try {
        const data = await getMemberRelations(Number(treeBuildAccountId));
        if (cancelled || !data?.success) return;
        const bl = data.bloodline;
        const mar = data.marriage || {};
        setLinkData({
          father_person_id: bl?.parent_father_id != null ? String(bl.parent_father_id) : "",
          mother_person_id: bl?.parent_mother_id != null ? String(bl.parent_mother_id) : "",
          spouse_person_id: mar.spouse_id != null ? String(mar.spouse_id) : "",
          children_person_ids: Array.isArray(mar.children_ids) ? mar.children_ids.map(String) : [],
        });
        setMaritalStatus(mar.spouse_id ? "Đã kết hôn" : "Độc thân");
      } catch (e) {
        if (!cancelled) alert(e?.message || "Không tải được quan hệ từ máy chủ.");
      } finally {
        if (!cancelled) setTreeBuildLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [treeBuildAccountId]);

  useEffect(() => {
    const interval = setInterval(() => { loadAll({ silent: true }); }, 10000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const loadOverviewProfile = useCallback(async () => {
    setOverviewAccountLoading(true);
    setOverviewAccountMsg("");
    try {
      const dash = await getMemberDashboard();
      const p = dash.profile || {};
      setManagerMeta({ person_id: p.person_id ?? null, role_id: p.role_id ?? null });
      setOverviewAccount({ email: p.email || "", surname: p.surname ?? "", middle_name: p.middle_name ?? "", first_name: p.first_name ?? "", hometown: p.hometown || "", generation: p.generation ?? "" });
      setProfileContentForm({ bio: p.pending_bio !== null ? (p.pending_bio || "") : (p.bio || ""), avatar_url: p.pending_avatar_url !== null ? (p.pending_avatar_url || "") : (p.avatar_url || "") });
      setProfileStatus(p.moderation_status || "none");
    } catch (e) {
      setOverviewAccountMsg(e?.message || "Không tải được hồ sơ.");
      setManagerMeta({ person_id: null, role_id: readSessionUser().role_id ?? null });
    } finally {
      setOverviewAccountLoading(false);
    }
  }, []);

  useEffect(() => { if (activeSection === "overview") loadOverviewProfile(); }, [activeSection, loadOverviewProfile]);

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
      } finally { if (!cancelled) setMemberEditLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [memberEditId]);

  // --- 🌟 SOCKET EMIT TRONG ASSIGN TASK 🌟 ---
  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!Array.isArray(taskData.member_ids) || taskData.member_ids.length === 0) return alert("Vui lòng chọn ít nhất một thành viên!");
    try { 
        const payload = {
          ...taskData,
          member_ids: taskData.member_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)),
        };
        const result = await assignTaskAPI(payload); 
        alert(`Đã giao việc thành công cho ${result.assigned_count || payload.member_ids.length} thành viên.`); 
        setTaskData({ member_ids: [], title: "", description: "", due_date: "" }); 
        loadAll(); 
    } 
    catch (err) { alert("Lỗi phân công: " + err.message); }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

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
      if (sessionRoleId === 1 || sessionRoleId === 2) payload.role_id = Number(f.role_id);
      if (sessionRoleId === 1 && f.clan_id.trim() !== "") payload.clan_id = Number(f.clan_id);
      const fid = f.family_id.trim(); const sid = f.spouse_id.trim();
      if (fid !== "") payload.family_id = Number(fid); if (sid !== "") payload.spouse_id = Number(sid);
      const pf = f.parent_father_id.trim(); const pm = f.parent_mother_id.trim();
      if (pf !== "" || pm !== "") { payload.parent_father_id = pf === "" ? null : Number(pf); payload.parent_mother_id = pm === "" ? null : Number(pm); }
      
      const res = await updateMemberByManager(memberEditId, payload);
      setMemberEditMsg("Đã lưu thành công.");
      setMemberEditForm(mapMemberToForm(res.member));
      await loadAll();
    } catch (e) { setMemberEditMsg(e?.message || "Không thể lưu"); } finally { setMemberEditSaving(false); }
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
    } catch (e) { setOverviewCreateMsg(e?.message || "Không thể tạo thành viên"); } finally { setOverviewCreateSaving(false); }
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
    } catch (e) { setOverviewAccountMsg(e?.message || "Không thể lưu hồ sơ"); } finally { setOverviewAccountSaving(false); }
  };

  const saveOverviewPassword = async () => {
    setOverviewAccountMsg("");
    if (overviewPassword.next !== overviewPassword.confirm) return setOverviewAccountMsg("Mật khẩu không khớp.");
    setOverviewPasswordSaving(true);
    try {
      await changeMemberPassword({ current_password: overviewPassword.current, new_password: overviewPassword.next });
      setOverviewPassword({ current: "", next: "", confirm: "" });
      setOverviewAccountMsg("Đã đổi mật khẩu thành công.");
    } catch (e) { setOverviewAccountMsg(e?.message || "Không thể đổi mật khẩu"); } finally { setOverviewPasswordSaving(false); }
  };

  const doApprove = async (id) => { await approveUserAPI(id); await loadAll(); };
  const doReject = async (id) => { await rejectUserAPI(id); await loadAll(); };
  const doApprovePost = async (id) => { await approvePostAPI(id); await loadAll(); };
  const doRejectPost = async (id) => {
    const reason = window.prompt("Lý do từ chối bài viết:");
    if (reason === null) return;
    await rejectPostAPI(id, reason || "Không đạt yêu cầu");
    await loadAll();
  };
  const doApproveProfile = async (id) => { await approveProfileUpdateAPI(id); await loadAll(); };
  const doRejectProfile = async (id) => {
    const reason = window.prompt("Nhập lý do từ chối cập nhật hồ sơ:");
    if (reason === null) return;
    await rejectProfileUpdateAPI(id, reason || "Không có lý do rõ ràng");
    await loadAll();
  };
  const archiveCurrentMember = async () => {
    if (!memberEditId) return;
    const reason = window.prompt("Nhập lý do xóa khỏi cây (sẽ lưu trữ, không xóa vĩnh viễn):");
    if (reason === null) return;
    try {
      await archiveMemberAPI(memberEditId, reason || "");
      alert("Đã chuyển thành viên vào kho lưu trữ.");
      setMemberEditId(null);
      await loadAll();
    } catch (e) {
      alert(e?.message || "Không thể lưu trữ thành viên");
    }
  };
  const removeArchivedPermanently = async (archiveId) => {
    const ok = window.confirm("Xóa vĩnh viễn bản ghi này khỏi kho lưu trữ?");
    if (!ok) return;
    try {
      await deleteArchivedMemberAPI(archiveId);
      await loadAll();
    } catch (e) {
      alert(e?.message || "Không thể xóa vĩnh viễn");
    }
  };
  const restoreArchived = async (archiveId) => {
    const ok = window.confirm("Phục hồi thành viên này về danh sách đang hoạt động?");
    if (!ok) return;
    try {
      await restoreArchivedMemberAPI(archiveId);
      await loadAll();
    } catch (e) {
      alert(e?.message || "Không thể phục hồi");
    }
  };

  const handleCreatePerson = async (e) => {
    e.preventDefault();
    try { await createPersonAPI(formData); alert("Đã tạo thành viên mới thành công!"); setFormData({ surname: "", middle_name: "", first_name: "", display_name: "", gender: "1", birth_date: "", hometown: "", clan_id: 1, generation: 1 }); loadAll(); } 
    catch (err) { alert("Lỗi: " + err.message); }
  };

  const handleLinkRelations = async () => {
    if (!treeBuildAccountId) return alert("Vui lòng chọn một người cần thiết lập!");
    const accountId = Number(treeBuildAccountId);
    try {
      const pf = linkData.father_person_id === "" ? null : Number(linkData.father_person_id);
      const pm = linkData.mother_person_id === "" ? null : Number(linkData.mother_person_id);
      if (pf || pm) {
        await updateMemberRelations(accountId, {
          mode: "bloodline",
          parent_father_id: pf,
          parent_mother_id: pm,
        });
      }
      const spouse =
        maritalStatus === "Đã kết hôn" && linkData.spouse_person_id
          ? Number(linkData.spouse_person_id)
          : null;
      const children_ids = (linkData.children_person_ids || [])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n));
      await updateMemberRelations(accountId, {
        mode: "marriage",
        spouse_id: spouse,
        children_ids,
      });
      alert("Đã lưu liên kết gia phả (cha mẹ, hôn nhân, con cái).");
      await loadAll();
      const refreshed = await getMemberRelations(accountId);
      if (refreshed?.success) {
        const bl = refreshed.bloodline;
        const mar = refreshed.marriage || {};
        setLinkData({
          father_person_id: bl?.parent_father_id != null ? String(bl.parent_father_id) : "",
          mother_person_id: bl?.parent_mother_id != null ? String(bl.parent_mother_id) : "",
          spouse_person_id: mar.spouse_id != null ? String(mar.spouse_id) : "",
          children_person_ids: Array.isArray(mar.children_ids) ? mar.children_ids.map(String) : [],
        });
        setMaritalStatus(mar.spouse_id ? "Đã kết hôn" : "Độc thân");
      }
    } catch (err) {
      alert("Lỗi: " + (err?.message || "Không lưu được"));
    }
  };

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = activeSection === "approvals" ? pending : members;
    return source.filter((u) => !q || `${u.first_name ?? ""} ${u.surname ?? ""}`.trim().toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q));
  }, [activeSection, members, pending, search]);

  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case "overview": return "Tổng quan"; case "members": return "Danh sách thành viên"; case "approvals": return "Duyệt tài khoản";
      case "lineage": return "Lineage Management"; case "tasks": return "Phân công công việc"; case "relationships": return "Duy trì mối quan hệ";
      case "moderation": return "Content Moderation"; case "media": return "Media Management"; case "archive": return "Kho lưu trữ thành viên"; default: return "Quản lý";
    }
  }, [activeSection]);

  return (
    <div className="mgr-shell">
      <aside className="mgr-sidebar">
        <div className="mgr-brand"><div className="mgr-logo" aria-hidden="true">G</div><div className="mgr-brandText"><div className="mgr-brandTitle" style={{color: 'var(--mgr-text)'}}>Gia Phả</div><div className="mgr-brandSub">Quản trị gia phả</div></div></div>
        <div className="mgr-sidebarBlock">
          <div className="mgr-sidebarHeading">Thống kê gia phả</div>
          <div className="mgr-miniStats">
            <div className="mgr-miniStat"><div className="mgr-miniValue" style={{color: 'var(--mgr-text)'}}>{stats.total_members}</div><div className="mgr-miniLabel">Thành viên</div></div>
            <div className="mgr-miniStat"><div className="mgr-miniValue" style={{color: 'var(--mgr-text)'}}>{stats.total_managers}</div><div className="mgr-miniLabel">Manager</div></div>
            <div className="mgr-miniStat"><div className="mgr-miniValue" style={{color: 'var(--mgr-text)'}}>{stats.total_pending}</div><div className="mgr-miniLabel">Chờ duyệt</div></div>
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
          <button className={`mgr-navItem ${activeSection === "archive" ? "isActive" : ""}`} onClick={() => setActiveSection("archive")}>Kho lưu trữ</button>
        </nav>
      </aside>

      <main className="mgr-main">
        <div className="mgr-topbar">
          <div className="mgr-search"><input style={{color: 'var(--mgr-text)'}} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm thành viên…" aria-label="Tìm kiếm thành viên" /></div>
          <div className="mgr-topActions">
            <button className="mgr-pill" type="button" style={{color: 'var(--mgr-text)'}} onClick={() => setShowAccountModal(true)}>Tài khoản</button>
            <button className="mgr-iconBtn" type="button" style={{color: 'var(--mgr-text)'}} onClick={() => loadAll()} title="Tải lại">↻</button>
            <button className="mgr-btnGhost mgr-logoutBtn" type="button" style={{color: 'var(--mgr-text)'}} onClick={logout} title="Đăng xuất">Đăng xuất</button>
          </div>
        </div>

        {showAccountModal && (
          <div className="usr-modalOverlay" onClick={() => setShowAccountModal(false)}>
            <div className="usr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="usr-modalHeader">
                <h2 className="usr-modalTitle" style={{color: 'var(--mgr-text)'}}>Tài khoản Quản lý</h2>
                <button className="usr-modalClose" onClick={() => setShowAccountModal(false)}>&times;</button>
              </div>
              <div className="usr-modalBody">
                <div className="usr-accountModal-avatarSection">
                  <div className="usr-accountModal-avatarLabel">Ảnh hồ sơ</div>
                  <ImageUpload onUploadSuccess={(url) => setProfileContentForm(p => ({ ...p, avatar_url: url }))} label="Tải ảnh hoặc dán URL" />
                  {(profileStatus === 'pending') && <span className="status-pill pending">Đang chờ duyệt cập nhật hồ sơ</span>}
                </div>
                <div className="usr-accountModal-sectionTitle" style={{color: 'var(--mgr-text)'}}>Thông tin cá nhân</div>
                <div className="usr-accountModal-grid">
                  <input className="usr-input" style={{color: 'var(--mgr-text)'}} value={overviewAccount.surname} onChange={(e) => setOverviewAccount(p => ({ ...p, surname: e.target.value }))} placeholder="Họ" />
                  <input className="usr-input" style={{color: 'var(--mgr-text)'}} value={overviewAccount.middle_name} onChange={(e) => setOverviewAccount(p => ({ ...p, middle_name: e.target.value }))} placeholder="Tên đệm" />
                  <input className="usr-input" style={{color: 'var(--mgr-text)'}} value={overviewAccount.first_name} onChange={(e) => setOverviewAccount(p => ({ ...p, first_name: e.target.value }))} placeholder="Tên" />
                  <input className="usr-input" style={{color: 'var(--mgr-text)'}} value={overviewAccount.email} onChange={(e) => setOverviewAccount(p => ({ ...p, email: e.target.value }))} placeholder="Email" />
                  <div className="usr-accountModal-full"><input className="usr-input" style={{ width: '100%', color: 'var(--mgr-text)' }} value={overviewAccount.hometown} onChange={(e) => setOverviewAccount(p => ({ ...p, hometown: e.target.value }))} placeholder="Quê quán" /></div>
                  <div className="usr-accountModal-full"><textarea className="usr-textarea" style={{color: 'var(--mgr-text)'}} value={profileContentForm.bio} onChange={e => setProfileContentForm(prev => ({ ...prev, bio: e.target.value }))} placeholder="Tiểu sử / Giới thiệu..." rows="3" /></div>
                  <div className="usr-accountModal-full" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button className="usr-btnPrimary" style={{ flex: 1, height: '40px' }} onClick={saveOverviewAccount} disabled={overviewAccountSaving || managerMeta.person_id == null}>Lưu thông tin cơ bản</button>
                    <button className="usr-btnPrimary" style={{ flex: 1, height: '40px', background: '#4a148c' }} 
                      onClick={async () => {
                         try {
                           const { proposeProfileUpdate } = await import("../../api/memberService");
                           await proposeProfileUpdate(profileContentForm);
                           alert("Đã gửi yêu cầu cập nhật hồ sơ!");
                           loadOverviewProfile();
                         } catch (e) { setOverviewAccountMsg(e?.message || "Lỗi cập nhật hồ sơ"); }
                      }} 
                      disabled={profileStatus === 'pending' || managerMeta.person_id == null}>
                      Cập nhật Ảnh & Bio
                    </button>
                  </div>
                </div>
                <div className="usr-accountModal-sectionTitle" style={{color: 'var(--mgr-text)'}}>Đổi mật khẩu</div>
                <div className="usr-accountModal-grid">
                  <input className="usr-input" style={{color: 'var(--mgr-text)'}} type="password" value={overviewPassword.current} onChange={e => setOverviewPassword(p => ({ ...p, current: e.target.value }))} placeholder="Mật khẩu hiện tại" />
                  <input className="usr-input" style={{color: 'var(--mgr-text)'}} type="password" value={overviewPassword.next} onChange={e => setOverviewPassword(p => ({ ...p, next: e.target.value }))} placeholder="Mật khẩu mới" />
                  <div className="usr-accountModal-full"><input className="usr-input" style={{ width: '100%', color: 'var(--mgr-text)' }} type="password" value={overviewPassword.confirm} onChange={e => setOverviewPassword(p => ({ ...p, confirm: e.target.value }))} placeholder="Xác nhận mật khẩu mới" /></div>
                  <div className="usr-accountModal-full"><button className="usr-btnPrimary" style={{ width: '100%', height: '40px' }} onClick={saveOverviewPassword} disabled={overviewPasswordSaving}>{overviewPasswordSaving ? "Đang lưu..." : "Đổi mật khẩu"}</button></div>
                </div>
                {overviewAccountMsg && <div className={`mgr-alert ${overviewAccountMsg.includes('Lỗi') ? 'mgr-alert--danger' : ''}`}>{overviewAccountMsg}</div>}
              </div>
            </div>
          </div>
        )}

        <section className="mgr-hero" aria-label="Banner">
          <div className="mgr-heroOverlay" />
          <div className="mgr-heroContent">
            <div className="mgr-heroKicker">Phần mềm Gia phả AI</div>
            <div className="mgr-heroTitle">Bảng điều khiển Manager</div>
            <div className="mgr-heroDesc">Quản lý dữ liệu gia phả, mối quan hệ nhiều thế hệ, kiểm duyệt nội dung và hồ sơ đa phương tiện.</div>
            <div className="mgr-heroBadges"><span className="mgr-badge">{stats.total_members} thành viên</span><span className="mgr-badge">{stats.total_pending} chờ duyệt</span></div>
          </div>
        </section>

        <section className="mgr-sectionHeader">
          <h2 style={{color: 'var(--mgr-text)'}}>{sectionTitle}</h2>
          {error ? <div className="mgr-alert">{error}</div> : null}
          {loading ? <div className="mgr-subtle">Đang tải dữ liệu…</div> : null}
        </section>

        {activeSection === "overview" && (
          <section className="mgr-grid2">
            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div><div className="mgr-panelTitle" style={{ fontSize: '1.1rem', color: 'var(--mgr-primary)' }}>Quản lý dữ liệu gia phả (Lineage)</div><div className="mgr-panelText">Tạo mới, cập nhật và liên kết các thành viên để xây dựng cây gia phả kỹ thuật số.</div></div>
              <div className="mgr-panelActions" style={{ marginTop: '20px' }}><button className="mgr-btnPrimary" type="button" onClick={() => setActiveSection("lineage")}>Tạo thành viên mới</button></div>
            </div>
            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div><div className="mgr-panelTitle" style={{ fontSize: '1.1rem', color: '#ff9800' }}>Content Moderation</div><div className="mgr-panelText">Kiểm soát thông tin, hình ảnh đóng góp.</div></div>
              <div className="mgr-panelActions" style={{ marginTop: '20px' }}><button className="mgr-btnPrimary" type="button" style={{ background: '#ff9800' }} onClick={() => setActiveSection("moderation")}>Hàng chờ duyệt</button></div>
            </div>
            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div><div className="mgr-panelTitle" style={{ fontSize: '1.1rem', color: '#8b5cf6' }}>Phân công công việc</div><div className="mgr-panelText">Giao nhiệm vụ cho các thành viên.</div></div>
              <div className="mgr-panelActions" style={{ marginTop: '20px' }}><button className="mgr-btnPrimary" type="button" style={{ background: '#8b5cf6' }} onClick={() => setActiveSection("tasks")}>Giao việc mới</button></div>
            </div>
            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div><div className="mgr-panelTitle" style={{ fontSize: '1.1rem', color: '#2f9bff' }}>Media Management</div><div className="mgr-panelText">Kho hình ảnh truyền thống và lịch sử.</div></div>
              <div className="mgr-panelActions" style={{ marginTop: '20px' }}><button className="mgr-btnPrimary" type="button" style={{ background: '#2f9bff' }} onClick={() => setActiveSection("media")}>Mở Thư viện Media</button></div>
            </div>
            <div className="mgr-panel mgr-panel--wide">
              <div className="mgr-panelTitle" style={{color: 'var(--mgr-text)'}}>Tạo tài khoản đăng nhập cho thành viên mới</div>
              <div className="mgr-overviewFormGrid" style={{ marginTop: '15px' }}>
                <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="email" placeholder="Email đăng nhập *" value={overviewCreate.email} onChange={(e) => setOverviewCreate((p) => ({ ...p, email: e.target.value }))} autoComplete="off" />
                <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="password" placeholder="Mật khẩu *" value={overviewCreate.password} onChange={(e) => setOverviewCreate((p) => ({ ...p, password: e.target.value }))} autoComplete="new-password" />
                <input className="mgr-field" style={{color: 'var(--mgr-text)'}} placeholder="Họ *" value={overviewCreate.surname} onChange={(e) => setOverviewCreate((p) => ({ ...p, surname: e.target.value }))} />
                <input className="mgr-field" style={{color: 'var(--mgr-text)'}} placeholder="Tên đệm" value={overviewCreate.middle_name} onChange={(e) => setOverviewCreate((p) => ({ ...p, middle_name: e.target.value }))} />
                <input className="mgr-field" style={{color: 'var(--mgr-text)'}} placeholder="Tên *" value={overviewCreate.first_name} onChange={(e) => setOverviewCreate((p) => ({ ...p, first_name: e.target.value }))} />
                <select className="mgr-field" style={{color: 'var(--mgr-text)'}} value={overviewCreate.gender} onChange={(e) => setOverviewCreate((p) => ({ ...p, gender: e.target.value }))} ><option value="1">Nam</option><option value="2">Nữ</option></select>
                <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="date" value={overviewCreate.birth_date} onChange={(e) => setOverviewCreate((p) => ({ ...p, birth_date: e.target.value }))} />
                <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="number" min={1} placeholder="Đời" value={overviewCreate.generation} onChange={(e) => setOverviewCreate((p) => ({ ...p, generation: e.target.value }))} />
                <input className="mgr-field" style={{ gridColumn: sessionRoleId === 1 ? "span 1" : "1 / -1", color: 'var(--mgr-text)' }} placeholder="Quê quán" value={overviewCreate.hometown} onChange={(e) => setOverviewCreate((p) => ({ ...p, hometown: e.target.value }))} />
                {sessionRoleId === 1 && <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="number" placeholder="Mã dòng họ (clan_id) *" value={overviewCreate.clan_id} onChange={(e) => setOverviewCreate((p) => ({ ...p, clan_id: e.target.value }))} />}
              </div>
              {overviewCreateMsg && <div className={overviewCreateMsg.startsWith("Đã ") ? "mgr-subtle" : "mgr-alert"} style={{ marginTop: 10 }}>{overviewCreateMsg}</div>}
              <div className="mgr-panelActions" style={{ marginTop: 12 }}><button className="mgr-btnPrimary" type="button" disabled={overviewCreateSaving} onClick={submitOverviewCreateMember}>{overviewCreateSaving ? "Đang tạo…" : "Tạo tài khoản"}</button></div>
            </div>
          </section>
        )}

        {(activeSection === "members" || activeSection === "approvals") && (
          <section>
            <div className="mgr-listHeader">
              <div className="mgr-listTitle" style={{color: 'var(--mgr-text)'}}>{activeSection === "approvals" ? `Tài khoản chờ duyệt (${filteredMembers.length})` : `Tất cả thành viên (${filteredMembers.length})`}</div>
            </div>
            <div className="mgr-cardGrid">
              {filteredMembers.map((user) => (
                <div className={`mgr-card ${activeSection === "members" ? "mgr-card--clickable" : ""}`} key={user.account_id} onClick={() => { if (activeSection === "members") setMemberEditId(user.account_id); }}>
                  <div className="mgr-cardCover"><div className="mgr-dot" /><div className="mgr-chip">Đời {user.generation ?? "—"}</div></div>
                  <div className="mgr-cardBody">
                    <div className="mgr-cardName" style={{color: 'var(--mgr-text)'}}>{user.first_name} {user.surname}</div>
                    <div className="mgr-cardMeta">{user.email}</div>
                    <div className="mgr-cardRows">
                      <div className="mgr-row"><span className="mgr-rowKey">Năm sinh</span><span className="mgr-rowVal" style={{color: 'var(--mgr-text)'}}>{user.birth_date ? new Date(user.birth_date).getFullYear() : "—"}</span></div>
                      <div className="mgr-row"><span className="mgr-rowKey">Vai trò</span><span className="mgr-rowVal" style={{color: 'var(--mgr-text)'}}>{user.role_id === 2 ? "Manager" : user.role_id === 3 ? "Member" : `Role ${user.role_id}`}</span></div>
                      <div className="mgr-row"><span className="mgr-rowKey">Trạng thái</span><span className="mgr-rowVal" style={{color: 'var(--mgr-text)'}}>{user.status || "—"}</span></div>
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

        {activeSection === "lineage" && (
          <section className="mgr-grid2">
            <div className="mgr-panel">
              <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: 'var(--mgr-primary)' }}>1. Thêm thành viên mới</div>
              <form style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }} onSubmit={handleCreatePerson}>
                <div>
                  <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>Họ và Tên khai sinh *</label>
                  <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <input className="mgr-search" style={{ flex: '1.2', minWidth: '0', color: 'var(--mgr-text)' }} placeholder="Họ" value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} required />
                    <input className="mgr-search" style={{ flex: '1', minWidth: '0', color: 'var(--mgr-text)' }} placeholder="Tên đệm" value={formData.middle_name} onChange={e => setFormData({...formData, middle_name: e.target.value})} />
                    <input className="mgr-search" style={{ flex: '1.2', minWidth: '0', color: 'var(--mgr-text)' }} placeholder="Tên" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required />
                  </div>
                </div>
                <div><label className="mgr-miniLabel">Tên hiển thị</label><input className="mgr-search" style={{ width: '100%', color: 'var(--mgr-text)' }} value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div><label className="mgr-miniLabel">Giới tính</label><select className="mgr-search" style={{ width: '100%', color: 'var(--mgr-text)' }} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}><option value="1">Nam</option><option value="2">Nữ</option></select></div>
                  <div><label className="mgr-miniLabel">Ngày sinh</label><input className="mgr-search" type="date" style={{ width: '100%', color: 'var(--mgr-text)' }} value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} /></div>
                </div>
                <div><label className="mgr-miniLabel">Quê quán</label><input className="mgr-search" style={{ width: '100%', color: 'var(--mgr-text)' }} value={formData.hometown} onChange={e => setFormData({...formData, hometown: e.target.value})} /></div>
                <button className="mgr-btnPrimary" type="submit" style={{ width: '100%', padding: '12px' }}>+ Lưu thành viên</button>
              </form>
            </div>

            <div className="mgr-panel" style={{ backgroundColor: '#fafbfc' }}>
              <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: 'var(--mgr-primary-2)' }}>2. Xây dựng cây (Build Tree)</div>
              <p className="mgr-panelText" style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                Chọn thành viên (tài khoản) cần gắn vào cây. Hệ thống tải <strong>cha, mẹ, vợ/chồng, con</strong> từ cơ sở dữ liệu; bạn có thể chỉnh và bấm lưu.
                Giá trị dropdown là <strong>person_id</strong> (hồ sơ người), khớp với bảng <code>people</code> / <code>families</code>.
              </p>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--mgr-border)' }}>
                  <label className="mgr-rowKey" style={{ display: 'block', marginBottom: '8px' }}>👉 Chọn hồ sơ:</label>
                  <select
                    className="mgr-search"
                    style={{ width: '100%', border: '2px solid var(--mgr-primary-2)', color: 'var(--mgr-text)' }}
                    value={treeBuildAccountId}
                    onChange={(e) => setTreeBuildAccountId(e.target.value)}
                  >
                    <option value="" style={{color: 'var(--mgr-text)'}}>-- Click để chọn thành viên --</option>
                    {members.map((m) => (
                      <option key={m.account_id} value={String(m.account_id)} style={{color: 'var(--mgr-text)'}}>
                        {memberDisplayName(m)} - account #{m.account_id} / person #{m.person_id}
                      </option>
                    ))}
                  </select>
                  {treeBuildLoading ? <div className="mgr-subtle" style={{ marginTop: '10px' }}>Đang tải quan hệ từ máy chủ…</div> : null}
                </div>
                <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--mgr-border)' }}>
                  <div className="mgr-miniLabel" style={{ marginBottom: '10px', fontWeight: 700 }}>Huyết thống (cha / mẹ trong DB)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                        <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>👤 Người Cha:</label>
                        <select
                          className="mgr-search"
                          style={{ width: '100%', color: 'var(--mgr-text)' }}
                          value={linkData.father_person_id}
                          onChange={(e) => setLinkData((prev) => ({ ...prev, father_person_id: e.target.value }))}
                          disabled={!treeBuildAccountId}
                        >
                          <option value="" style={{color: 'var(--mgr-text)'}}>-- Khuyết / Chưa rõ --</option>
                          {members
                            .filter((m) => String(m.account_id) !== treeBuildAccountId)
                            .filter(isMaleMember)
                            .map((m) => (
                              <option key={m.person_id} value={String(m.person_id)} style={{color: 'var(--mgr-text)'}}>
                                {memberDisplayName(m)} - person #{m.person_id}
                              </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>👩 Người Mẹ:</label>
                        <select
                          className="mgr-search"
                          style={{ width: '100%', color: 'var(--mgr-text)' }}
                          value={linkData.mother_person_id}
                          onChange={(e) => setLinkData((prev) => ({ ...prev, mother_person_id: e.target.value }))}
                          disabled={!treeBuildAccountId}
                        >
                          <option value="" style={{color: 'var(--mgr-text)'}}>-- Khuyết / Chưa rõ --</option>
                          {members
                            .filter((m) => String(m.account_id) !== treeBuildAccountId)
                            .filter(isFemaleMember)
                            .map((m) => (
                              <option key={m.person_id} value={String(m.person_id)} style={{color: 'var(--mgr-text)'}}>
                                {memberDisplayName(m)} - person #{m.person_id}
                              </option>
                            ))}
                        </select>
                    </div>
                  </div>
                </div>
                <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--mgr-border)' }}>
                  <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>💍 Tình trạng hôn nhân:</label>
                  <select
                    className="mgr-search"
                    style={{ width: '100%', marginBottom: '10px', color: 'var(--mgr-text)' }}
                    value={maritalStatus}
                    onChange={(e) => {
                      setMaritalStatus(e.target.value);
                      if (e.target.value === "Độc thân") setLinkData((prev) => ({ ...prev, spouse_person_id: "" }));
                    }}
                    disabled={!treeBuildAccountId}
                  >
                    <option value="Độc thân">Độc thân</option><option value="Đã kết hôn">Đã kết hôn</option>
                  </select>
                  {maritalStatus === "Đã kết hôn" && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--mgr-border)' }}>
                      <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px', color: '#e83e8c' }}>Chọn Vợ / Chồng:</label>
                      <select
                        className="mgr-search"
                        style={{ width: '100%', color: 'var(--mgr-text)' }}
                        value={linkData.spouse_person_id}
                        onChange={(e) => setLinkData((prev) => ({ ...prev, spouse_person_id: e.target.value }))}
                        disabled={!treeBuildAccountId}
                      >
                        <option value="">-- Chọn hồ sơ Vợ/Chồng --</option>
                        {members
                          .filter((m) => String(m.account_id) !== treeBuildAccountId)
                          .map((m) => (
                            <option key={m.person_id} value={String(m.person_id)}>
                              {memberDisplayName(m)} - person #{m.person_id}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--mgr-border)' }}>
                  <label className="mgr-miniLabel" style={{ display: 'block', marginBottom: '6px' }}>👶 Con cái (nhiều tài khoản / hồ sơ)</label>
                  <p style={{ fontSize: '0.82rem', color: 'var(--mgr-muted)', margin: '0 0 8px' }}>
                    Giữ <kbd>Ctrl</kbd> (Windows) hoặc <kbd>Cmd</kbd> (Mac) để chọn nhiều người. Danh sách lưu vào bản ghi gia đình (<code>children</code>) của người đang chọn.
                  </p>
                  <select
                    className="mgr-search mgr-selectMulti"
                    multiple
                    disabled={!treeBuildAccountId}
                    value={linkData.children_person_ids}
                    onChange={(e) =>
                      setLinkData((p) => ({
                        ...p,
                        children_person_ids: Array.from(e.target.selectedOptions, (o) => o.value),
                      }))
                    }
                  >
                    {(() => {
                      const listed = new Set(
                        members.filter((m) => String(m.account_id) !== treeBuildAccountId).map((m) => String(m.person_id))
                      );
                      const orphans = linkData.children_person_ids.filter((id) => id && !listed.has(String(id)));
                      return (
                        <>
                          {orphans.map((oid) => (
                            <option key={`orphan-${oid}`} value={String(oid)}>
                              Hồ sơ #{oid} (chưa có trong danh sách tài khoản)
                            </option>
                          ))}
                          {members
                            .filter((m) => String(m.account_id) !== treeBuildAccountId)
                            .map((m) => (
                              <option key={m.person_id} value={String(m.person_id)}>
                                {memberDisplayName(m)}
                              </option>
                            ))}
                        </>
                      );
                    })()}
                  </select>
                </div>
                <button
                  className="mgr-btnPrimary"
                  type="button"
                  style={{ padding: '12px', background: 'linear-gradient(135deg, #2f9bff, #007bff)' }}
                  disabled={!treeBuildAccountId || treeBuildLoading}
                  onClick={handleLinkRelations}
                >
                  🔗 Xác nhận lưu liên kết (DB)
                </button>
              </div>
            </div>
          </section>
        )}

        {activeSection === "tasks" && (
          <section className="mgr-grid2">
              <div className="mgr-panel">
                  <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: '#8b5cf6' }}>Giao việc cho thành viên</div>
                  <form style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }} onSubmit={handleAssignTask}>
                      <div>
                        <label className="mgr-miniLabel">Chọn người thực hiện *</label>
                        <select
                          multiple
                          className="mgr-search"
                          style={{ width: '100%', height: '160px', color: 'var(--mgr-text)' }}
                          value={taskData.member_ids}
                          onChange={e => setTaskData({
                            ...taskData,
                            member_ids: Array.from(e.target.selectedOptions, (option) => option.value),
                          })}
                          required
                        >
                            {members.map(m => <option key={m.account_id} value={m.account_id}>{m.surname} {m.middle_name || ''} {m.first_name} (ID {m.account_id})</option>)}
                        </select>
                        <div style={{ fontSize: '0.8rem', color: 'var(--mgr-muted)', marginTop: '6px' }}>Giữ `Ctrl` hoặc `Cmd` để chọn nhiều thành viên.</div>
                      </div>
                      <div>
                        <label className="mgr-miniLabel">Tiêu đề công việc *</label>
                        <input className="mgr-search" style={{ width: '100%', color: 'var(--mgr-text)' }} placeholder="VD: Sắm lễ cúng Rằm tháng 7" value={taskData.title} onChange={e => setTaskData({...taskData, title: e.target.value})} required />
                      </div>
                      <div>
                        <label className="mgr-miniLabel">Mô tả chi tiết</label>
                        <textarea className="mgr-search" style={{ width: '100%', height: '80px', color: 'var(--mgr-text)' }} value={taskData.description} onChange={e => setTaskData({...taskData, description: e.target.value})} />
                      </div>
                      <div>
                        <label className="mgr-miniLabel">Hạn chót</label>
                        <input className="mgr-search" type="date" style={{ width: '100%', color: 'var(--mgr-text)' }} value={taskData.due_date} onChange={e => setTaskData({...taskData, due_date: e.target.value})} />
                      </div>
                      <button className="mgr-btnPrimary" type="submit" style={{ padding: '12px', background: '#8b5cf6' }}>🚀 Phân công ngay</button>
                  </form>
              </div>

              <div className="mgr-panel" style={{ backgroundColor: '#fafbfc' }}>
                  <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: '#1d2b44' }}>Lịch sử phân công</div>
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
                      {allTasks.length === 0 ? (
                        <div className="mgr-empty" style={{ padding: '30px', background: '#fff' }}>Chưa có công việc nào.</div>
                      ) : (
                        allTasks.map(t => (
                            <div key={t.id} style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--mgr-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <div style={{ fontWeight: 'bold', color: '#1d2b44' }}>{t.title}</div>
                                  <span style={{ padding: '4px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold', background: t.status === 'completed' ? '#d4edda' : t.status === 'in_progress' ? '#dbeafe' : '#fff3cd', color: t.status === 'completed' ? '#155724' : t.status === 'in_progress' ? '#1d4ed8' : '#856404' }}>
                                    {t.status === 'completed' ? 'Đã xong' : t.status === 'in_progress' ? 'Đang làm' : 'Đã giao'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--mgr-muted)' }}>👤 Người nhận: <b>{t.member_name || `${t.surname || ''} ${t.first_name || ''}`}</b></div>
                                {t.description && <div style={{ fontSize: '0.9rem', color: 'var(--mgr-text)' }}>{t.description}</div>}
                                {t.due_date && <div style={{ fontSize: '0.85rem', color: '#dc3545' }}>⏰ Hạn chót: {new Date(t.due_date).toLocaleDateString('vi-VN')}</div>}
                                {t.completed_at && <div style={{ fontSize: '0.85rem', color: '#15803d' }}>✅ Hoàn thành lúc: {new Date(t.completed_at).toLocaleString('vi-VN')}</div>}
                            </div>
                        ))
                      )}
                  </div>
              </div>
          </section>
        )}

        {activeSection === "relationships" && (
          <section className="mgr-grid2">
            <div className="mgr-panel" style={{ display: 'flex', flexDirection: 'column', height: '650px' }}>
              <div className="mgr-panelTitle" style={{ fontSize: '1.2rem', color: '#e83e8c' }}>Danh bạ Gia tộc</div>
              <div style={{ marginTop: '15px', flex: 1, overflowY: 'auto', border: '1px solid var(--mgr-border)', borderRadius: '8px', padding: '10px', background: '#fff' }}>
                {filteredMembers.length === 0 ? ( <div className="mgr-empty">Không có dữ liệu</div> ) : (
                  filteredMembers.map(m => (
                    <div key={m.account_id} onClick={() => setSelectedRelPerson(m)} style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', backgroundColor: selectedRelPerson?.account_id === m.account_id ? '#fdf2f8' : 'transparent', borderLeft: selectedRelPerson?.account_id === m.account_id ? '4px solid #e83e8c' : '4px solid transparent', borderRadius: '4px', marginBottom: '4px' }}>
                      <div style={{ fontWeight: '600', color: selectedRelPerson?.account_id === m.account_id ? '#e83e8c' : '#1d2b44' }}>{m.surname} {m.middle_name || ''} {m.first_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--mgr-muted)', marginTop: '4px' }}>Đời thứ {m.generation || '?'} • Giới tính: {m.gender == '1' ? 'Nam' : m.gender == '2' ? 'Nữ' : 'Chưa rõ'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mgr-panel" style={{ backgroundColor: '#fafbfc', height: '650px', overflowY: 'auto' }}>
              {!selectedRelPerson ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--mgr-muted)' }}><div style={{ fontSize: '3rem', marginBottom: '15px' }}>👨‍👩‍👧‍👦</div><h3 style={{ color: '#1d2b44' }}>Chưa chọn thành viên</h3></div>
              ) : (
                <div>
                  <div style={{ textAlign: 'center', paddingBottom: '20px', borderBottom: '1px solid var(--mgr-border)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #e83e8c, #ff758c)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', margin: '0 auto 15px' }}>{selectedRelPerson.first_name?.charAt(0) || 'U'}</div>
                    <h2 style={{ color: '#1d2b44', margin: '0 0 5px 0' }}>{memberDisplayName(selectedRelPerson)}</h2>
                    <div style={{ color: 'var(--mgr-muted)', fontSize: '0.9rem' }}>Tài khoản #{selectedRelPerson.account_id} · Hồ sơ người (person_id) #{selectedRelPerson.person_id ?? "—"}</div>
                  </div>
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ color: 'var(--mgr-primary)', marginBottom: '15px', fontSize: '1rem' }}>Mạng lưới gia đình:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                        <div><div style={{ fontSize: '0.8rem', color: 'var(--mgr-muted)', fontWeight: 'bold' }}>NGƯỜI CHA</div><div style={{ color: '#1d2b44', fontWeight: '500' }}>{selectedRelPerson.parent_father_id ? `ID: ${selectedRelPerson.parent_father_id}` : 'Chưa có liên kết'}</div></div>
                        <button className="mgr-btnGhost" style={{ padding: '6px 12px', color: 'var(--mgr-text)' }} onClick={() => { setActiveSection("lineage"); setLinkData({...linkData, person_id: selectedRelPerson.account_id}); }}>Sửa</button>
                      </div>
                      <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                        <div><div style={{ fontSize: '0.8rem', color: 'var(--mgr-muted)', fontWeight: 'bold' }}>NGƯỜI MẸ</div><div style={{ color: '#1d2b44', fontWeight: '500' }}>{selectedRelPerson.parent_mother_id ? `ID: ${selectedRelPerson.parent_mother_id}` : 'Chưa có liên kết'}</div></div>
                        <button className="mgr-btnGhost" style={{ padding: '6px 12px', color: 'var(--mgr-text)' }} onClick={() => { setActiveSection("lineage"); setLinkData({...linkData, person_id: selectedRelPerson.account_id}); }}>Sửa</button>
                      </div>
                      <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                        <div><div style={{ fontSize: '0.8rem', color: 'var(--mgr-muted)', fontWeight: 'bold' }}>VỢ / CHỒNG</div><div style={{ color: '#1d2b44', fontWeight: '500' }}>{selectedRelPerson.spouse_id ? `ID: ${selectedRelPerson.spouse_id}` : 'Độc thân'}</div></div>
                        <button className="mgr-btnGhost" style={{ padding: '6px 12px', color: '#dc3545' }} onClick={() => { setActiveSection("lineage"); setLinkData({...linkData, person_id: selectedRelPerson.account_id}); }}>Hủy</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection === "moderation" && (
          <section>
            <div className="mgr-listHeader"><div><div className="mgr-listTitle" style={{ fontSize: '1.2rem', color: 'var(--mgr-primary)' }}>Kiểm duyệt nội dung</div></div></div>
            
            <h3 className="mgr-panelTitle" style={{ fontSize: "1.1rem", marginTop: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", color: 'var(--mgr-text)' }}>1. Cập nhật hồ sơ (Tiểu sử, Ảnh đại diện)</h3>
            <div className="mgr-list" style={{ marginTop: '15px' }}>
              {pendingProfiles.length === 0 ? ( <div className="mgr-empty">Không có yêu cầu cập nhật hồ sơ.</div> ) : (
                pendingProfiles.map((p) => (
                  <div className="mgr-panel" key={p.person_id} style={{ padding: '15px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#1d2b44' }}>{p.display_name}</div>
                      <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                          <div style={{ flex: 1, padding: "10px", background: "#f8fafc", borderRadius: "8px" }}>
                              <strong style={{color: 'var(--mgr-text)'}}>Hồ sơ cũ:</strong><br/>
                              <em style={{fontSize:"0.85rem", color: 'var(--mgr-muted)'}}>Bio:</em> <span style={{fontSize:"0.85rem", color: 'var(--mgr-text)'}}>{p.current_bio || 'Chưa có'}</span><br/>
                              <em style={{fontSize:"0.85rem", color: 'var(--mgr-muted)'}}>Ảnh:</em> <span style={{fontSize:"0.85rem", color: 'var(--mgr-text)'}}>{p.current_avatar_url || 'Chưa có'}</span>
                          </div>
                          <div style={{ flex: 1, padding: "10px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                              <strong style={{color: 'var(--mgr-text)'}}>Yêu cầu mới:</strong><br/>
                              <em style={{fontSize:"0.9rem", color: "#166534"}}>Bio:</em> <span style={{fontSize:"0.9rem", color: "#166534"}}>{p.pending_bio || 'Chưa có'}</span><br/>
                              <em style={{fontSize:"0.9rem", color: "#166534"}}>Ảnh:</em> <span style={{fontSize:"0.9rem", color: "#166534"}}>{p.pending_avatar_url || 'Chưa có'}</span>
                          </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                      <button className="mgr-btnPrimary" style={{background: '#28a745'}} onClick={() => doApproveProfile(p.person_id)}>Phê duyệt</button>
                      <button className="mgr-btnDanger" onClick={() => doRejectProfile(p.person_id)}>Từ chối</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <h3 className="mgr-panelTitle" style={{ fontSize: "1.1rem", marginTop: "30px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", color: 'var(--mgr-text)' }}>2. Tư liệu đóng góp (Hình ảnh, Lịch sử)</h3>
            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pendingPosts.map((post) => (
                <div key={post.post_id || post.id} className="mgr-panel" style={{ padding: '20px', display: 'flex', gap: '20px' }}>
                  <div style={{ width: '160px', height: '160px', borderRadius: '12px', backgroundColor: '#f0f4f8', overflow: 'hidden' }}>
                    {post.image_url ? ( <img src={post.image_url} alt="Post content" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> ) : ( <div style={{ textAlign: 'center', padding: '10px', color: 'var(--mgr-text)' }}>📷<br/>Chỉ có văn bản</div> )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ borderBottom: '1px solid var(--mgr-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <div><div style={{ fontWeight: 'bold', color: 'var(--mgr-text)' }}>{post.author_name}</div><div style={{ fontSize: '0.85rem', color: 'var(--mgr-muted)' }}>{post.author_email}</div></div>
                      <div style={{ fontSize: '0.85rem', textAlign: 'right', color: 'var(--mgr-text)' }}>🕒 {new Date(post.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                    <div style={{ flex: 1, marginTop: '10px', color: 'var(--mgr-text)' }}>{post.description || post.content ? `"${post.description || post.content}"` : <span>[Không có nội dung]</span>}</div>
                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                      <button className="mgr-btnPrimary" style={{ padding: '8px 16px' }} onClick={() => doApprovePost(post.post_id || post.id)}>✅ Phê duyệt hiển thị</button>
                      <button className="mgr-btnGhost" style={{ padding: '8px 16px', color: '#dc3545' }} onClick={() => doRejectPost(post.post_id || post.id)}>❌ Bỏ qua / Xóa</button>
                    </div>
                  </div>
                </div>
              ))}
              {!loading && pendingPosts.length === 0 && <div className="mgr-empty" style={{ padding: '40px' }}><div style={{ fontSize: '2rem' }}>🎉</div>Không có tư liệu nào chờ duyệt.</div>}
            </div>
          </section>
        )}

        {activeSection === "media" && (
          <section>
            <div className="mgr-listHeader">
              <div><div className="mgr-listTitle" style={{ fontSize: '1.2rem', color: '#2f9bff' }}>Kho lưu trữ số hóa (Media Gallery)</div></div>
            </div>
            <div className="mgr-panel" style={{ marginTop: '20px', background: 'linear-gradient(to bottom right, #f8fafc, #e0f2fe)', border: '2px dashed #bae6fd', textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📸</div>
              <h3 style={{ color: '#0369a1', margin: '0 0 10px 0' }}>Số hóa hình ảnh & Tài liệu (AI OCR)</h3>
              <input type="file" id="ai-upload" style={{ display: "none" }} accept="image/*" onChange={async (e) => { const file = e.target.files[0]; if (!file) return; alert("Đang chuẩn bị tải lên..."); }} />
              <label htmlFor="ai-upload" className="mgr-btnPrimary" style={{ display: "inline-block", cursor: "pointer", background: '#0284c7', padding: '12px 30px', borderRadius: '99px' }}>☁️ Chọn tệp tải lên</label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "25px", marginTop: "30px" }}>
              {mediaList.map((media) => (
                <div key={media.post_id} style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--mgr-border)" }}>
                  <div style={{ height: "220px", width: "100%", backgroundColor: '#f1f5f9' }}><img src={media.image_url} alt="Media" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                  <div style={{ padding: "15px", fontSize: "0.85rem" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "6px", color: 'var(--mgr-text)' }}>👤 {media.author_name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                      <span style={{color: 'var(--mgr-text)'}}>📅 {new Date(media.created_at).toLocaleDateString('vi-VN')}</span>
                      <button style={{ background: '#fee2e2', border: 'none', color: '#dc3545', cursor: 'pointer', borderRadius: '6px' }} onClick={() => alert("Chức năng xóa ảnh đang phát triển")}>Xóa</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!loading && mediaList.length === 0 && <div className="mgr-empty" style={{ padding: '60px' }}>Thư viện hiện đang trống</div>}
          </section>
        )}

        {activeSection === "archive" && (
          <section>
            <div className="mgr-listHeader">
              <div><div className="mgr-listTitle" style={{ fontSize: '1.2rem', color: '#9b1c1c' }}>Kho lưu trữ thành viên đã xóa khỏi cây</div></div>
            </div>
            <div className="mgr-list" style={{ marginTop: '15px' }}>
              {archivedMembers.length === 0 ? (
                <div className="mgr-empty">Chưa có thành viên trong kho lưu trữ.</div>
              ) : (
                archivedMembers.map((item) => (
                  <div key={item.id} className="mgr-panel" style={{ marginBottom: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--mgr-text)' }}>
                        {[item.surname, item.middle_name, item.first_name].filter(Boolean).join(" ") || item.email || `Bản ghi #${item.id}`}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--mgr-muted)' }}>
                        Account cũ: {item.account_id ?? "—"} | Clan: {item.clan_id ?? "—"} | Lưu lúc: {item.archived_at ? new Date(item.archived_at).toLocaleString('vi-VN') : "—"}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                        Lý do: {item.archived_reason || "Không có"}
                      </div>
                    </div>
                    <div>
                      <button className="mgr-btnPrimary" style={{ marginRight: 8 }} onClick={() => restoreArchived(item.id)}>
                        Phục hồi
                      </button>
                      <button className="mgr-btnDanger" onClick={() => removeArchivedPermanently(item.id)}>
                        Xóa vĩnh viễn
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {memberEditId ? (
        <div className="mgr-modalOverlay" role="presentation" onClick={() => !memberEditSaving && setMemberEditId(null)}>
          <div className="mgr-modal" role="dialog" aria-modal="true" aria-labelledby="mgr-member-edit-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mgr-modalClose" disabled={memberEditSaving} onClick={() => setMemberEditId(null)}>×</button>
            <h2 className="mgr-modalTitle" id="mgr-member-edit-title" style={{color: 'var(--mgr-text)'}}>Chỉnh sửa thành viên</h2>
            <p className="mgr-modalMeta">Tài khoản #{memberEditId}</p>

            {memberEditLoading ? (
              <div className="mgr-subtle">Đang tải dữ liệu…</div>
            ) : (
              <>
                <div className="mgr-modalSectionTitle">Tài khoản</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="email" placeholder="Email đăng nhập" value={memberEditForm.email} onChange={(e) => setMemberEditForm((p) => ({ ...p, email: e.target.value }))} />
                  <select className="mgr-field" style={{color: 'var(--mgr-text)'}} value={memberEditForm.status} onChange={(e) => setMemberEditForm((p) => ({ ...p, status: e.target.value }))}>
                    <option value="active">active</option><option value="pending">pending</option><option value="rejected">rejected</option>
                  </select>
                    {(sessionRoleId === 1 || sessionRoleId === 2) && (
                      <select className="mgr-field" style={{color: 'var(--mgr-text)'}} value={memberEditForm.role_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, role_id: e.target.value }))}><option value="3">Member</option><option value="2">Manager</option></select>
                    )}
                    {sessionRoleId === 1 && (
                      <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="number" placeholder="clan_id (dòng họ)" value={memberEditForm.clan_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, clan_id: e.target.value }))} />
                    )}
                  <input className="mgr-field" style={{ gridColumn: "1 / -1", color: 'var(--mgr-text)' }} type="password" placeholder="Mật khẩu mới (để trống nếu không đổi)" value={memberEditForm.new_password} onChange={(e) => setMemberEditForm((p) => ({ ...p, new_password: e.target.value }))} autoComplete="new-password" />
                </div>

                <div className="mgr-modalSectionTitle">Hồ sơ người (people)</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} placeholder="Họ" value={memberEditForm.surname} onChange={(e) => setMemberEditForm((p) => ({ ...p, surname: e.target.value }))} />
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} placeholder="Tên đệm" value={memberEditForm.middle_name} onChange={(e) => setMemberEditForm((p) => ({ ...p, middle_name: e.target.value }))} />
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} placeholder="Tên" value={memberEditForm.first_name} onChange={(e) => setMemberEditForm((p) => ({ ...p, first_name: e.target.value }))} />
                  <select className="mgr-field" style={{color: 'var(--mgr-text)'}} value={memberEditForm.gender} onChange={(e) => setMemberEditForm((p) => ({ ...p, gender: e.target.value }))}><option value="1">Nam</option><option value="2">Nữ</option><option value="">Không khai báo</option></select>
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="date" value={memberEditForm.birth_date} onChange={(e) => setMemberEditForm((p) => ({ ...p, birth_date: e.target.value }))} />
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="date" placeholder="Ngày mất" value={memberEditForm.death_date} onChange={(e) => setMemberEditForm((p) => ({ ...p, death_date: e.target.value }))} />
                  <select className="mgr-field" style={{color: 'var(--mgr-text)'}} value={memberEditForm.is_living} onChange={(e) => setMemberEditForm((p) => ({ ...p, is_living: e.target.value }))}><option value="1">Còn sống</option><option value="0">Đã mất</option></select>
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="number" min={1} placeholder="Đời" value={memberEditForm.generation} onChange={(e) => setMemberEditForm((p) => ({ ...p, generation: e.target.value }))} />
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="number" placeholder="Chi (branch)" value={memberEditForm.branch} onChange={(e) => setMemberEditForm((p) => ({ ...p, branch: e.target.value }))} />
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} placeholder="Quê quán" value={memberEditForm.hometown} onChange={(e) => setMemberEditForm((p) => ({ ...p, hometown: e.target.value }))} />
                  <input className="mgr-field" style={{ gridColumn: "1 / -1", color: 'var(--mgr-text)' }} placeholder="Địa chỉ" value={memberEditForm.address} onChange={(e) => setMemberEditForm((p) => ({ ...p, address: e.target.value }))} />
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} placeholder="Điện thoại" value={memberEditForm.phone} onChange={(e) => setMemberEditForm((p) => ({ ...p, phone: e.target.value }))} />
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="email" placeholder="Email phụ" value={memberEditForm.people_email} onChange={(e) => setMemberEditForm((p) => ({ ...p, people_email: e.target.value }))} />
                  <div style={{ gridColumn: "1 / -1", margin: "10px 0" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#666" }}>Cập nhật ảnh qua kéo thả:</label>
                    <ImageUpload onUploadSuccess={(url) => setMemberEditForm((p) => ({ ...p, avatar_url: url }))} label="Kéo thả ảnh vào đây để thay đổi" />
                  </div>
                  <input className="mgr-field" style={{ gridColumn: "1 / -1", color: 'var(--mgr-text)' }} placeholder="Hoặc nhập URL ảnh đại diện trực tiếp" value={memberEditForm.avatar_url} onChange={(e) => setMemberEditForm((p) => ({ ...p, avatar_url: e.target.value }))} />
                  <textarea className="mgr-field mgr-fieldTextarea" style={{ gridColumn: "1 / -1", color: 'var(--mgr-text)' }} placeholder="Giới thiệu (bio)" rows={2} value={memberEditForm.bio} onChange={(e) => setMemberEditForm((p) => ({ ...p, bio: e.target.value }))} />
                </div>

                <div className="mgr-modalSectionTitle">Quan hệ huyết thống</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="number" placeholder="ID cha (people.id)" value={memberEditForm.parent_father_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, parent_father_id: e.target.value }))} />
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="number" placeholder="ID mẹ (people.id)" value={memberEditForm.parent_mother_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, parent_mother_id: e.target.value }))} />
                </div>

                <div className="mgr-modalSectionTitle">Quan hệ hôn nhân</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="number" placeholder="ID families (tùy chọn)" value={memberEditForm.family_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, family_id: e.target.value }))} />
                  <input className="mgr-field" style={{color: 'var(--mgr-text)'}} type="number" placeholder="ID vợ/chồng (people.id)" value={memberEditForm.spouse_id} onChange={(e) => setMemberEditForm((p) => ({ ...p, spouse_id: e.target.value }))} />
                  <input className="mgr-field" style={{ gridColumn: "1 / -1", color: 'var(--mgr-text)' }} placeholder="ID con (people.id, cách nhau dấu phẩy)" value={memberEditForm.children_ids} onChange={(e) => setMemberEditForm((p) => ({ ...p, children_ids: e.target.value }))} />
                </div>

                {memberEditMsg && <div className={memberEditMsg.includes("thành công") || memberEditMsg.includes("Đã lưu") ? "mgr-subtle" : "mgr-alert"} style={{ marginTop: 12 }}>{memberEditMsg}</div>}

                <div className="mgr-modalActions" style={{ marginTop: '20px' }}>
                  <button className="mgr-btnPrimary" type="button" disabled={memberEditSaving} onClick={saveMemberEdit}>{memberEditSaving ? "Đang lưu…" : "Lưu thay đổi"}</button>
                  <button className="mgr-btnDanger" type="button" disabled={memberEditSaving} onClick={archiveCurrentMember}>Xóa khỏi cây (lưu trữ)</button>
                  <button className="mgr-btnGhost" style={{color: 'var(--mgr-text)'}} type="button" disabled={memberEditSaving} onClick={() => setMemberEditId(null)}>Đóng</button>
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
