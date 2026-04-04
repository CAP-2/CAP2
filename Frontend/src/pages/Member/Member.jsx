import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./member.css";
import {
  changeMemberPassword,
  createMemberReminder,
  getMemberChat,
  getMemberDashboard,
  sendMemberChat,
  updateMemberProfile,
  proposeProfileUpdate,
  submitMaterial,
  getMySubmissions
} from "../../api/memberService";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import { FamilyTreeNode, personTreeLabel } from "../../components/PhadoFamilyTree/PhadoFamilyTree";

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

  // Background Polling for dashboard (submission tracking)
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
      const fidStr = String(accountForm.family_id ?? "").trim();
      const sidStr = String(accountForm.spouse_id ?? "").trim();
      const kidsStr = String(accountForm.children_ids ?? "").trim();
      const kidsNums = kidsStr.split(",").map((v) => Number(v.trim())).filter((v) => Number.isFinite(v));

      const payload = {
        surname: accountForm.surname,
        middle_name: accountForm.middle_name,
        first_name: accountForm.first_name,
        email: accountForm.email,
        hometown: accountForm.hometown,
        generation: genNum,
      };
      if (fidStr !== "") payload.family_id = Number(fidStr);
      if (sidStr !== "") payload.spouse_id = Number(sidStr);
      if (kidsStr !== "") payload.children_ids = kidsNums;
      
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

  // Logic cho section General Posts trong trang (reusable)
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

  // Background Polling for clan feed every 20 seconds when active
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
                  <div className="usr-treeMemberCard-cover">
                    {(m.pending_avatar_url || m.avatar_url) ? (
                      <img className="usr-treeMemberAvatar" src={m.pending_avatar_url || m.avatar_url} alt="" />
                    ) : (
                      <div className="usr-treeMemberAvatar-placeholder" />
                    )}
                    {m.moderation_status === 'pending' && <div className="usr-pendingBadge">Đang chờ duyệt</div>}
                  </div>
                  <div className="usr-treeMemberCard-info">
                    <div className="usr-treeMemberName">{m.display_name}</div>
                    <div className="usr-treeMemberMeta">Đời {m.generation} - {m.hometown}</div>
                  </div>
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

        {/* ... remaining sections: general_posts, chat, tree, restore, digitize, reminders ... */}
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
        ) : null}

        {/* TREE — đệ quy từ đời 1, con theo families/children */}
        {activeSection === "tree" ? (
          <section className="usr-panel usr-panel--phado">
            <div className="usr-panelTitle">Cây gia phả</div>
            <div className="usr-panelText">
              Gốc là đời 1 (hoặc đời nhỏ nhất).{" "}
              <strong>Đường đen</strong> là huyết thống từ người cha/mẹ chính (nối con trong DB) xuống các con;{" "}
              <strong>đoạn ngang đỏ</strong> giữa hai thẻ là vợ chồng cùng nhánh (cùng bản ghi <code>families</code> có cha và mẹ).
              Bấm thẻ để xem chi tiết.
            </div>

            <div className="usr-phado">
              <div className="usr-phado-frame">
                <header className="usr-phado-header">
                  <div className="usr-phado-ornament usr-phado-ornament--left" aria-hidden="true" />
                  <div className="usr-phado-titleBlock">
                    <div className="usr-phado-banner">GIA PHẢ</div>
                    <div className="usr-phado-clan">
                      {(clanInfo.clan_name && String(clanInfo.clan_name).trim().toUpperCase()) || "DÒNG HỌ"}
                    </div>
                  </div>
                  <div className="usr-phado-ornament usr-phado-ornament--right" aria-hidden="true" />
                </header>

                <div className="usr-phado-treeWrap usr-phado-treeWrap--bloodline">
                  {familyTreeRoots.length === 0 ? (
                    <div className="usr-phado-empty">
                      Chưa vẽ được cây: kiểm tra bạn đã gắn dòng họ, có ít nhất một thành viên đời gốc và quan hệ cha/mẹ–con
                      trong hệ thống.
                    </div>
                  ) : (
                    <ul className="usr-phado-treeRoot" role="tree" aria-label="Cây gia phả theo đời">
                      {familyTreeRoots.map((root) => (
                        <FamilyTreeNode key={root.person.id} node={root} onSelectPerson={setTreeMemberDetail} />
                      ))}
                    </ul>
                  )}
                </div>
             </div>
           </section>
        )}

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
            <div className="usr-panelTitle">Nhắc nhở</div>
            <div className="usr-reminderForm">
               <input className="usr-input" value={newReminder.title} onChange={e=>setNewReminder(p=>({...p, title: e.target.value}))} placeholder="Tiêu đề" />
               <input className="usr-input" type="date" value={newReminder.date} onChange={e=>setNewReminder(p=>({...p, date: e.target.value}))} />
               <button className="usr-btnPrimary" onClick={addReminder}>Thêm</button>
            </div>
            <div className="usr-reminderGrid">
               {reminders.map(r => <div className="usr-reminderCard" key={r.id}><strong>{r.title}</strong><p>{r.event_date}</p></div>)}
            </div>
          </section>
        )}
      </main>

      {/* Account Modal */}
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
                <ImageUpload 
                  onUploadSuccess={(url) => setProfileContentForm(p => ({ ...p, avatar_url: url }))} 
                  label="Tải ảnh hoặc dán URL" 
                />
                {(profileStatus === 'pending') && <span className="status-pill pending">Đang chờ duyệt cập nhật hồ sơ</span>}
              </div>

              <div className="usr-accountModal-sectionTitle">Thông tin cá nhân</div>
              <div className="usr-accountModal-grid">
                <input className="usr-input" value={accountForm.surname} onChange={(e) => setAccountForm(p => ({ ...p, surname: e.target.value }))} placeholder="Họ" />
                <input className="usr-input" value={accountForm.middle_name} onChange={(e) => setAccountForm(p => ({ ...p, middle_name: e.target.value }))} placeholder="Tên đệm" />
                <input className="usr-input" value={accountForm.first_name} onChange={(e) => setAccountForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Tên" />
                <input className="usr-input" value={accountForm.email} onChange={(e) => setAccountForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" />
                <div className="usr-accountModal-full">
                  <input className="usr-input" style={{ width: '100%' }} value={accountForm.hometown} onChange={(e) => setAccountForm(p => ({ ...p, hometown: e.target.value }))} placeholder="Quê quán" />
                </div>
                <div className="usr-accountModal-full">
                  <textarea className="usr-textarea" value={profileContentForm.bio} onChange={e => setProfileContentForm(prev => ({ ...prev, bio: e.target.value }))} placeholder="Tiểu sử / Giới thiệu..." rows="3" />
                </div>
                <div className="usr-accountModal-full" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className="usr-btnPrimary" style={{ flex: 1 }} onClick={saveAccountInfo} disabled={loading || accountMeta.person_id == null}>Lưu thông tin cơ bản</button>
                  <button className="usr-btnPrimary" style={{ flex: 1, background: '#4a148c' }} onClick={submitProfileUpdate} disabled={profileStatus === 'pending'}>Gửi yêu cầu duyệt Ảnh & Bio</button>
                </div>
              </div>

              <div className="usr-accountModal-sectionTitle">Đổi mật khẩu</div>
              <div className="usr-accountModal-grid">
                <input className="usr-input" type="password" value={passwordForm.current} onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))} placeholder="Mật khẩu hiện tại" />
                <input className="usr-input" type="password" value={passwordForm.next} onChange={e => setPasswordForm(p => ({ ...p, next: e.target.value }))} placeholder="Mật khẩu mới" />
                <div className="usr-accountModal-full">
                  <input className="usr-input" style={{ width: '100%' }} type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Xác nhận mật khẩu mới" />
                </div>
                <div className="usr-accountModal-full">
                  <button className="usr-btnPrimary" style={{ width: '100%' }} onClick={savePassword} disabled={passwordSaving}>
                    {passwordSaving ? "Đang lưu..." : "Đổi mật khẩu"}
                  </button>
                </div>
              </div>

              <div className="usr-accountModal-footer">
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Trạng thái: <strong>{accountMeta.status === 'active' ? 'Đã kích hoạt' : accountMeta.status}</strong></span>
                <button className="usr-btnDanger" onClick={logout}>Đăng xuất tài khoản</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Person Detail Modal */}
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