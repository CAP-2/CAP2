import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./member.css";
import { socket } from "../../utils/socket"; 
import {
  changeMemberPassword,
  createMemberReminder,
  getMemberChat,
  getMemberDashboard,
  getMemberTasks,
  updateMemberTaskStatus,
  sendMemberChat,
  updateMemberProfile,
  proposeProfileUpdate,
  submitMaterial,
  getMySubmissions
} from "../../api/memberService";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import { personTreeLabel } from "../../components/PhadoFamilyTree/PhadoFamilyTree";
import FamilyTreeFlowLive from "../../components/PhadoFamilyTree/FamilyTreeFlowLive";

function formatMemberDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("vi-VN");
}

function genderLabel(g) {
  if (g === 1 || g === "1") return "Nam";
  if (g === 2 || g === "2") return "Nữ";
  return null;
}

function readSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

const Member = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("discover");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("modern");
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socketNotifications, setSocketNotifications] = useState([]);
  const [clanInfo, setClanInfo] = useState({ clan_name: "", history: "" });
  const [accountForm, setAccountForm] = useState({
    surname: "",
    middle_name: "",
    first_name: "",
    email: "",
    hometown: "",
    generation: "",
    family_id: "",
    spouse_id: "",
    children_ids: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [familySaving, setFamilySaving] = useState(false);

  useEffect(() => {
    const u = readSessionUser();
    const userId = u?.id; 

    if (userId) {
        socket.emit("register_user", userId);
        console.log("Member registered to socket ID:", userId);     
        socket.on("new_notification", (data) => {
          console.log("Hứng được tin nhắn:", data);
            alert(`🔔 THÔNG BÁO: ${data.message}`);
            const newNotif = {
                id: Date.now(),
                title: "CÔNG VIỆC MỚI",
                message: data.message,
                dueDate: data.dueDate,
                time: new Date().toLocaleTimeString()
            };
            
            setSocketNotifications(prev => [newNotif, ...prev]);
            setActiveSection("reminders");
        });
    }
    return () => {
        socket.off("new_notification");
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : null;
      if (u?.status === "pending") {
        navigate("/waiting", { replace: true });
      }
    } catch {
      // ignore
    }
  }, [navigate]);

  const [treeMembers, setTreeMembers] = useState([]);
  const [familyTreeRoots, setFamilyTreeRoots] = useState([]);
  const [treeMemberDetail, setTreeMemberDetail] = useState(null);
  const [discoverItemsFromDb, setDiscoverItemsFromDb] = useState([]);
  const [accountMeta, setAccountMeta] = useState({ status: "", person_id: null, role_id: null });
  
  const [profileContentForm, setProfileContentForm] = useState({ bio: "", avatar_url: "" });
  const [materialForm, setMaterialForm] = useState({ content: "", image_url: "" });
  const [profileStatus, setProfileStatus] = useState("none");
  const [profileReason, setProfileReason] = useState("");
  const [mySubmissions, setMySubmissions] = useState({ posts: [], profile: {} });

  const [discoverQuery, setDiscoverQuery] = useState("");
  const discoverResults = useMemo(() => {
    const q = discoverQuery.trim().toLowerCase();
    const all = discoverItemsFromDb;
    if (!q) return all;
    return all.filter((x) => (x.title + " " + x.desc + " " + x.tag).toLowerCase().includes(q));
  }, [discoverItemsFromDb, discoverQuery]);

  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState([]);
  const chatListRef = useRef(null);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    try {
      await sendMemberChat(text);
      const chatRes = await getMemberChat();
      setChat(
        (chatRes.messages || []).map((m) => ({
          role: m.sender_type === "user" ? "user" : "ai",
          text: m.content,
        }))
      );
      setChatInput("");
      setTimeout(() => {
        if (chatListRef.current) chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
      }, 0);
    } catch (e) {
      setError(e?.message || "Không thể gửi chat");
    }
  };

  const [photoFile, setPhotoFile] = useState(null);
  const photoUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : ""), [photoFile]);
  const [restoreMode, setRestoreMode] = useState("sharpen");

  const [sttText, setSttText] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrFile, setOcrFile] = useState(null);
  const ocrUrl = useMemo(() => (ocrFile ? URL.createObjectURL(ocrFile) : ""), [ocrFile]);

  const [reminders, setReminders] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [dbNotifications, setDbNotifications] = useState([]);
  const [newReminder, setNewReminder] = useState({ title: "", date: "", note: "" });

  const addReminder = async () => {
    if (!newReminder.title.trim() || !newReminder.date) return;
    try {
      await createMemberReminder({
        title: newReminder.title.trim(),
        date: newReminder.date,
        note: newReminder.note.trim(),
      });
      const dash = await getMemberDashboard();
      setReminders(dash.reminders || []);
      setNewReminder({ title: "", date: "", note: "" });
    } catch (e) {
      setError(e?.message || "Không thể tạo nhắc nhở");
    }
  };

  const updateTaskStatusLocal = async (taskId, status) => {
    try {
      await updateMemberTaskStatus(taskId, status);
      await loadDashboard({ silent: true });
    } catch (e) {
      setError(e?.message || "Khong the cap nhat cong viec");
    }
  };

  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case "discover": return "Khám phá di sản";
      case "chat": return "Tương tác với trợ lý AI";
      case "tree": return "Xem cây gia phả tương tác";
      case "restore": return "Phục chế hình ảnh cũ";
      case "digitize": return "Số hóa tư liệu (Speech-to-Text & OCR)";
      case "reminders": return "Nhận thông báo (Reminders & Alerts)";
      case "contribute": return "Đóng góp nội dung & Theo dõi";
      case "general_posts": return "Bảng tin dòng họ";
      default: return "Trang thành viên";
    }
  }, [activeSection]);

  const user = readSessionUser();
  const userName = user?.name || "Thành viên";

  const clanMembersForRelations = useMemo(() => {
    const pid = accountMeta.person_id;
    if (pid == null) return [];
    return (treeMembers || []).filter((m) => Number(m.id) !== Number(pid));
  }, [treeMembers, accountMeta.person_id]);

  const childCandidatesForRelations = useMemo(() => {
    const sid = Number(accountForm.spouse_id);
    const pid = accountMeta.person_id;
    return clanMembersForRelations.filter((m) => {
      if (Number(m.id) === Number(pid)) return false;
      if (Number.isFinite(sid) && Number(m.id) === sid) return false;
      return true;
    });
  }, [clanMembersForRelations, accountForm.spouse_id, accountMeta.person_id]);

  const personOptionLabel = (m) =>
    m.display_name ||
    [m.surname, m.middle_name, m.first_name].filter(Boolean).join(" ").trim() ||
    `Thành viên #${m.id}`;

  const selectedChildIdSet = useMemo(() => {
    const nums = String(accountForm.children_ids || "")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));
    return new Set(nums);
  }, [accountForm.children_ids]);

  const toggleChildInRelations = (childId) => {
    const next = new Set(selectedChildIdSet);
    if (next.has(childId)) next.delete(childId);
    else next.add(childId);
    setAccountForm((p) => ({
      ...p,
      children_ids: [...next].sort((a, b) => a - b).join(", "),
    }));
  };

  useEffect(() => {
    if (!treeMemberDetail) return;
    const onKey = (e) => { if (e.key === "Escape") setTreeMemberDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [treeMemberDetail]);

  const loadDashboard = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setLoading(true);
    setError("");
    try {
      const dash = await getMemberDashboard();
      const p = dash.profile || {};
      const c = dash.clan || {};
      const u = readSessionUser();
      setClanInfo({ clan_name: c.clan_name || "", history: c.history || "" });
      setTreeMembers(dash.treeMembers || []);
      setFamilyTreeRoots(dash.familyTree?.roots || []);
      setDiscoverItemsFromDb(dash.discoverItems || []);
      setReminders(dash.reminders || []);
      setAssignedTasks(dash.assignedTasks || []);
      setDbNotifications(dash.notifications || []);
      setAccountMeta({
        status: p.status || "",
        person_id: p.person_id ?? null,
        role_id: p.role_id ?? null,
      });
      setAccountForm({
        surname: p.surname ?? "",
        middle_name: p.middle_name ?? "",
        first_name: p.first_name ?? "",
        email: p.email || u.email || "",
        hometown: p.hometown || u.hometown || "",
        generation: p.generation ?? "",
        family_id: p.family_id ?? "",
        spouse_id: p.spouse_id ?? "",
        children_ids: Array.isArray(p.children_ids) ? p.children_ids.join(", ") : "",
      });
      setProfileContentForm({
        bio: p.pending_bio !== null ? (p.pending_bio || "") : (p.bio || ""),
        avatar_url: p.pending_avatar_url !== null ? (p.pending_avatar_url || "") : (p.avatar_url || ""),
      });
      setProfileStatus(p.moderation_status || "none");
      setProfileReason(p.moderation_reason || "");
      
      const subRes = await getMySubmissions();
      if (subRes.success) {
        setMySubmissions({ posts: subRes.posts, profile: subRes.profile });
      }

      if (!Array.isArray(dash.assignedTasks)) {
        const taskRes = await getMemberTasks();
        setAssignedTasks(taskRes.tasks || []);
      }

      const chatRes = await getMemberChat();
      const messages = (chatRes.messages || []).map((m) => ({
        role: m.sender_type === "user" ? "user" : "ai",
        text: m.content,
      }));
      setChat(
        messages.length > 0
          ? messages
          : [{ role: "ai", text: "Chào bạn! Bạn có thể hỏi về phả hệ, người thân, hoặc sự kiện gia đình." }]
      );
    } catch (e) {
      setError(e?.message || "Không thể tải dữ liệu thành viên");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const interval = setInterval(() => {
       loadDashboard({ silent: true });
    }, 15000); // 15 seconds
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const saveAccountInfo = async () => {
    try {
      setError("");
      const genRaw = String(accountForm.generation).trim();
      const genNum = genRaw === "" ? null : Number(genRaw);
      if (genRaw !== "" && !Number.isFinite(genNum)) {
        setError("Đời (generation) phải là số hợp lệ hoặc để trống.");
        return;
      }
      const payload = {
        surname: accountForm.surname,
        middle_name: accountForm.middle_name,
        first_name: accountForm.first_name,
        email: accountForm.email,
        hometown: accountForm.hometown,
        generation: genNum,
      };
      
      const res = await updateMemberProfile(payload);
      const p = res.profile || {};
      const prev = readSessionUser();
      const merged = {
        ...prev,
        name: p.display_name ?? prev.name ?? "Thành viên",
        email: p.email ?? accountForm.email ?? prev.email ?? "",
        hometown: p.hometown ?? accountForm.hometown ?? prev.hometown ?? "",
        status: p.status ?? prev.status,
        role_id: p.role_id ?? prev.role_id,
      };
      localStorage.setItem("user", JSON.stringify(merged));
      await loadDashboard({ silent: true });
      setShowAccountPanel(false);
    } catch (e) {
      setError(e?.message || "Không thể cập nhật thông tin tài khoản");
    }
  };

  const saveFamilyRelations = async () => {
    if (accountMeta.person_id == null) {
      setError("Tài khoản chưa liên kết hồ sơ người trong dòng họ.");
      return;
    }
    try {
      setError("");
      setFamilySaving(true);
      const sidStr = String(accountForm.spouse_id ?? "").trim();
      const kidsStr = String(accountForm.children_ids ?? "").trim();
      const kidsNums = kidsStr
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v));

      const payload = { children_ids: kidsNums };
      if (sidStr !== "") payload.spouse_id = Number(sidStr);

      const res = await updateMemberProfile(payload);
      const p = res.profile || {};
      const prev = readSessionUser();
      const merged = {
        ...prev,
        name: p.display_name ?? prev.name ?? "Thành viên",
        status: p.status ?? prev.status,
        role_id: p.role_id ?? prev.role_id,
      };
      localStorage.setItem("user", JSON.stringify(merged));
      setAccountForm((prev) => ({
        ...prev,
        family_id: p.family_id ?? prev.family_id ?? "",
        spouse_id: p.spouse_id ?? prev.spouse_id ?? "",
        children_ids: Array.isArray(p.children_ids) ? p.children_ids.join(", ") : prev.children_ids,
      }));
      await loadDashboard({ silent: true });
    } catch (e) {
      setError(e?.message || "Không thể lưu quan hệ gia đình");
    } finally {
      setFamilySaving(false);
    }
  };

  const savePassword = async () => {
    try {
      setError("");
      if (passwordForm.next !== passwordForm.confirm) {
        setError("Mật khẩu mới và nhập lại không khớp.");
        return;
      }
      if (passwordForm.next.length < 6) {
        setError("Mật khẩu mới cần ít nhất 6 ký tự.");
        return;
      }
      setPasswordSaving(true);
      await changeMemberPassword({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
      });
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      setError(e?.message || "Không thể đổi mật khẩu");
    } finally {
      setPasswordSaving(false);
    }
  };

  const submitProfileUpdate = async () => {
    try {
       setError("");
       await proposeProfileUpdate(profileContentForm);
       await loadDashboard({ silent: true });
       alert("Gửi yêu cầu cập nhật hồ sơ thành công!");
    } catch (err) {
       setError(err?.message || "Lỗi cập nhật hồ sơ");
    }
  };

  const submitMaterialPost = async () => {
     if (!materialForm.content.trim() && !materialForm.image_url.trim()) {
         setError("Vui lòng nhập nội dung hoặc thêm ảnh");
         return;
     }
     try {
       setError("");
       await submitMaterial(materialForm);
       setMaterialForm({ content: "", image_url: "" });
       await loadDashboard({ silent: true });
       alert("Gửi tư liệu thành công! Vui lòng chờ quản lý duyệt.");
     } catch (err) {
       setError(err?.message || "Lỗi gửi tư liệu");
     }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const [genPosts, setGenPosts] = useState([]);
  const [genPostsLoading, setGenPostsLoading] = useState(false);
  const loadClansFeed = useCallback(async () => {
    setGenPostsLoading(true);
    try {
      const { getGeneralPosts } = await import("../../api/memberService");
      const res = await getGeneralPosts();
      if (res.success) setGenPosts(res.posts);
    } catch (err) {
      console.error(err);
    } finally {
      setGenPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "general_posts") loadClansFeed();
  }, [activeSection, loadClansFeed]);

  useEffect(() => {
    if (activeSection !== "general_posts") return;
    const interval = setInterval(() => {
      loadClansFeed();
    }, 20000);
    return () => clearInterval(interval);
  }, [activeSection, loadClansFeed]);

  return (
    <div className={`usr-shell ${viewMode === "classic" ? "isClassic" : ""}`}>
      <aside className="usr-sidebar">
        <div className="usr-brand">
          <div className="usr-logo" aria-hidden="true">G</div>
          <div className="usr-brandText">
            <div className="usr-brandTitle">Gia Phả</div>
            <div className="usr-brandSub">Xin chào, {userName}</div>
          </div>
        </div>

        <nav className="usr-nav" aria-label="Điều hướng thành viên">
          <button className={`usr-navItem ${activeSection === "discover" ? "isActive" : ""}`} onClick={() => setActiveSection("discover")}>Khám phá di sản</button>
          <button className={`usr-navItem ${activeSection === "contribute" ? "isActive" : ""}`} onClick={() => setActiveSection("contribute")}>Đóng góp & Theo dõi</button>
          <button className={`usr-navItem ${activeSection === "general_posts" ? "isActive" : ""}`} onClick={() => setActiveSection("general_posts")}>Bảng tin dòng họ</button>
          <button className={`usr-navItem ${activeSection === "chat" ? "isActive" : ""}`} onClick={() => setActiveSection("chat")}>Trợ lý AI (Chatbot)</button>
          <button className={`usr-navItem ${activeSection === "tree" ? "isActive" : ""}`} onClick={() => setActiveSection("tree")}>Cây gia phả (Interactive)</button>
          <div className="usr-navDivider" />
          <Link to="/posts/general" className="usr-navItem" style={{ textDecoration: 'none' }}>Bảng tin dòng họ</Link>
          <button className={`usr-navItem ${activeSection === "restore" ? "isActive" : ""}`} onClick={() => setActiveSection("restore")}>Phục chế ảnh cũ</button>
          <button className={`usr-navItem ${activeSection === "digitize" ? "isActive" : ""}`} onClick={() => setActiveSection("digitize")}>Số hóa tư liệu</button>
          <button className={`usr-navItem ${activeSection === "reminders" ? "isActive" : ""}`} onClick={() => setActiveSection("reminders")}>Thông báo & nhắc nhở</button>
        </nav>
      </aside>

      <main className="usr-main">
        <div className="usr-topbar">
          <div className="usr-search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm nhanh…" aria-label="Tìm kiếm nhanh" />
          </div>
          <div className="usr-topActions">
            <button className={`usr-pill usr-pillBtn ${viewMode === "modern" ? "isActive" : ""}`} type="button" onClick={() => setViewMode("modern")}>Hiện đại</button>
            <button className={`usr-pill usr-pillBtn ${viewMode === "classic" ? "isActive" : ""}`} type="button" onClick={() => setViewMode("classic")}>Cổ điển</button>
            <button className="usr-pill usr-pillBtn" type="button" onClick={() => setShowAccountPanel(true)}>Tài khoản</button>
            <button className="usr-pill usr-pillBtn usr-pillLogout" type="button" onClick={logout} title="Đăng xuất khỏi tài khoản">
              Đăng xuất
            </button>
          </div>
        </div>

        <section className="usr-hero" aria-label="Banner">
          <div className="usr-heroOverlay" />
          <div className="usr-heroContent">
            <div className="usr-heroKicker">Gia Phả Việt</div>
            <div className="usr-heroTitle">{sectionTitle}</div>
            <div className="usr-heroDesc">{clanInfo.clan_name ? `Dòng họ: ${clanInfo.clan_name}.` : "Kết nối cuội nguồn gia đình."}</div>
          </div>
        </section>

        {loading && <section className="usr-panel"><div className="usr-panelText">Đang tải dữ liệu...</div></section>}
        {error && <section className="usr-panel"><div className="usr-panelText" style={{ color: '#dc2626' }}>{error}</div></section>}

        {activeSection === "discover" && (
          <section className="usr-panel">
            <div className="usr-panelTitle">Tra cứu dòng họ</div>
            <div className="usr-row">
              <input className="usr-input" value={discoverQuery} onChange={(e) => setDiscoverQuery(e.target.value)} placeholder="Tìm tên, quê quán..." />
            </div>
            <div className="usr-treeMemberGrid">
              {treeMembers.filter(m => `${m.display_name} ${m.hometown}`.toLowerCase().includes(discoverQuery.toLowerCase())).map(m => (
                <div className="usr-treeMemberCard" key={m.id} onClick={() => setTreeMemberDetail(m)}>
                  <div className="usr-treeMemberName">{m.display_name}</div>
                  <div className="usr-treeMemberMeta">Đời {m.generation} - {m.hometown}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeSection === "contribute" && (
          <section className="usr-panel">
            <div className="usr-panelTitle" style={{ marginBottom: '20px' }}>Đóng góp nội dung & Theo dõi</div>
            <div className="usr-grid2">
               <div>
                  <h3>Đóng góp bài viết dòng họ</h3>
                  <p className="usr-panelText" style={{ marginBottom: '15px' }}>Chia sẻ hình ảnh, câu chuyện hoặc tư liệu quý giá về dòng họ để mọi người cùng xem.</p>
                  <label style={{ fontSize: '0.9rem', color: '#666', fontWeight: '700' }}>Ảnh bài viết:</label>
                  <ImageUpload onUploadSuccess={(url)=>setMaterialForm(p=>({...p, image_url: url}))} label="Kéo thả ảnh bài viết" />
                  <textarea className="usr-textarea" value={materialForm.content} onChange={e=>setMaterialForm(prev=>({...prev, content: e.target.value}))} placeholder="Nội dung bài viết..." rows="5" />
                  <button className="usr-btnPrimary" style={{ marginTop: '15px', width: '100%' }} onClick={submitMaterialPost}>Gửi bài viết đóng góp</button>
               </div>
               <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ marginTop: 0 }}>Lưu ý</h3>
                  <ul className="usr-panelText" style={{ paddingLeft: '20px' }}>
                    <li>Mọi đóng góp sẽ được Quản lý dòng họ kiểm duyệt trước khi hiển thị.</li>
                    <li>Sử dụng ngôn từ chuẩn mực, tôn trọng tổ tiên.</li>
                    <li>Ảnh tải lên nên rõ nét để lưu trữ lâu dài.</li>
                    <li>Cập nhật hồ sơ cá nhân (ảnh/tiểu sử) hiện đã được chuyển vào mục <strong>Tài khoản</strong>.</li>
                  </ul>
               </div>
            </div>

            <div style={{ marginTop: '40px' }}>
              <h3 className="usr-panelTitle" style={{ fontSize: '1.2rem' }}>Lịch sử đóng góp</h3>
              <div className="usr-submission-table-wrap">
                <table className="usr-table">
                   <thead>
                      <tr><th>Loại</th><th>Nội dung</th><th>Trạng thái</th><th>Ghi chú</th></tr>
                   </thead>
                   <tbody>
                      {mySubmissions.posts.map((p, idx) => (
                        <tr key={idx}>
                          <td>Bài viết</td>
                          <td>{p.content ? p.content.substring(0, 40) + (p.content.length > 40 ? "..." : "") : "Nội dung hình ảnh"}</td>
                          <td><span className={`status-pill ${p.status}`}>{p.status === 'pending' ? 'Chờ duyệt' : p.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}</span></td>
                          <td>{p.rejection_reason || '—'}</td>
                        </tr>
                      ))}
                      {(mySubmissions.profile && (mySubmissions.profile.moderation_status !== 'none' || mySubmissions.profile.pending_bio || mySubmissions.profile.pending_avatar_url)) ? (
                        <tr>
                          <td>Cập nhật hồ sơ</td>
                          <td>{mySubmissions.profile.pending_bio ? mySubmissions.profile.pending_bio.substring(0, 40) : "Cập nhật ảnh đại diện"}</td>
                          <td>
                            <span className={`status-pill ${mySubmissions.profile.moderation_status || 'pending'}`}>
                              {mySubmissions.profile.moderation_status === 'pending' ? 'Chờ duyệt' : mySubmissions.profile.moderation_status === 'rejected' ? 'Từ chối' : 'Đang xử lý'}
                            </span>
                          </td>
                          <td>{mySubmissions.profile.moderation_reason || '—'}</td>
                        </tr>
                      ) : null}
                      {mySubmissions.posts.length === 0 && (!mySubmissions.profile || mySubmissions.profile.moderation_status === 'none') && (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Chưa có lịch sử đóng góp nào.</td></tr>
                      )}
                   </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === "general_posts" && (
          <section className="usr-panel">
            <div className="usr-panelTitle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Bảng tin dòng họ
              <button className="usr-btnPrimary" style={{ fontSize: '0.8rem' }} onClick={() => setActiveSection("contribute")}>+ Viết bài mới</button>
            </div>
            {genPostsLoading ? (
              <div className="usr-panelText">Đang tải bài viết...</div>
            ) : (
              <div style={{ marginTop: '20px', display: 'grid', gap: '20px' }}>
                {genPosts.length > 0 ? genPosts.map(post => (
                  <div key={post.id} className="usr-resultCard" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                      <div className="usr-logo" style={{ borderRadius: '50%', flexShrink: 0 }}>{post.author_name?.[0] || 'T'}</div>
                      <div>
                        <div style={{ fontWeight: '800' }}>{post.author_name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{new Date(post.created_at).toLocaleString('vi-VN')}</div>
                      </div>
                    </div>
                    {post.image_url && (
                      <div style={{ marginBottom: '15px' }}>
                        <img src={post.image_url} alt="Post" style={{ width: '100%', borderRadius: '12px', maxHeight: '400px', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ lineHeight: '1.6', color: '#2a3a58', fontSize: '1rem' }}>{post.content}</div>
                  </div>
                )) : (
                  <div className="usr-panelText" style={{ textAlign: 'center', padding: '40px' }}>Chưa có bài viết nào được phê duyệt trong dòng họ.</div>
                )}
              </div>
            )}
          </section>
        )}

        {activeSection === "chat" && (
          <section className="usr-panel">
            <div className="usr-panelTitle">Trợ lý Gia Phả AI</div>
            <div className="usr-chat">
              <div className="usr-chatList" ref={chatListRef}>
                {chat.map((m, i) => (
                  <div key={i} className={`usr-chatMsg ${m.role === "user" ? "isUser" : "isAI"}`}>
                    <div className="usr-chatBubble">{m.text}</div>
                  </div>
                ))}
              </div>
              <div className="usr-chatComposer">
                 <input className="usr-input" value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Hỏi về tổ tiên, hậu duệ..." onKeyDown={e=>e.key==='Enter' && sendChat()} />
                 <button className="usr-btnPrimary" onClick={sendChat}>Gửi</button>
              </div>
            </div>
          </section>
        )}

        {activeSection === "tree" ? (
          <section className="usr-panel usr-panel--phado">
            <div className="usr-panelTitle">Cây gia phả React Flow</div>
            <div className="usr-panelText">
              Dùng trực tiếp dữ liệu gia phả của bạn từ hệ thống và tự động dàn layout dạng cây.
            </div>
            {familyTreeRoots.length === 0 ? (
              <div className="usr-phado-empty">Chưa có dữ liệu cây gia phả để hiển thị.</div>
            ) : (
            <FamilyTreeFlowLive
              roots={familyTreeRoots}
              clanName={clanInfo.clan_name || "Dữ liệu trích từ ảnh"}
              onSelectPerson={setTreeMemberDetail}
            />
            )}
          </section>
        ) : null}

        {activeSection === "restore" && (
          <section className="usr-panel">
             <div className="usr-panelTitle">Phục chế ảnh</div>
             <div className="usr-row usr-rowWrap">
                <label className="usr-file"><input type="file" onChange={e=>setPhotoFile(e.target.files[0])} />Chọn ảnh</label>
                <select className="usr-select" value={restoreMode} onChange={e=>setRestoreMode(e.target.value)}>
                   <option value="sharpen">Làm nét</option><option value="colorize">Tô màu</option>
                </select>
                <button className="usr-btnPrimary" disabled>Phục chế AI (Demo)</button>
             </div>
             {photoUrl && <div style={{ marginTop: '10px' }}><img src={photoUrl} alt="Preview" style={{ maxWidth: '100%', borderRadius: '8px' }} /></div>}
          </section>
        )}

        {activeSection === "digitize" && (
          <section className="usr-grid2">
            <div className="usr-panel"><div className="usr-panelTitle">STT (Demo)</div><textarea className="usr-textarea" value={sttText} onChange={e=>setSttText(e.target.value)} rows="5" /></div>
            <div className="usr-panel"><div className="usr-panelTitle">OCR (Demo)</div><textarea className="usr-textarea" value={ocrText} onChange={e=>setOcrText(e.target.value)} rows="5" /></div>
          </section>
        )}

        {activeSection === "reminders" && (
  <section className="usr-panel">
    <div className="usr-panelTitle">Nhắc nhở & Thông báo mới</div>
    
    {/* Phần form thêm nhắc nhở cá nhân giữ nguyên */}
    <div className="usr-reminderForm">
       <input className="usr-input" value={newReminder.title} onChange={e=>setNewReminder(p=>({...p, title: e.target.value}))} placeholder="Tiêu đề" />
       <input className="usr-input" type="date" value={newReminder.date} onChange={e=>setNewReminder(p=>({...p, date: e.target.value}))} />
       <button className="usr-btnPrimary" onClick={addReminder}>Thêm</button>
    </div>

    <div className="usr-reminderGrid">
       {assignedTasks.map((task) => (
          <div className="usr-reminderCard" key={`task-${task.id}`} style={{ borderLeft: '4px solid #2563eb', background: '#eff6ff' }}>
             <strong style={{ color: '#1d4ed8' }}>📌 Công việc được giao</strong>
             <div style={{ fontWeight: 700, marginTop: '6px' }}>{task.title}</div>
             {task.description && <p style={{ margin: '8px 0' }}>{task.description}</p>}
             <small>Người giao: {task.manager_name || 'Manager'}</small><br />
             {task.due_date && <small>Hạn chót: {new Date(task.due_date).toLocaleDateString('vi-VN')}</small>}<br />
             <small>Trạng thái: {task.status === 'completed' ? 'Đã hoàn thành' : task.status === 'in_progress' ? 'Đang làm' : 'Đã giao'}</small>
             {task.status !== 'completed' && (
               <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                 <button className="usr-btnPrimary" type="button" style={{ padding: '8px 12px' }} onClick={() => updateTaskStatusLocal(task.id, 'in_progress')} disabled={task.status === 'in_progress'}>
                   Đang làm
                 </button>
                 <button className="usr-btnPrimary" type="button" style={{ padding: '8px 12px', background: '#15803d' }} onClick={() => updateTaskStatusLocal(task.id, 'completed')}>
                   Đã hoàn thành
                 </button>
               </div>
             )}
          </div>
       ))}

       {dbNotifications.map((n) => (
          <div className="usr-reminderCard" key={`dbn-${n.id}`} style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
             <strong style={{ color: '#b45309' }}>{n.title || 'Thông báo'}</strong>
             <p>{n.message}</p>
             <small>{n.created_at ? new Date(n.created_at).toLocaleString('vi-VN') : ''}</small>
          </div>
       ))}

       {/* 🌟 HIỂN THỊ THÔNG BÁO TỪ SOCKET TRƯỚC */}
       {socketNotifications.map(sn => (
          <div className="usr-reminderCard" key={sn.id} style={{ borderLeft: '4px solid #8b5cf6', background: '#f5f3ff' }}>
             <strong style={{ color: '#8b5cf6' }}>📌 CÔNG VIỆC ĐƯỢC GIAO</strong>
             <p>{sn.message}</p>
             <small>Hạn chót: {sn.dueDate} | Nhận lúc: {sn.time}</small>
          </div>
       ))}

       {/* HIỂN THỊ NHẮC NHỞ TỪ DATABASE */}
       {reminders.map(r => (
          <div className="usr-reminderCard" key={r.id}>
             <strong>{r.title}</strong>
             <p>{r.event_date}</p>
             {r.note && <small>{r.note}</small>}
          </div>
       ))}
    </div>
  </section>
)}
      </main>

      {showAccountPanel && (
        <div className="usr-modalOverlay" onClick={() => setShowAccountPanel(false)}>
          <div className="usr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="usr-modalHeader">
              <h2 className="usr-modalTitle">Thông tin tài khoản</h2>
              <button className="usr-modalClose" onClick={() => setShowAccountPanel(false)}>&times;</button>
            </div>
            <div className="usr-modalBody">
              <div className="usr-accountModal-avatarSection">
                <div className="usr-accountModal-avatarLabel">Ảnh hồ sơ</div>
                <ImageUpload onUploadSuccess={(url) => setProfileContentForm(p => ({ ...p, avatar_url: url }))} label="Tải ảnh hoặc dán URL" />
                {(profileStatus === 'pending') && <span className="status-pill pending">Đang chờ duyệt cập nhật hồ sơ</span>}
              </div>
              <div className="usr-accountModal-sectionTitle">Thông tin cá nhân</div>
              <div className="usr-accountModal-grid">
                <input className="usr-input" value={accountForm.surname} onChange={(e) => setAccountForm(p => ({ ...p, surname: e.target.value }))} placeholder="Họ" />
                <input className="usr-input" value={accountForm.middle_name} onChange={(e) => setAccountForm(p => ({ ...p, middle_name: e.target.value }))} placeholder="Tên đệm" />
                <input className="usr-input" value={accountForm.first_name} onChange={(e) => setAccountForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Tên" />
                <input className="usr-input" value={accountForm.email} onChange={(e) => setAccountForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" />
                <div className="usr-accountModal-full"><input className="usr-input" style={{ width: '100%' }} value={accountForm.hometown} onChange={(e) => setAccountForm(p => ({ ...p, hometown: e.target.value }))} placeholder="Quê quán" /></div>
                <div className="usr-accountModal-full"><input className="usr-input" style={{ width: "100%" }} type="number" min={1} value={accountForm.generation} onChange={(e) => setAccountForm((p) => ({ ...p, generation: e.target.value }))} placeholder="Đời" /></div>
                <div className="usr-accountModal-full"><textarea className="usr-textarea" value={profileContentForm.bio} onChange={e => setProfileContentForm(prev => ({ ...prev, bio: e.target.value }))} placeholder="Tiểu sử / Giới thiệu..." rows="3" /></div>
                <div className="usr-accountModal-full" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className="usr-btnPrimary" style={{ flex: 1 }} onClick={saveAccountInfo} disabled={loading || accountMeta.person_id == null}>Lưu thông tin cơ bản</button>
                  <button className="usr-btnPrimary" style={{ flex: 1, background: '#4a148c' }} onClick={submitProfileUpdate} disabled={profileStatus === 'pending'}>Gửi yêu cầu duyệt Ảnh & Bio</button>
                </div>
              </div>

              <div className="usr-accountModal-sectionTitle">Quan hệ gia đình</div>
              <div className="usr-accountModal-full" style={{ marginBottom: 12 }}>
                <label className="usr-familyHint" style={{ display: "block", fontWeight: 700, color: "#334155", marginBottom: 6 }}>Vợ / chồng</label>
                <select className="usr-familySelect" value={accountForm.spouse_id} onChange={(e) => setAccountForm((p) => ({ ...p, spouse_id: e.target.value }))} disabled={accountMeta.person_id == null}>
                  <option value="">— Chưa chọn —</option>
                  {clanMembersForRelations.map((m) => (<option key={m.id} value={m.id}>{personOptionLabel(m)} (id {m.id})</option>))}
                </select>
              </div>
              <div className="usr-accountModal-full" style={{ marginBottom: 12 }}>
                <label className="usr-familyHint" style={{ display: "block", fontWeight: 700, color: "#334155", marginBottom: 6 }}>Con cái</label>
                <div className="usr-childrenGrid">
                  {childCandidatesForRelations.map((m) => (
                    <label key={m.id} className="usr-childRow">
                      <input type="checkbox" checked={selectedChildIdSet.has(Number(m.id))} onChange={() => toggleChildInRelations(Number(m.id))} />
                      <span>{personOptionLabel(m)} (id {m.id})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="usr-accountModal-full" style={{ marginBottom: 16 }}>
                <button className="usr-btnPrimary" style={{ width: "100%" }} type="button" onClick={saveFamilyRelations} disabled={familySaving || loading || accountMeta.person_id == null}>Lưu quan hệ</button>
              </div>

              <div className="usr-accountModal-sectionTitle">Đổi mật khẩu</div>
              <div className="usr-accountModal-grid">
                <input className="usr-input" type="password" value={passwordForm.current} onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))} placeholder="Mật khẩu hiện tại" />
                <input className="usr-input" type="password" value={passwordForm.next} onChange={e => setPasswordForm(p => ({ ...p, next: e.target.value }))} placeholder="Mật khẩu mới" />
                <div className="usr-accountModal-full"><input className="usr-input" style={{ width: '100%' }} type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Xác nhận mật khẩu mới" /></div>
                <div className="usr-accountModal-full"><button className="usr-btnPrimary" style={{ width: '100%' }} onClick={savePassword} disabled={passwordSaving}>{passwordSaving ? "Đang lưu..." : "Đổi mật khẩu"}</button></div>
              </div>

              <div className="usr-accountModal-footer">
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Trạng thái: <strong>{accountMeta.status === 'active' ? 'Đã kích hoạt' : accountMeta.status}</strong></span>
                <button className="usr-btnDanger" onClick={logout}>Đăng xuất</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {treeMemberDetail && (
        <div className="usr-modalOverlay" onClick={() => setTreeMemberDetail(null)}>
          <div className="usr-modal" onClick={e => e.stopPropagation()}>
             <div className="usr-modalHeader">
                <h2 className="usr-modalTitle">{personTreeLabel(treeMemberDetail)}</h2>
                <button className="usr-modalClose" onClick={() => setTreeMemberDetail(null)}>&times;</button>
             </div>
             <div className="usr-modalBody">
                {treeMemberDetail.avatar_url && (
                  <div className="usr-modalAvatarWrap" style={{ marginBottom: '20px', textAlign: 'center' }}>
                    <img className="usr-modalAvatar" src={treeMemberDetail.avatar_url} alt="" style={{ width: '120px', height: '120px' }} />
                  </div>
                )}
                <div className="usr-modalDl">
                    <div className="usr-modalRow"><dt>Đời</dt><dd>{treeMemberDetail.generation}</dd></div>
                    <div className="usr-modalRow"><dt>Quê quán</dt><dd>{treeMemberDetail.hometown}</dd></div>
                    <div className="usr-modalRow"><dt>Tiểu sử</dt><dd>{treeMemberDetail.bio || '—'}</dd></div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Member;
