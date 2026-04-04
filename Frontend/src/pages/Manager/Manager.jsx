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
  getPendingProfileUpdates,
  approveProfileUpdateAPI,
  rejectProfileUpdateAPI,
} from "../../api/managerService";
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
  const [stats, setStats] = useState({
    total_members: 0,
    total_managers: 0,
    total_pending: 0,
  });
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sessionRoleId = readSessionUser().role_id;
  const [overviewCreate, setOverviewCreate] = useState({
    email: "",
    password: "",
    surname: "",
    middle_name: "",
    first_name: "",
    gender: "1",
    birth_date: "",
    hometown: "",
    generation: "1",
    clan_id: "",
  });
  const [overviewCreateMsg, setOverviewCreateMsg] = useState("");
  const [overviewCreateSaving, setOverviewCreateSaving] = useState(false);

  const [managerMeta, setManagerMeta] = useState({ person_id: null, role_id: null });
  const [overviewAccount, setOverviewAccount] = useState({
    email: "",
    surname: "",
    middle_name: "",
    first_name: "",
    hometown: "",
    generation: "",
  });
  const [overviewPassword, setOverviewPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
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

  const [lineageAccountId, setLineageAccountId] = useState("");
  const [relationMode, setRelationMode] = useState("bloodline");
  const [bloodlineForm, setBloodlineForm] = useState({ parent_father_id: "", parent_mother_id: "" });
  const [marriageForm, setMarriageForm] = useState({ family_id: "", spouse_id: "", children_ids: "" });
  const [lineageLoading, setLineageLoading] = useState(false);
  const [lineageSaving, setLineageSaving] = useState(false);
  const [lineageMsg, setLineageMsg] = useState("");

  const loadAll = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setLoading(true);
    setError("");
    try {
      const [statsData, membersData, pendingData, postsData, profilesData, mediaData] = await Promise.all([
        getStats(),
        getMembers(),
        getPendingUsers(),
        getPendingPosts(),
        getPendingProfileUpdates(),
        getMediaAPI()
      ]);
      setStats(statsData);
      setMembers(membersData);
      setPending(pendingData);
      setPendingPosts(postsData);
      setPendingProfiles(profilesData);
      setMediaList(mediaData);
    } catch (e) {
      if (!silent) setError(e?.message || "Không thể tải dữ liệu manager");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Background Polling every 10 seconds for perceived real-time
  useEffect(() => {
    const interval = setInterval(() => {
      loadAll({ silent: true });
    }, 10000);
    return () => clearInterval(interval);
  }, [loadAll]);

  useEffect(() => {
    if (!memberEditId) {
      setMemberEditForm(emptyMemberEditForm());
      return;
    }
    let cancelled = false;
    (async () => {
      setMemberEditLoading(true);
      setMemberEditMsg("");
      try {
        const data = await getMemberDetail(memberEditId);
        if (cancelled) return;
        setMemberEditForm(mapMemberToForm(data.member));
      } catch (e) {
        if (!cancelled) setMemberEditMsg(e?.message || "Không tải được chi tiết thành viên");
      } finally {
        if (!cancelled) setMemberEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberEditId]);

  const saveMemberEdit = async () => {
    if (!memberEditId) return;
    setMemberEditSaving(true);
    setMemberEditMsg("");
    try {
      const f = memberEditForm;
      const payload = {
        email: f.email.trim(),
        status: f.status,
        surname: f.surname,
        middle_name: f.middle_name,
        first_name: f.first_name,
        gender: f.gender === "" ? null : Number(f.gender),
        birth_date: f.birth_date || null,
        death_date: f.death_date || null,
        is_living: f.is_living === "1",
        generation: Number(f.generation) || 1,
        branch: f.branch.trim() === "" ? null : Number(f.branch),
        hometown: f.hometown,
        address: f.address,
        phone: f.phone,
        people_email: f.people_email,
        zalo: f.zalo,
        facebook: f.facebook,
        avatar_url: f.avatar_url.trim() === "" ? null : f.avatar_url.trim(),
        bio: f.bio,
        note: f.note,
        children_ids:
          f.children_ids.trim() === ""
            ? []
            : f.children_ids
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n)),
      };
      if (f.new_password.trim()) payload.new_password = f.new_password.trim();
      if (sessionRoleId === 1) {
        payload.role_id = Number(f.role_id);
        if (f.clan_id.trim() !== "") payload.clan_id = Number(f.clan_id);
      }
      const fid = f.family_id.trim();
      const sid = f.spouse_id.trim();
      if (fid !== "") payload.family_id = Number(fid);
      if (sid !== "") payload.spouse_id = Number(sid);
      const pf = f.parent_father_id.trim();
      const pm = f.parent_mother_id.trim();
      if (pf !== "" || pm !== "") {
        payload.parent_father_id = pf === "" ? null : Number(pf);
        payload.parent_mother_id = pm === "" ? null : Number(pm);
      }
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

  const loadOverviewProfile = useCallback(async () => {
    setOverviewAccountLoading(true);
    setOverviewAccountMsg("");
    try {
      const dash = await getMemberDashboard();
      const p = dash.profile || {};
      setManagerMeta({ person_id: p.person_id ?? null, role_id: p.role_id ?? null });
      setOverviewAccount({
        email: p.email || "",
        surname: p.surname ?? "",
        middle_name: p.middle_name ?? "",
        first_name: p.first_name ?? "",
        hometown: p.hometown || "",
        generation: p.generation ?? "",
      });
      setProfileContentForm({
        bio: p.pending_bio !== null ? (p.pending_bio || "") : (p.bio || ""),
        avatar_url: p.pending_avatar_url !== null ? (p.pending_avatar_url || "") : (p.avatar_url || ""),
      });
      setProfileStatus(p.moderation_status || "none");
    } catch (e) {
      setOverviewAccountMsg(
        e?.message || "Không tải được hồ sơ (tài khoản có thể chưa gắn người trong phả hệ — chỉ chỉnh được khi có person_id)."
      );
      setManagerMeta({ person_id: null, role_id: readSessionUser().role_id ?? null });
    } finally {
      setOverviewAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== "overview") return;
    loadOverviewProfile();
  }, [activeSection, loadOverviewProfile]);

  const submitOverviewCreateMember = async () => {
    setOverviewCreateMsg("");
    setOverviewCreateSaving(true);
    try {
      const payload = {
        email: overviewCreate.email.trim(),
        password: overviewCreate.password,
        surname: overviewCreate.surname.trim(),
        middle_name: overviewCreate.middle_name.trim(),
        first_name: overviewCreate.first_name.trim(),
        gender: overviewCreate.gender === "" ? null : Number(overviewCreate.gender),
        birth_date: overviewCreate.birth_date.trim() || null,
        hometown: overviewCreate.hometown.trim(),
        generation:
          overviewCreate.generation.trim() === "" ? 1 : Number(overviewCreate.generation),
      };
      if (sessionRoleId === 1) {
        const cid = Number(overviewCreate.clan_id);
        if (!Number.isFinite(cid)) {
          setOverviewCreateMsg("Admin cần nhập mã dòng họ (clan_id).");
          return;
        }
        payload.clan_id = cid;
      }
      await createMember(payload);
      setOverviewCreateMsg("Đã tạo thành viên và kích hoạt tài khoản.");
      setOverviewCreate((p) => ({
        ...p,
        email: "",
        password: "",
        surname: "",
        middle_name: "",
        first_name: "",
        birth_date: "",
        hometown: "",
      }));
      await loadAll();
    } catch (e) {
      setOverviewCreateMsg(e?.message || "Không thể tạo thành viên");
    } finally {
      setOverviewCreateSaving(false);
    }
  };

  const saveOverviewAccount = async () => {
    setOverviewAccountMsg("");
    if (managerMeta.person_id == null) {
      setOverviewAccountMsg("Tài khoản chưa liên kết hồ sơ người (person) — không thể lưu qua API này.");
      return;
    }
    const genRaw = String(overviewAccount.generation).trim();
    const genNum = genRaw === "" ? null : Number(genRaw);
    if (genRaw !== "" && !Number.isFinite(genNum)) {
      setOverviewAccountMsg("Đời (generation) phải là số hợp lệ hoặc để trống.");
      return;
    }
    setOverviewAccountSaving(true);
    try {
      await updateMemberProfile({
        surname: overviewAccount.surname,
        middle_name: overviewAccount.middle_name,
        first_name: overviewAccount.first_name,
        email: overviewAccount.email,
        hometown: overviewAccount.hometown,
        generation: genNum,
      });
      const prev = readSessionUser();
      const merged = {
        ...prev,
        name:
          [overviewAccount.surname, overviewAccount.middle_name, overviewAccount.first_name]
            .filter(Boolean)
            .join(" ")
            .trim() || prev.name,
        email: overviewAccount.email.trim() || prev.email,
        hometown: overviewAccount.hometown || prev.hometown,
      };
      localStorage.setItem("user", JSON.stringify(merged));
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
    if (overviewPassword.next !== overviewPassword.confirm) {
      setOverviewAccountMsg("Mật khẩu mới và nhập lại không khớp.");
      return;
    }
    if (overviewPassword.next.length < 6) {
      setOverviewAccountMsg("Mật khẩu mới cần ít nhất 6 ký tự.");
      return;
    }
    setOverviewPasswordSaving(true);
    try {
      await changeMemberPassword({
        current_password: overviewPassword.current,
        new_password: overviewPassword.next,
      });
      setOverviewPassword({ current: "", next: "", confirm: "" });
      setOverviewAccountMsg("Đã đổi mật khẩu thành công.");
    } catch (e) {
      setOverviewAccountMsg(e?.message || "Không thể đổi mật khẩu");
    } finally {
      setOverviewPasswordSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const loadLineageRelations = useCallback(async (accountId) => {
    if (!accountId) return;
    setLineageLoading(true);
    setLineageMsg("");
    try {
      const data = await getMemberRelations(accountId);
      if (data.bloodline) {
        setBloodlineForm({
          parent_father_id: data.bloodline.parent_father_id ?? "",
          parent_mother_id: data.bloodline.parent_mother_id ?? "",
        });
      } else {
        setBloodlineForm({ parent_father_id: "", parent_mother_id: "" });
      }
      const m = data.marriage || {};
      setMarriageForm({
        family_id: m.family_id ?? "",
        spouse_id: m.spouse_id ?? "",
        children_ids: Array.isArray(m.children_ids) ? m.children_ids.join(", ") : "",
      });
    } catch (e) {
      setLineageMsg(e?.message || "Không thể tải quan hệ");
    } finally {
      setLineageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== "lineage" || !lineageAccountId) return;
    loadLineageRelations(Number(lineageAccountId));
  }, [activeSection, lineageAccountId, loadLineageRelations]);

  const saveLineageRelations = async () => {
    const id = Number(lineageAccountId);
    if (!Number.isFinite(id)) {
      setLineageMsg("Vui lòng chọn thành viên.");
      return;
    }
    setLineageSaving(true);
    setLineageMsg("");
    try {
      if (relationMode === "bloodline") {
        const pf = String(bloodlineForm.parent_father_id).trim();
        const pm = String(bloodlineForm.parent_mother_id).trim();
        await updateMemberRelations(id, {
          mode: "bloodline",
          parent_father_id: pf === "" ? null : Number(pf),
          parent_mother_id: pm === "" ? null : Number(pm),
        });
      } else {
        const payload = { mode: "marriage" };
        const fid = String(marriageForm.family_id).trim();
        const sid = String(marriageForm.spouse_id).trim();
        const kids = String(marriageForm.children_ids).trim();
        if (fid !== "") payload.family_id = Number(fid);
        if (sid !== "") payload.spouse_id = Number(sid);
        if (kids !== "") {
          payload.children_ids = kids
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n));
        }
        await updateMemberRelations(id, payload);
      }
      setLineageMsg("Đã lưu quan hệ vào cơ sở dữ liệu.");
      await loadLineageRelations(id);
    } catch (e) {
      setLineageMsg(e?.message || "Không thể lưu quan hệ");
    } finally {
      setLineageSaving(false);
    }
  };

  const doApprove = async (id) => {
    await approveUserAPI(id);
    await loadAll();
  };

  const doReject = async (id) => {
    await rejectUserAPI(id);
    await loadAll();
  };

  const doApprovePost = async (id) => {
    await approvePostAPI(id);
    await loadAll();
  };

  const doRejectPost = async (id) => {
    const reason = window.prompt("Lý do từ chối bài viết:");
    if (reason === null) return;
    await rejectPostAPI(id, reason || "Không đạt yêu cầu");
    await loadAll();
  };

  const doApproveProfile = async (id) => {
    await approveProfileUpdateAPI(id);
    await loadAll();
  };

  const doRejectProfile = async (id) => {
    const reason = window.prompt("Nhập lý do từ chối cập nhật hồ sơ:");
    if (reason === null) return;
    await rejectProfileUpdateAPI(id, reason || "Không có lý do rõ ràng");
    await loadAll();
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
      case "overview":
        return "Tổng quan";
      case "members":
        return "Danh sách thành viên";
      case "approvals":
        return "Duyệt tài khoản";
      case "lineage":
        return "Lineage Management";
      case "relationships":
        return "Duy trì mối quan hệ";
      case "moderation":
        return "Content Moderation";
      case "media":
        return "Media Management";
      default:
        return "Quản lý";
    }
  }, [activeSection]);

  return (
    <div className="mgr-shell">
      <aside className="mgr-sidebar">
        <div className="mgr-brand">
          <div className="mgr-logo" aria-hidden="true">
            G
          </div>
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
          <button
            className={`mgr-navItem ${activeSection === "overview" ? "isActive" : ""}`}
            onClick={() => setActiveSection("overview")}
          >
            Tổng quan
          </button>
          <button
            className={`mgr-navItem ${activeSection === "members" ? "isActive" : ""}`}
            onClick={() => setActiveSection("members")}
          >
            Danh sách
          </button>
          <button
            className={`mgr-navItem ${activeSection === "approvals" ? "isActive" : ""}`}
            onClick={() => setActiveSection("approvals")}
          >
            Duyệt tài khoản
          </button>
          <div className="mgr-navDivider" />
          <button
            className={`mgr-navItem ${activeSection === "lineage" ? "isActive" : ""}`}
            onClick={() => setActiveSection("lineage")}
          >
            Lineage Management
          </button>
          <button
            className={`mgr-navItem ${activeSection === "relationships" ? "isActive" : ""}`}
            onClick={() => setActiveSection("relationships")}
          >
            Duy trì mối quan hệ
          </button>
          <button
            className={`mgr-navItem ${activeSection === "moderation" ? "isActive" : ""}`}
            onClick={() => setActiveSection("moderation")}
          >
            Content Moderation
          </button>
          <button
            className={`mgr-navItem ${activeSection === "media" ? "isActive" : ""}`}
            onClick={() => setActiveSection("media")}
          >
            Media Management
          </button>
        </nav>
      </aside>

      <main className="mgr-main">
        <div className="mgr-topbar">
          <div className="mgr-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm thành viên…"
              aria-label="Tìm kiếm thành viên"
            />
          </div>
          <div className="mgr-topActions">
            <button className="mgr-pill" type="button" onClick={() => setShowAccountModal(true)}>
              Tài khoản
            </button>
            <button className="mgr-iconBtn" type="button" onClick={loadAll} title="Tải lại">
              ↻
            </button>
            <button className="mgr-btnGhost mgr-logoutBtn" type="button" onClick={logout} title="Đăng xuất">
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Manager Account Modal (Using the same premium style as member dashboard) */}
        {showAccountModal && (
          <div className="usr-modalOverlay" onClick={() => setShowAccountModal(false)}>
            <div className="usr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="usr-modalHeader">
                <h2 className="usr-modalTitle">Tài khoản Quản lý</h2>
                <button className="usr-modalClose" onClick={() => setShowAccountModal(false)}>&times;</button>
              </div>
              <div className="usr-modalBody">
                <div className="usr-accountModal-avatarSection">
                  <div className="usr-accountModal-avatarLabel">Ảnh hồ sơ</div>
                  <ImageUpload 
                    onUploadSuccess={(url) => setProfileContentForm(p => ({ ...p, avatar_url: url }))} 
                    label="Tải ảnh hoặc dán URL" 
                  />
                  {(profileStatus === 'pending') && <span className="status-pill pending">Đang chờ duyệt cập nhật hồ sơ</span>}
                </div>

                <div className="usr-accountModal-sectionTitle">Thông tin cá nhân</div>
                <div className="usr-accountModal-grid">
                  <input className="usr-input" value={overviewAccount.surname} onChange={(e) => setOverviewAccount(p => ({ ...p, surname: e.target.value }))} placeholder="Họ" />
                  <input className="usr-input" value={overviewAccount.middle_name} onChange={(e) => setOverviewAccount(p => ({ ...p, middle_name: e.target.value }))} placeholder="Tên đệm" />
                  <input className="usr-input" value={overviewAccount.first_name} onChange={(e) => setOverviewAccount(p => ({ ...p, first_name: e.target.value }))} placeholder="Tên" />
                  <input className="usr-input" value={overviewAccount.email} onChange={(e) => setOverviewAccount(p => ({ ...p, email: e.target.value }))} placeholder="Email" />
                  <div className="usr-accountModal-full">
                    <input className="usr-input" style={{ width: '100%' }} value={overviewAccount.hometown} onChange={(e) => setOverviewAccount(p => ({ ...p, hometown: e.target.value }))} placeholder="Quê quán" />
                  </div>
                  <div className="usr-accountModal-full">
                    <textarea className="usr-textarea" value={profileContentForm.bio} onChange={e => setProfileContentForm(prev => ({ ...prev, bio: e.target.value }))} placeholder="Tiểu sử / Giới thiệu..." rows="3" />
                  </div>
                  <div className="usr-accountModal-full" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button className="usr-btnPrimary" style={{ flex: 1, height: '40px' }} onClick={saveOverviewAccount} disabled={overviewAccountSaving || managerMeta.person_id == null}>Lưu thông tin cơ bản</button>
                    {/* Quản lý cập nhật avatar cho chính mình (vẫn qua moderation nếu cần) */}
                    <button className="usr-btnPrimary" style={{ flex: 1, height: '40px', background: '#4a148c' }} 
                      onClick={async () => {
                         try {
                           const { proposeProfileUpdate } = await import("../../api/memberService");
                           await proposeProfileUpdate(profileContentForm);
                           alert("Đã gửi yêu cầu cập nhật hồ sơ!");
                           loadOverviewProfile();
                         } catch (e) {
                           setOverviewAccountMsg(e?.message || "Lỗi cập nhật hồ sơ");
                         }
                      }} 
                      disabled={profileStatus === 'pending' || managerMeta.person_id == null}>
                      Cập nhật Ảnh & Bio
                    </button>
                  </div>
                </div>

                <div className="usr-accountModal-sectionTitle">Đổi mật khẩu</div>
                <div className="usr-accountModal-grid">
                  <input className="usr-input" type="password" value={overviewPassword.current} onChange={e => setOverviewPassword(p => ({ ...p, current: e.target.value }))} placeholder="Mật khẩu hiện tại" />
                  <input className="usr-input" type="password" value={overviewPassword.next} onChange={e => setOverviewPassword(p => ({ ...p, next: e.target.value }))} placeholder="Mật khẩu mới" />
                  <div className="usr-accountModal-full">
                    <input className="usr-input" style={{ width: '100%' }} type="password" value={overviewPassword.confirm} onChange={e => setOverviewPassword(p => ({ ...p, confirm: e.target.value }))} placeholder="Xác nhận mật khẩu mới" />
                  </div>
                  <div className="usr-accountModal-full">
                    <button className="usr-btnPrimary" style={{ width: '100%', height: '40px' }} onClick={saveOverviewPassword} disabled={overviewPasswordSaving}>
                      {overviewPasswordSaving ? "Đang lưu..." : "Đổi mật khẩu"}
                    </button>
                  </div>
                </div>

                {overviewAccountMsg && <div className={`mgr-alert ${overviewAccountMsg.includes('Lỗi') ? 'mgr-alert--danger' : ''}`}>{overviewAccountMsg}</div>}

                <div className="usr-accountModal-footer">
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Vai trò: <strong>Manager</strong></span>
                  <button className="usr-btnDanger" onClick={logout}>Đăng xuất tài khoản</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="mgr-hero" aria-label="Banner">
          <div className="mgr-heroOverlay" />
          <div className="mgr-heroContent">
            <div className="mgr-heroKicker">Phần mềm Gia phả AI</div>
            <div className="mgr-heroTitle">Bảng điều khiển Manager</div>
            <div className="mgr-heroDesc">
              Quản lý dữ liệu gia phả, mối quan hệ nhiều thế hệ, kiểm duyệt nội dung và hồ sơ đa phương tiện.
            </div>
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

        {activeSection === "overview" ? (
          <section className="mgr-grid2">
            <div className="mgr-panel mgr-panel--wide">
              <div className="mgr-panelTitle">Tạo thành viên mới</div>
              <div className="mgr-panelText">
                Thêm tài khoản Member (đã kích hoạt) vào đúng dòng họ của bạn. Thành viên có thể đăng nhập bằng email và mật
                khẩu bạn đặt. Sau đó có thể chỉnh quan hệ tại mục Lineage Management.
              </div>
              <div className="mgr-overviewFormGrid">
                <input
                  className="mgr-field"
                  type="email"
                  placeholder="Email đăng nhập *"
                  value={overviewCreate.email}
                  onChange={(e) => setOverviewCreate((p) => ({ ...p, email: e.target.value }))}
                  autoComplete="off"
                />
                <input
                  className="mgr-field"
                  type="password"
                  placeholder="Mật khẩu (≥6 ký tự) *"
                  value={overviewCreate.password}
                  onChange={(e) => setOverviewCreate((p) => ({ ...p, password: e.target.value }))}
                  autoComplete="new-password"
                />
                <input
                  className="mgr-field"
                  placeholder="Họ *"
                  value={overviewCreate.surname}
                  onChange={(e) => setOverviewCreate((p) => ({ ...p, surname: e.target.value }))}
                />
                <input
                  className="mgr-field"
                  placeholder="Tên đệm"
                  value={overviewCreate.middle_name}
                  onChange={(e) => setOverviewCreate((p) => ({ ...p, middle_name: e.target.value }))}
                />
                <input
                  className="mgr-field"
                  placeholder="Tên *"
                  value={overviewCreate.first_name}
                  onChange={(e) => setOverviewCreate((p) => ({ ...p, first_name: e.target.value }))}
                />
                <select
                  className="mgr-field"
                  value={overviewCreate.gender}
                  onChange={(e) => setOverviewCreate((p) => ({ ...p, gender: e.target.value }))}
                >
                  <option value="1">Nam</option>
                  <option value="2">Nữ</option>
                  <option value="">Không khai báo</option>
                </select>
                <input
                  className="mgr-field"
                  type="date"
                  value={overviewCreate.birth_date}
                  onChange={(e) => setOverviewCreate((p) => ({ ...p, birth_date: e.target.value }))}
                />
                <input
                  className="mgr-field"
                  type="number"
                  min={1}
                  placeholder="Đời (generation)"
                  value={overviewCreate.generation}
                  onChange={(e) => setOverviewCreate((p) => ({ ...p, generation: e.target.value }))}
                />
                <input
                  className="mgr-field"
                  style={{ gridColumn: sessionRoleId === 1 ? "span 1" : "1 / -1" }}
                  placeholder="Quê quán"
                  value={overviewCreate.hometown}
                  onChange={(e) => setOverviewCreate((p) => ({ ...p, hometown: e.target.value }))}
                />
                {sessionRoleId === 1 ? (
                  <input
                    className="mgr-field"
                    type="number"
                    placeholder="Mã dòng họ (clan_id) *"
                    value={overviewCreate.clan_id}
                    onChange={(e) => setOverviewCreate((p) => ({ ...p, clan_id: e.target.value }))}
                  />
                ) : null}
              </div>
              {overviewCreateMsg ? (
                <div className={overviewCreateMsg.startsWith("Đã ") ? "mgr-subtle" : "mgr-alert"} style={{ marginTop: 10 }}>
                  {overviewCreateMsg}
                </div>
              ) : null}
              <div className="mgr-panelActions" style={{ marginTop: 12 }}>
                <button
                  className="mgr-btnPrimary"
                  type="button"
                  disabled={overviewCreateSaving}
                  onClick={submitOverviewCreateMember}
                >
                  {overviewCreateSaving ? "Đang tạo…" : "Tạo thành viên"}
                </button>
                <button className="mgr-btnGhost" type="button" onClick={() => setActiveSection("lineage")}>
                  Liên kết quan hệ (Lineage)
                </button>
              </div>
            </div>

            <div className="mgr-panel mgr-panel--wide">
              <div className="mgr-panelTitle">Thông tin tài khoản của bạn</div>
              <div className="mgr-panelText">
                Chỉnh họ tên, email, quê quán, đời — cùng API với trang thành viên. Đổi mật khẩu cần nhập đúng mật khẩu hiện
                tại.
              </div>
              {overviewAccountLoading ? <div className="mgr-subtle">Đang tải hồ sơ…</div> : null}
              <div className="mgr-overviewFormGrid" style={{ marginTop: 10 }}>
                <input
                  className="mgr-field"
                  type="email"
                  placeholder="Email"
                  value={overviewAccount.email}
                  onChange={(e) => setOverviewAccount((p) => ({ ...p, email: e.target.value }))}
                  disabled={managerMeta.person_id == null}
                />
                <input
                  className="mgr-field"
                  placeholder="Họ"
                  value={overviewAccount.surname}
                  onChange={(e) => setOverviewAccount((p) => ({ ...p, surname: e.target.value }))}
                  disabled={managerMeta.person_id == null}
                />
                <input
                  className="mgr-field"
                  placeholder="Tên đệm"
                  value={overviewAccount.middle_name}
                  onChange={(e) => setOverviewAccount((p) => ({ ...p, middle_name: e.target.value }))}
                  disabled={managerMeta.person_id == null}
                />
                <input
                  className="mgr-field"
                  placeholder="Tên"
                  value={overviewAccount.first_name}
                  onChange={(e) => setOverviewAccount((p) => ({ ...p, first_name: e.target.value }))}
                  disabled={managerMeta.person_id == null}
                />
                <input
                  className="mgr-field"
                  placeholder="Quê quán"
                  value={overviewAccount.hometown}
                  onChange={(e) => setOverviewAccount((p) => ({ ...p, hometown: e.target.value }))}
                  disabled={managerMeta.person_id == null}
                />
                <input
                  className="mgr-field"
                  type="number"
                  min={1}
                  placeholder="Đời"
                  value={overviewAccount.generation}
                  onChange={(e) => setOverviewAccount((p) => ({ ...p, generation: e.target.value }))}
                  disabled={managerMeta.person_id == null}
                />
              </div>
              <div className="mgr-panelActions">
                <button
                  className="mgr-btnPrimary"
                  type="button"
                  disabled={overviewAccountSaving || managerMeta.person_id == null}
                  onClick={saveOverviewAccount}
                >
                  {overviewAccountSaving ? "Đang lưu…" : "Lưu hồ sơ"}
                </button>
                <button className="mgr-btnGhost" type="button" onClick={loadOverviewProfile} disabled={overviewAccountLoading}>
                  Tải lại hồ sơ
                </button>
              </div>
              <div className="mgr-panelTitle" style={{ marginTop: 18, fontSize: "0.95rem" }}>
                Đổi mật khẩu
              </div>
              <div className="mgr-overviewFormGrid">
                <input
                  className="mgr-field"
                  type="password"
                  placeholder="Mật khẩu hiện tại"
                  value={overviewPassword.current}
                  onChange={(e) => setOverviewPassword((p) => ({ ...p, current: e.target.value }))}
                  autoComplete="current-password"
                />
                <input
                  className="mgr-field"
                  type="password"
                  placeholder="Mật khẩu mới"
                  value={overviewPassword.next}
                  onChange={(e) => setOverviewPassword((p) => ({ ...p, next: e.target.value }))}
                  autoComplete="new-password"
                />
                <input
                  className="mgr-field"
                  type="password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={overviewPassword.confirm}
                  onChange={(e) => setOverviewPassword((p) => ({ ...p, confirm: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              <div className="mgr-panelActions">
                <button
                  className="mgr-btnPrimary"
                  type="button"
                  disabled={overviewPasswordSaving}
                  onClick={saveOverviewPassword}
                >
                  {overviewPasswordSaving ? "Đang đổi…" : "Đổi mật khẩu"}
                </button>
              </div>
              {overviewAccountMsg ? (
                <div
                  className={
                    overviewAccountMsg.includes("thành công") || overviewAccountMsg.includes("Đã ")
                      ? "mgr-subtle"
                      : "mgr-alert"
                  }
                  style={{ marginTop: 10 }}
                >
                  {overviewAccountMsg}
                </div>
              ) : null}
            </div>

            <div className="mgr-panel">
              <div className="mgr-panelTitle">Content Moderation</div>
              <div className="mgr-panelText">
                Kiểm soát thông tin, hình ảnh và tư liệu do các thành viên đóng góp.
              </div>
              <div className="mgr-panelEmpty">Chưa có backend. Hiện mới dựng UI.</div>
              <div className="mgr-panelActions">
                <button className="mgr-btnPrimary" type="button" disabled>
                  Hàng chờ duyệt nội dung
                </button>
                <button className="mgr-btnGhost" type="button" disabled>
                  Quy tắc kiểm duyệt
                </button>
              </div>
            </div>

            <div className="mgr-panel">
              <div className="mgr-panelTitle">Duy trì mối quan hệ</div>
              <div className="mgr-panelText">
                Thiết lập và điều chỉnh mối quan hệ gia đình phức tạp xuyên suốt nhiều thế hệ.
              </div>
              <div className="mgr-panelEmpty">Chưa có backend. Hiện mới dựng UI.</div>
            </div>

            <div className="mgr-panel">
              <div className="mgr-panelTitle">Media Management</div>
              <div className="mgr-panelText">
                Lưu trữ và tổ chức hồ sơ số hóa, hình ảnh và lịch sử truyền miệng.
              </div>
              <div className="mgr-panelEmpty">Chưa có backend. Hiện mới dựng UI.</div>
            </div>
          </section>
        ) : null}

        {activeSection === "members" || activeSection === "approvals" ? (
          <section>
            <div className="mgr-listHeader">
              <div className="mgr-listTitle">
                {activeSection === "approvals" ? `Tài khoản chờ duyệt (${filteredMembers.length})` : `Tất cả thành viên (${filteredMembers.length})`}
              </div>
              <div className="mgr-listHint">
                {activeSection === "approvals"
                  ? "Duyệt/từ chối tài khoản (dữ liệu từ backend)."
                  : "Nhấn vào một thẻ để mở form chỉnh sửa toàn bộ hồ sơ, tài khoản và quan hệ."}
              </div>
            </div>

            <div className="mgr-cardGrid">
              {filteredMembers.map((user) => (
                <div
                  className={`mgr-card ${activeSection === "members" ? "mgr-card--clickable" : ""}`}
                  key={user.account_id}
                  role={activeSection === "members" ? "button" : undefined}
                  tabIndex={activeSection === "members" ? 0 : undefined}
                  onClick={() => {
                    if (activeSection === "members") setMemberEditId(user.account_id);
                  }}
                  onKeyDown={(e) => {
                    if (activeSection !== "members") return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMemberEditId(user.account_id);
                    }
                  }}
                >
                  <div className="mgr-cardCover">
                    {(user.pending_avatar_url || user.avatar_url) && (
                      <img 
                        className="mgr-cardAvatar" 
                        src={user.pending_avatar_url || user.avatar_url} 
                        alt="" 
                      />
                    )}
                    {user.moderation_status === 'pending' && (
                      <div className="mgr-pendingBadge">Chờ duyệt</div>
                    )}
                    {!(user.pending_avatar_url || user.avatar_url) && <div className="mgr-dot" aria-hidden="true" />}
                    <div className="mgr-chip">Đời {user.generation ?? "—"}</div>
                  </div>

                  <div className="mgr-cardBody">
                    <div className="mgr-cardName">
                      {user.first_name} {user.surname}
                    </div>
                    <div className="mgr-cardMeta">{user.email}</div>

                    <div className="mgr-cardRows">
                      <div className="mgr-row">
                        <span className="mgr-rowKey">Clan</span>
                        <span className="mgr-rowVal">{user.clan_id || "—"}</span>
                      </div>
                      <div className="mgr-row">
                        <span className="mgr-rowKey">Năm sinh</span>
                        <span className="mgr-rowVal">
                          {user.birth_date ? new Date(user.birth_date).getFullYear() : "—"}
                        </span>
                      </div>
                      <div className="mgr-row">
                        <span className="mgr-rowKey">Vai trò</span>
                        <span className="mgr-rowVal">
                          {user.role_id === 2 ? "Manager" : user.role_id === 3 ? "Member" : `Role ${user.role_id}`}
                        </span>
                      </div>
                      <div className="mgr-row">
                        <span className="mgr-rowKey">Trạng thái</span>
                        <span className="mgr-rowVal">{user.status || "—"}</span>
                      </div>
                    </div>

                    {activeSection === "approvals" ? (
                      <div className="mgr-cardActions">
                        <button
                          className="mgr-btnOk"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            doApprove(user.account_id);
                          }}
                        >
                          Duyệt
                        </button>
                        <button
                          className="mgr-btnDanger"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            doReject(user.account_id);
                          }}
                        >
                          Từ chối
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {!loading && filteredMembers.length === 0 ? (
                <div className="mgr-empty">Không tìm thấy dữ liệu</div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeSection === "lineage" ? (
          <section className="mgr-panel" style={{ maxWidth: "720px" }}>
            <div className="mgr-panelTitle">Quản lý dữ liệu gia phả (Lineage Management)</div>
            <div className="mgr-panelText">
              Chọn thành viên, sau đó dùng một trong hai chế độ: <strong>chỉ định huyết thống</strong> (gắn người này là con
              của cha/mẹ trong cùng dòng họ) hoặc <strong>chỉ định hôn nhân</strong> (vợ/chồng và các con — cùng logic lưu
              bảng <code>families</code> / <code>children</code> như trang thành viên). Dữ liệu được gửi lên API và lưu MySQL.
            </div>

            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <label className="mgr-listHint" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                Thành viên
                <select
                  className="mgr-inputLike"
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--mgr-border)",
                    background: "var(--mgr-surface)",
                    color: "var(--mgr-text-main)",
                    fontSize: "0.95rem",
                  }}
                  value={lineageAccountId}
                  onChange={(e) => setLineageAccountId(e.target.value)}
                >
                  <option value="">— Chọn thành viên —</option>
                  {members.map((m) => (
                    <option key={m.account_id} value={m.account_id}>
                      {m.surname} {m.first_name} · account #{m.account_id}
                      {m.person_id != null ? ` · person #${m.person_id}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
                <span className="mgr-listHint">Chế độ chỉ định:</span>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="mgr-relation-mode"
                    checked={relationMode === "bloodline"}
                    onChange={() => setRelationMode("bloodline")}
                  />
                  Huyết thống (cha / mẹ → con)
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="mgr-relation-mode"
                    checked={relationMode === "marriage"}
                    onChange={() => setRelationMode("marriage")}
                  />
                  Hôn nhân (vợ/chồng, con)
                </label>
              </div>

              {lineageLoading ? <div className="mgr-subtle">Đang tải quan hệ hiện tại…</div> : null}

              {relationMode === "bloodline" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label className="mgr-listHint" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    ID cha (people.id, có thể để trống một phía)
                    <input
                      type="number"
                      value={bloodlineForm.parent_father_id}
                      onChange={(e) => setBloodlineForm((p) => ({ ...p, parent_father_id: e.target.value }))}
                      placeholder="VD: 12"
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--mgr-border)",
                        background: "var(--mgr-bg)",
                      }}
                    />
                  </label>
                  <label className="mgr-listHint" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    ID mẹ (people.id)
                    <input
                      type="number"
                      value={bloodlineForm.parent_mother_id}
                      onChange={(e) => setBloodlineForm((p) => ({ ...p, parent_mother_id: e.target.value }))}
                      placeholder="VD: 15"
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--mgr-border)",
                        background: "var(--mgr-bg)",
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                  <label className="mgr-listHint" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    ID families (tùy chọn)
                    <input
                      type="number"
                      value={marriageForm.family_id}
                      onChange={(e) => setMarriageForm((p) => ({ ...p, family_id: e.target.value }))}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--mgr-border)",
                        background: "var(--mgr-bg)",
                      }}
                    />
                  </label>
                  <label className="mgr-listHint" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    ID vợ/chồng (people.id)
                    <input
                      type="number"
                      value={marriageForm.spouse_id}
                      onChange={(e) => setMarriageForm((p) => ({ ...p, spouse_id: e.target.value }))}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--mgr-border)",
                        background: "var(--mgr-bg)",
                      }}
                    />
                  </label>
                  <label
                    className="mgr-listHint"
                    style={{ display: "flex", flexDirection: "column", gap: "6px", gridColumn: "1 / -1" }}
                  >
                    ID các con (people.id, cách nhau bởi dấu phẩy)
                    <input
                      value={marriageForm.children_ids}
                      onChange={(e) => setMarriageForm((p) => ({ ...p, children_ids: e.target.value }))}
                      placeholder="VD: 20, 21"
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--mgr-border)",
                        background: "var(--mgr-bg)",
                      }}
                    />
                  </label>
                </div>
              )}

              {lineageMsg ? (
                <div className={lineageMsg.includes("lưu") && !lineageMsg.includes("Không") ? "mgr-subtle" : "mgr-alert"}>
                  {lineageMsg}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  className="mgr-btnPrimary"
                  type="button"
                  disabled={!lineageAccountId || lineageSaving}
                  onClick={saveLineageRelations}
                >
                  {lineageSaving ? "Đang lưu…" : "Lưu lên database"}
                </button>
                <button
                  className="mgr-btnGhost"
                  type="button"
                  disabled={!lineageAccountId || lineageLoading}
                  onClick={() => lineageAccountId && loadLineageRelations(Number(lineageAccountId))}
                >
                  Tải lại quan hệ
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === "relationships" ? (
          <section className="mgr-panel">
            <div className="mgr-panelTitle">Duy trì mối quan hệ</div>
            <div className="mgr-panelText">
              Thiết lập và điều chỉnh các mối quan hệ gia đình phức tạp xuyên suốt nhiều thế hệ.
            </div>
            <div className="mgr-panelEmpty">Chưa triển khai backend. Hiện mới dựng UI.</div>
          </section>
        ) : null}

        {activeSection === "moderation" ? (
          <section className="mgr-panel">
            <div className="mgr-panelTitle">Kiểm duyệt Nội dung (Content Moderation)</div>
            <div className="mgr-panelText">
              Manager có đặc quyền phê duyệt hồ sơ người dùng cập nhật, cũng như các tư liệu/hình ảnh do thành viên đóng góp.
            </div>
            
            {/* DUYỆT CẬP NHẬT GIA PHẢ PROFILE */}
            <h3 className="mgr-panelTitle" style={{ fontSize: "1.1rem", marginTop: "30px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>1. Cập nhật hồ sơ (Tiểu sử, Ảnh đại diện)</h3>
            <div className="mgr-list">
              {pendingProfiles.length === 0 ? (
                <div className="mgr-empty">Không có yêu cầu duyệt cập nhật hồ sơ.</div>
              ) : (
                pendingProfiles.map((p) => (
                  <div className="mgr-item" key={p.person_id}>
                    <div className="mgr-itemContent" style={{ flexWrap: 'wrap' }}>
                      <div className="mgr-itemTitle">
                        {p.display_name} 
                        <span className="mgr-itemMeta" style={{ marginLeft: "10px", fontWeight: "normal" }}>
                           Thành viên đang gửi yêu cầu cập nhật hồ sơ
                        </span>
                      </div>
                      <div className="mgr-itemDesc" style={{ width: '100%', display: 'flex', gap: '20px', marginTop: '10px' }}>
                          <div style={{ flex: 1, padding: "10px", background: "var(--bg-light)", borderRadius: "var(--radius-sm)" }}>
                              <strong>Hồ sơ gốc:</strong><br/>
                              <em style={{fontSize:"0.85rem"}}>Tiểu sử:</em> <span style={{fontSize:"0.85rem"}}>{p.current_bio || 'Chưa có'}</span><br/>
                              <em style={{fontSize:"0.85rem"}}>Ảnh:</em> <span style={{fontSize:"0.85rem"}}>{p.current_avatar_url || 'Chưa có'}</span>
                          </div>
                          <div style={{ flex: 1, padding: "10px", background: "#f0fdf4", borderRadius: "var(--radius-sm)", border: "1px solid #bbf7d0" }}>
                              <strong>Tài liệu đề xuất:</strong><br/>
                              <em style={{fontSize:"0.9rem", color: "#166534"}}>Tiểu sử:</em> <span style={{fontSize:"0.9rem", color: "#166534"}}>{p.pending_bio || 'Chưa có'}</span><br/>
                              <em style={{fontSize:"0.9rem", color: "#166534"}}>Ảnh:</em> <span style={{fontSize:"0.9rem", color: "#166534"}}>{p.pending_avatar_url || 'Chưa có'}</span>
                          </div>
                      </div>
                    </div>
                    <div className="mgr-itemActions">
                      <button className="mgr-btnSuccess" type="button" onClick={() => doApproveProfile(p.person_id)}>
                        Phê duyệt
                      </button>
                      <button className="mgr-btnDanger" type="button" onClick={() => doRejectProfile(p.person_id)}>
                        Từ chối
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* DUYỆT BÀI VIẾT CHUNG */}
            <h3 className="mgr-panelTitle" style={{ fontSize: "1.1rem", marginTop: "40px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>2. Tư liệu đóng góp (Posts chung)</h3>
            <div className="mgr-list">
              {pendingPosts.length === 0 ? (
                <div className="mgr-empty">Không có tư liệu chờ duyệt.</div>
              ) : (
                pendingPosts.map((post) => (
                  <div className="mgr-item" key={post.id || post.post_id} style={{ alignItems: "flex-start" }}>
                    <div className="mgr-itemContent">
                      <div className="mgr-itemTitle">
                        Người đăng: {post.author_name}
                        <span className="mgr-itemMeta" style={{ marginLeft: "10px", fontWeight: "normal" }}>
                           Đã gửi vào lúc {new Date(post.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="mgr-itemDesc" style={{ marginTop: '10px', fontSize: '0.95rem' }}>
                        {post.content || <em style={{color:"#888"}}>(Không có nội dung text)</em>}
                      </div>
                      {post.image_url && (
                          <div style={{ marginTop: '10px' }}>
                              <img src={post.image_url} alt="Tài liệu" style={{ maxWidth: '150px', borderRadius: '4px', border: '1px solid #ccc' }} />
                          </div>
                      )}
                    </div>
                    <div className="mgr-itemActions">
                      <button className="mgr-btnSuccess" type="button" onClick={() => doApprovePost(post.id || post.post_id)}>
                        Duyệt tư liệu
                      </button>
                      <button className="mgr-btnDanger" type="button" onClick={() => doRejectPost(post.id || post.post_id)}>
                        Bỏ qua
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        {activeSection === "media" ? (
          <section>
            <div className="mgr-listHeader">
              <div className="mgr-listTitle">
                Thư viện Đa phương tiện (Media Gallery)
              </div>
              <div className="mgr-listHint">
                Lưu trữ các hình ảnh, tài liệu số hóa của gia phả. Có thể chọn upload ảnh mới bằng nút bên góc trái.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px", marginTop: "20px" }}>
              {mediaList.map((media) => (
                <div key={media.post_id} style={{ backgroundColor: "var(--mgr-surface)", borderRadius: "var(--mgr-radius)", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid var(--mgr-border)" }}>
                  <div style={{ height: "180px", width: "100%", position: "relative" }}>
                    <img src={media.image_url} alt="Media" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ padding: "10px", fontSize: "0.85rem", color: "var(--mgr-text-mute)" }}>
                    <div style={{ fontWeight: "600", color: "var(--mgr-text-main)", marginBottom: "4px" }}>Đăng bởi: {media.author_name}</div>
                    <div>{new Date(media.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}

              {!loading && mediaList.length === 0 ? (
                <div className="mgr-empty" style={{ gridColumn: "1 / -1" }}>Chưa có hình ảnh nào trong thư viện</div>
              ) : null}
            </div>
            
            <div style={{ marginTop: "30px", padding: "20px", background: "var(--mgr-surface)", border: "1px dashed var(--mgr-border)", borderRadius: "var(--mgr-radius)", textAlign: "center" }}>
              <div style={{ marginBottom: "15px", color: "var(--mgr-text-main)", fontWeight: "500" }}>Số hóa hình ảnh gia phả (AI OCR / Restore)</div>
              <input 
                 type="file" 
                 id="ai-upload" 
                 style={{ display: "none" }} 
                 accept="image/*" 
                 onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const user = JSON.parse(localStorage.getItem('user') || "{}");
                    const formData = new FormData();
                    formData.append('userId', String(user.id || 1));
                    formData.append('image', file);
                    try {
                        const res = await fetch('/ai/vision/restore-ocr-and-ingest', { method: 'POST', body: formData });
                        const data = await res.json();
                        if (res.ok) alert("Số hóa tài liệu thành công! OCR Text: " + (data.data?.ocr?.text || ""));
                        else alert("Lỗi tích hợp: " + data.message);
                    } catch (err) {
                        alert("Lỗi upload AI: " + err.message);
                    }
                 }}
              />
              <label htmlFor="ai-upload" className="mgr-btnPrimary" style={{ display: "inline-block", cursor: "pointer" }}>
                Chọn tập tin tải lên ...
              </label>
              <div style={{ marginTop: "10px", fontSize: "0.8rem", color: "var(--mgr-text-mute)" }}>Sử dụng công nghệ RAG/Vision của AI Service</div>
            </div>
          </section>
        ) : null}
      </main>

      {memberEditId ? (
        <div
          className="mgr-modalOverlay"
          role="presentation"
          onClick={() => !memberEditSaving && setMemberEditId(null)}
        >
          <div
            className="mgr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mgr-member-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mgr-modalClose"
              aria-label="Đóng"
              disabled={memberEditSaving}
              onClick={() => setMemberEditId(null)}
            >
              ×
            </button>
            <h2 className="mgr-modalTitle" id="mgr-member-edit-title">
              Chỉnh sửa thành viên
            </h2>
            <p className="mgr-modalMeta">Tài khoản #{memberEditId}</p>

            {memberEditLoading ? (
              <div className="mgr-subtle">Đang tải dữ liệu…</div>
            ) : (
              <>
                <div className="mgr-modalSectionTitle">Tài khoản</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input
                    className="mgr-field"
                    type="email"
                    placeholder="Email đăng nhập"
                    value={memberEditForm.email}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, email: e.target.value }))}
                  />
                  <select
                    className="mgr-field"
                    value={memberEditForm.status}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="active">active</option>
                    <option value="pending">pending</option>
                    <option value="rejected">rejected</option>
                  </select>
                  {sessionRoleId === 1 ? (
                    <>
                      <select
                        className="mgr-field"
                        value={memberEditForm.role_id}
                        onChange={(e) => setMemberEditForm((p) => ({ ...p, role_id: e.target.value }))}
                      >
                        <option value="3">Member</option>
                        <option value="2">Manager</option>
                      </select>
                      <input
                        className="mgr-field"
                        type="number"
                        placeholder="clan_id (dòng họ)"
                        value={memberEditForm.clan_id}
                        onChange={(e) => setMemberEditForm((p) => ({ ...p, clan_id: e.target.value }))}
                      />
                    </>
                  ) : null}
                  <input
                    className="mgr-field"
                    style={{ gridColumn: "1 / -1" }}
                    type="password"
                    placeholder="Mật khẩu mới (để trống nếu không đổi)"
                    value={memberEditForm.new_password}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, new_password: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>

                <div className="mgr-modalSectionTitle">Hồ sơ người (people)</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input
                    className="mgr-field"
                    placeholder="Họ"
                    value={memberEditForm.surname}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, surname: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    placeholder="Tên đệm"
                    value={memberEditForm.middle_name}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, middle_name: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    placeholder="Tên"
                    value={memberEditForm.first_name}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, first_name: e.target.value }))}
                  />
                  <select
                    className="mgr-field"
                    value={memberEditForm.gender}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="1">Nam</option>
                    <option value="2">Nữ</option>
                    <option value="">Không khai báo</option>
                  </select>
                  <input
                    className="mgr-field"
                    type="date"
                    value={memberEditForm.birth_date}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, birth_date: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    type="date"
                    placeholder="Ngày mất"
                    value={memberEditForm.death_date}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, death_date: e.target.value }))}
                  />
                  <select
                    className="mgr-field"
                    value={memberEditForm.is_living}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, is_living: e.target.value }))}
                  >
                    <option value="1">Còn sống</option>
                    <option value="0">Đã mất</option>
                  </select>
                  <input
                    className="mgr-field"
                    type="number"
                    min={1}
                    placeholder="Đời"
                    value={memberEditForm.generation}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, generation: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    type="number"
                    placeholder="Chi (branch)"
                    value={memberEditForm.branch}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, branch: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    placeholder="Quê quán"
                    value={memberEditForm.hometown}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, hometown: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    style={{ gridColumn: "1 / -1" }}
                    placeholder="Địa chỉ"
                    value={memberEditForm.address}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, address: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    placeholder="Điện thoại"
                    value={memberEditForm.phone}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    type="email"
                    placeholder="Email (trong hồ sơ people)"
                    value={memberEditForm.people_email}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, people_email: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    placeholder="Zalo"
                    value={memberEditForm.zalo}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, zalo: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    placeholder="Facebook"
                    value={memberEditForm.facebook}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, facebook: e.target.value }))}
                  />
                  <div style={{ gridColumn: "1 / -1", margin: "10px 0" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#666" }}>Cập nhật ảnh qua kéo thả:</label>
                    <ImageUpload 
                      onUploadSuccess={(url) => setMemberEditForm((p) => ({ ...p, avatar_url: url }))} 
                      label="Kéo thả ảnh vào đây để thay đổi"
                    />
                  </div>
                  <input
                    className="mgr-field"
                    style={{ gridColumn: "1 / -1" }}
                    placeholder="Hoặc nhập URL ảnh đại diện trực tiếp"
                    value={memberEditForm.avatar_url}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, avatar_url: e.target.value }))}
                  />
                  <textarea
                    className="mgr-field mgr-fieldTextarea"
                    style={{ gridColumn: "1 / -1" }}
                    placeholder="Giới thiệu (bio)"
                    rows={2}
                    value={memberEditForm.bio}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, bio: e.target.value }))}
                  />
                  <textarea
                    className="mgr-field mgr-fieldTextarea"
                    style={{ gridColumn: "1 / -1" }}
                    placeholder="Ghi chú nội bộ"
                    rows={2}
                    value={memberEditForm.note}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, note: e.target.value }))}
                  />
                </div>

                <div className="mgr-modalSectionTitle">Quan hệ huyết thống (cha/mẹ → người này là con)</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input
                    className="mgr-field"
                    type="number"
                    placeholder="ID cha (people.id)"
                    value={memberEditForm.parent_father_id}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, parent_father_id: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    type="number"
                    placeholder="ID mẹ (people.id)"
                    value={memberEditForm.parent_mother_id}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, parent_mother_id: e.target.value }))}
                  />
                </div>

                <div className="mgr-modalSectionTitle">Quan hệ hôn nhân (vợ/chồng, con)</div>
                <div className="mgr-overviewFormGrid mgr-modalGrid">
                  <input
                    className="mgr-field"
                    type="number"
                    placeholder="ID families (tùy chọn)"
                    value={memberEditForm.family_id}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, family_id: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    type="number"
                    placeholder="ID vợ/chồng (people.id)"
                    value={memberEditForm.spouse_id}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, spouse_id: e.target.value }))}
                  />
                  <input
                    className="mgr-field"
                    style={{ gridColumn: "1 / -1" }}
                    placeholder="ID con (people.id, cách nhau dấu phẩy)"
                    value={memberEditForm.children_ids}
                    onChange={(e) => setMemberEditForm((p) => ({ ...p, children_ids: e.target.value }))}
                  />
                </div>

                {memberEditMsg ? (
                  <div
                    className={
                      memberEditMsg.includes("thành công") || memberEditMsg.includes("Đã lưu")
                        ? "mgr-subtle"
                        : "mgr-alert"
                    }
                    style={{ marginTop: 12 }}
                  >
                    {memberEditMsg}
                  </div>
                ) : null}

                <div className="mgr-modalActions">
                  <button className="mgr-btnPrimary" type="button" disabled={memberEditSaving} onClick={saveMemberEdit}>
                    {memberEditSaving ? "Đang lưu…" : "Lưu thay đổi"}
                  </button>
                  <button
                    className="mgr-btnGhost"
                    type="button"
                    disabled={memberEditSaving}
                    onClick={() => setMemberEditId(null)}
                  >
                    Đóng
                  </button>
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
