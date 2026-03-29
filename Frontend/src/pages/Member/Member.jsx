import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./member.css";
import {
  changeMemberPassword,
  createMemberReminder,
  getMemberChat,
  getMemberDashboard,
  sendMemberChat,
  updateMemberProfile,
} from "../../api/memberService";

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

function personTreeLabel(p) {
  return (
    p.display_name ||
    [p.surname, p.middle_name, p.first_name].filter(Boolean).join(" ").trim() ||
    "Thành viên"
  );
}

/** Node: { person, children: Node[] } — cây từ API member/dashboard (phong cách phả đồ truyền thống) */
function FamilyTreeNode({ node, onSelectPerson }) {
  const p = node.person;
  const hasKids = node.children?.length > 0;
  const isLeaf = !hasKids;
  const name = personTreeLabel(p);
  const hometown = (p.hometown && String(p.hometown).trim()) || "";

  return (
    <li className={`usr-phado-branchItem ${isLeaf ? "usr-phado-branchItem--leaf" : ""}`}>
      <div
        className={`usr-phado-card ${isLeaf ? "usr-phado-card--leaf" : "usr-phado-card--scroll"}`}
        role="button"
        tabIndex={0}
        onClick={() => onSelectPerson(p)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectPerson(p);
          }
        }}
      >
        {isLeaf ? (
          <>
            <span className="usr-phado-name">{name}</span>
            {hometown ? <span className="usr-phado-detail">{hometown}</span> : null}
            <span className="usr-phado-meta">Đời {p.generation ?? "—"}</span>
          </>
        ) : (
          <>
            <span className="usr-phado-scrollCap" aria-hidden="true" />
            <div className="usr-phado-cardBody">
              <span className="usr-phado-name">{name}</span>
              <span className="usr-phado-meta">Đời {p.generation ?? "—"}</span>
            </div>
            <span className="usr-phado-scrollCap usr-phado-scrollCap--right" aria-hidden="true" />
          </>
        )}
      </div>
      {hasKids ? (
        <>
          <div className="usr-phado-vbar" aria-hidden="true" />
          <ul className="usr-phado-treeBranch" role="group">
            {node.children.map((ch) => (
              <FamilyTreeNode key={ch.person.id} node={ch} onSelectPerson={onSelectPerson} />
            ))}
          </ul>
        </>
      ) : null}
    </li>
  );
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
  /** Meta chỉ đọc: trạng thái tài khoản & person_id (đồng bộ từ API) */
  const [accountMeta, setAccountMeta] = useState({ status: "", person_id: null, role_id: null });

  const [discoverQuery, setDiscoverQuery] = useState("");
  const discoverResults = useMemo(() => {
    const q = discoverQuery.trim().toLowerCase();
    const all = discoverItemsFromDb;
    if (!q) return all;
    return all.filter((x) => (x.title + " " + x.desc + " " + x.tag).toLowerCase().includes(q));
  }, [discoverItemsFromDb, discoverQuery]);

  // Chatbot (mock)
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

  // Photo restore (frontend-only preview)
  const [photoFile, setPhotoFile] = useState(null);
  const photoUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : ""), [photoFile]);
  const [restoreMode, setRestoreMode] = useState("sharpen");

  // Digitization: Speech-to-text (mock) + OCR (mock)
  const [sttText, setSttText] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrFile, setOcrFile] = useState(null);
  const ocrUrl = useMemo(() => (ocrFile ? URL.createObjectURL(ocrFile) : ""), [ocrFile]);

  // Reminders (frontend-only)
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
      case "discover":
        return "Khám phá di sản";
      case "chat":
        return "Tương tác với trợ lý AI";
      case "tree":
        return "Xem cây gia phả tương tác";
      case "restore":
        return "Phục chế hình ảnh cũ";
      case "digitize":
        return "Số hóa tư liệu (Speech-to-Text & OCR)";
      case "reminders":
        return "Nhận thông báo (Reminders & Alerts)";
      default:
        return "Trang thành viên";
    }
  }, [activeSection]);

  const user = readSessionUser();
  const userName = user?.name || "Thành viên";

  useEffect(() => {
    if (!treeMemberDetail) return;
    const onKey = (e) => {
      if (e.key === "Escape") setTreeMemberDetail(null);
    };
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
      const kidsNums = kidsStr
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v));

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

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <div className={`usr-shell ${viewMode === "classic" ? "isClassic" : ""}`}>
      <aside className="usr-sidebar">
        <div className="usr-brand">
          <div className="usr-logo" aria-hidden="true">
            G
          </div>
          <div className="usr-brandText">
            <div className="usr-brandTitle">Gia Phả</div>
            <div className="usr-brandSub">Xin chào, {userName}</div>
          </div>
        </div>

        <nav className="usr-nav" aria-label="Điều hướng thành viên">
          <button className={`usr-navItem ${activeSection === "discover" ? "isActive" : ""}`} onClick={() => setActiveSection("discover")}>
            Khám phá di sản
          </button>
          <button className={`usr-navItem ${activeSection === "chat" ? "isActive" : ""}`} onClick={() => setActiveSection("chat")}>
            Trợ lý AI (Chatbot)
          </button>
          <button className={`usr-navItem ${activeSection === "tree" ? "isActive" : ""}`} onClick={() => setActiveSection("tree")}>
            Cây gia phả (Interactive)
          </button>
          <div className="usr-navDivider" />
          <button className={`usr-navItem ${activeSection === "restore" ? "isActive" : ""}`} onClick={() => setActiveSection("restore")}>
            Phục chế ảnh cũ
          </button>
          <button className={`usr-navItem ${activeSection === "digitize" ? "isActive" : ""}`} onClick={() => setActiveSection("digitize")}>
            Số hóa tư liệu
          </button>
          <button className={`usr-navItem ${activeSection === "reminders" ? "isActive" : ""}`} onClick={() => setActiveSection("reminders")}>
            Thông báo & nhắc nhở
          </button>
        </nav>
      </aside>

      <main className="usr-main">
        <div className="usr-topbar">
          <div className="usr-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm nhanh…"
              aria-label="Tìm kiếm nhanh"
            />
          </div>
          <div className="usr-topActions">
            <button
              className={`usr-pill usr-pillBtn ${viewMode === "modern" ? "isActive" : ""}`}
              type="button"
              onClick={() => setViewMode("modern")}
            >
              Hiện đại
            </button>
            <button
              className={`usr-pill usr-pillBtn ${viewMode === "classic" ? "isActive" : ""}`}
              type="button"
              onClick={() => setViewMode("classic")}
            >
              Cổ điển
            </button>
            <button className="usr-pill usr-pillBtn" type="button" onClick={() => setShowAccountPanel((v) => !v)}>
              Tài khoản
            </button>
          </div>
        </div>

        {showAccountPanel ? (
          <section className="usr-panel usr-accountPanel">
            <div className="usr-panelTitle">Thông tin tài khoản</div>
            <div className="usr-panelText">
              Chỉnh họ, tên đệm, tên; email, quê quán, đời và quan hệ gia đình (theo mã trong hệ thống). Tên hiển thị trong hệ
              thống được ghép tự động từ họ và tên. Email đăng nhập phải là duy nhất.
            </div>
            <div className="usr-accountReadonly">
              <div>
                <span className="usr-accountReadonlyLabel">Trạng thái</span>
                <span className="usr-accountReadonlyVal">
                  {accountMeta.status === "active"
                    ? "Đang hoạt động"
                    : accountMeta.status === "pending"
                      ? "Chờ duyệt"
                      : accountMeta.status === "rejected"
                        ? "Từ chối"
                        : accountMeta.status || "—"}
                </span>
              </div>
              <div>
                <span className="usr-accountReadonlyLabel">Mã người (person_id)</span>
                <span className="usr-accountReadonlyVal">
                  {accountMeta.person_id != null ? accountMeta.person_id : "Chưa liên kết — không lưu được quan hệ gia đình"}
                </span>
              </div>
            </div>
            <div className="usr-reminderForm usr-accountGrid">
              <input
                className="usr-input"
                value={accountForm.surname}
                onChange={(e) => setAccountForm((p) => ({ ...p, surname: e.target.value }))}
                placeholder="Họ (vd: Nguyễn)"
                autoComplete="family-name"
              />
              <input
                className="usr-input"
                value={accountForm.middle_name}
                onChange={(e) => setAccountForm((p) => ({ ...p, middle_name: e.target.value }))}
                placeholder="Tên đệm (có thể để trống)"
                autoComplete="additional-name"
              />
              <input
                className="usr-input"
                value={accountForm.first_name}
                onChange={(e) => setAccountForm((p) => ({ ...p, first_name: e.target.value }))}
                placeholder="Tên (vd: Văn A)"
                autoComplete="given-name"
              />
              <input
                className="usr-input"
                value={accountForm.email}
                onChange={(e) => setAccountForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email"
                autoComplete="email"
              />
              <input
                className="usr-input"
                value={accountForm.hometown}
                onChange={(e) => setAccountForm((p) => ({ ...p, hometown: e.target.value }))}
                placeholder="Quê quán"
              />
              <input
                className="usr-input"
                value={accountForm.generation}
                onChange={(e) => setAccountForm((p) => ({ ...p, generation: e.target.value }))}
                placeholder="Đời thứ mấy (generation)"
                type="number"
              />
              <input
                className="usr-input"
                value={accountForm.family_id}
                onChange={(e) => setAccountForm((p) => ({ ...p, family_id: e.target.value }))}
                placeholder="ID families"
                type="number"
              />
              <input
                className="usr-input"
                value={accountForm.spouse_id}
                onChange={(e) => setAccountForm((p) => ({ ...p, spouse_id: e.target.value }))}
                placeholder="ID vợ/chồng (people.id)"
                type="number"
              />
              <input
                className="usr-input"
                value={accountForm.children_ids}
                onChange={(e) => setAccountForm((p) => ({ ...p, children_ids: e.target.value }))}
                placeholder="ID con (cách nhau dấu phẩy, ví dụ: 12, 25)"
              />
              <button
                className="usr-btnPrimary"
                type="button"
                onClick={saveAccountInfo}
                disabled={loading || accountMeta.person_id == null}
                title={
                  accountMeta.person_id == null
                    ? "Tài khoản chưa gắn với hồ sơ người trong phả hệ — không thể lưu."
                    : undefined
                }
              >
                Lưu hồ sơ
              </button>
            </div>

            <div className="usr-panelTitle usr-accountPasswordTitle">Đổi mật khẩu</div>
            <div className="usr-panelText">Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 6 ký tự).</div>
            <div className="usr-reminderForm usr-accountGrid">
              <input
                className="usr-input"
                type="password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                placeholder="Mật khẩu hiện tại"
                autoComplete="current-password"
              />
              <input
                className="usr-input"
                type="password"
                value={passwordForm.next}
                onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
                placeholder="Mật khẩu mới"
                autoComplete="new-password"
              />
              <input
                className="usr-input"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
              />
              <button
                className="usr-btnPrimary"
                type="button"
                onClick={savePassword}
                disabled={loading || passwordSaving}
              >
                {passwordSaving ? "Đang đổi…" : "Đổi mật khẩu"}
              </button>
            </div>

            <div className="usr-accountActions">
              <button className="usr-btnDanger" type="button" onClick={logout}>
                Đăng xuất
              </button>
            </div>
          </section>
        ) : null}

        <section className="usr-hero" aria-label="Banner">
          <div className="usr-heroOverlay" />
          <div className="usr-heroContent">
            <div className="usr-heroKicker">Gia Phả Việt</div>
            <div className="usr-heroTitle">{sectionTitle}</div>
            <div className="usr-heroDesc">
              {clanInfo.clan_name
                ? `Dòng họ: ${clanInfo.clan_name}. Tìm kiếm thông tin qua nhiều thế hệ, xem cây gia phả trực quan và quản lý kỷ niệm gia đình.`
                : "Tìm kiếm thông tin qua nhiều thế hệ, xem cây gia phả trực quan, số hóa tư liệu và quản lý kỷ niệm gia đình."}
            </div>
          </div>
        </section>

        {loading ? <section className="usr-panel"><div className="usr-panelText">Đang tải dữ liệu từ cơ sở dữ liệu...</div></section> : null}
        {error ? <section className="usr-panel"><div className="usr-panelText">{error}</div></section> : null}

        {/* DISCOVER */}
        {activeSection === "discover" ? (
          <section className="usr-panel">
            <div className="usr-panelTitle">Tìm kiếm thông tin dòng họ & người thân</div>
            <div className="usr-panelText">Demo UI tìm kiếm nhanh theo tên, vai trò, hoặc tư liệu.</div>
            <div className="usr-row">
              <input
                className="usr-input"
                value={discoverQuery}
                onChange={(e) => setDiscoverQuery(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn, đời thứ 2, Hà Nội…"
              />
              <button className="usr-btnPrimary" type="button" onClick={() => setDiscoverQuery(discoverQuery)}>
                Tìm
              </button>
            </div>

            <div className="usr-resultGrid">
              {discoverResults.map((r, idx) => (
                <div className="usr-resultCard" key={`${r.title}-${idx}`}>
                  <div className="usr-resultTag">{r.tag}</div>
                  <div className="usr-resultTitle">{r.title}</div>
                  <div className="usr-resultDesc">{r.desc}</div>
                </div>
              ))}
            </div>

            <div className="usr-treeMemberHeader">
              Thành viên trong cây ({treeMembers.length} người)
            </div>
            <div className="usr-treeMemberGrid">
              {treeMembers
                .filter((m) => {
                  const q = discoverQuery.trim().toLowerCase();
                  if (!q) return true;
                  return `${m.display_name || ""} ${m.surname || ""} ${m.first_name || ""} ${m.hometown || ""} ${m.generation || ""}`.toLowerCase().includes(q);
                })
                .map((m) => (
                  <div
                    className="usr-treeMemberCard"
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setTreeMemberDetail(m)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setTreeMemberDetail(m);
                      }
                    }}
                  >
                    <div className="usr-treeMemberName">
                      {m.display_name || `${m.surname || ""} ${m.middle_name || ""} ${m.first_name || ""}`.trim()}
                    </div>
                    <div className="usr-treeMemberMeta">
                      Đời thứ {m.generation || "—"}
                    </div>
                    <div className="usr-treeMemberMeta">{m.hometown || "Chưa cập nhật quê quán"}</div>
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        {/* CHATBOT */}
        {activeSection === "chat" ? (
          <section className="usr-panel">
            <div className="usr-panelTitle">Chatbot truy vấn gia phả bằng ngôn ngữ tự nhiên</div>
            <div className="usr-panelText">Hiện là demo frontend (chưa gọi AI thật).</div>

            <div className="usr-chat">
              <div className="usr-chatList" ref={chatListRef}>
                {chat.map((m, i) => (
                  <div key={i} className={`usr-chatMsg ${m.role === "user" ? "isUser" : "isAI"}`}>
                    <div className="usr-chatBubble">{m.text}</div>
                  </div>
                ))}
              </div>
              <div className="usr-chatComposer">
                <input
                  className="usr-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Hỏi: “Ông nội mình là ai?”, “Đời thứ 3 có những ai?”…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChat();
                  }}
                />
                <button className="usr-btnPrimary" type="button" onClick={sendChat}>
                  Gửi
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* TREE — đệ quy từ đời 1, con theo families/children */}
        {activeSection === "tree" ? (
          <section className="usr-panel usr-panel--phado">
            <div className="usr-panelTitle">Cây gia phả</div>
            <div className="usr-panelText">
              Gốc là các thành viên đời 1 (hoặc đời nhỏ nhất). Thế hệ sau lấy từ quan hệ trong bảng gia đình. Bấm vào thẻ để
              xem chi tiết — giao diện phỏng theo phả đồ giấy truyền thống (nền vàng kim, bài họ tên, đường hệ).
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

                <div className="usr-phado-treeWrap">
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
            </div>
          </section>
        ) : null}

        {/* PHOTO RESTORE */}
        {activeSection === "restore" ? (
          <section className="usr-panel">
            <div className="usr-panelTitle">Phục chế hình ảnh cũ (frontend demo)</div>
            <div className="usr-panelText">Hiện chỉ preview + chọn chế độ (chưa xử lý AI thật).</div>

            <div className="usr-row usr-rowWrap">
              <label className="usr-file">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                />
                Chọn ảnh
              </label>

              <select className="usr-select" value={restoreMode} onChange={(e) => setRestoreMode(e.target.value)}>
                <option value="sharpen">Làm sắc nét</option>
                <option value="colorize">Tô màu</option>
                <option value="repair">Sửa lỗi/khôi phục</option>
              </select>

              <button className="usr-btnPrimary" type="button" disabled>
                Chạy AI ({restoreMode})
              </button>
            </div>

            <div className="usr-mediaGrid">
              <div className="usr-mediaCard">
                <div className="usr-mediaTitle">Ảnh gốc</div>
                {photoUrl ? <img className="usr-mediaImg" src={photoUrl} alt="Ảnh gốc" /> : <div className="usr-mediaEmpty">Chưa có ảnh</div>}
              </div>
              <div className="usr-mediaCard">
                <div className="usr-mediaTitle">Kết quả (placeholder)</div>
                <div className="usr-mediaEmpty">Chưa có backend AI để phục chế</div>
              </div>
            </div>
          </section>
        ) : null}

        {/* DIGITIZE */}
        {activeSection === "digitize" ? (
          <section className="usr-grid2">
            <div className="usr-panel">
              <div className="usr-panelTitle">Speech-to-Text (demo)</div>
              <div className="usr-panelText">Ghi lại câu chuyện gia đình (hiện demo nhập tay).</div>
              <textarea
                className="usr-textarea"
                value={sttText}
                onChange={(e) => setSttText(e.target.value)}
                placeholder="Nhập thử nội dung đã chuyển từ giọng nói sang văn bản…"
                rows={8}
              />
              <div className="usr-panelHint">Khi có backend STT, mình sẽ thêm nút ghi âm + gửi audio lên server để nhận transcript.</div>
            </div>

            <div className="usr-panel">
              <div className="usr-panelTitle">OCR nhật ký/tư liệu (demo)</div>
              <div className="usr-panelText">Upload ảnh tư liệu và nhận text (hiện placeholder).</div>
              <label className="usr-file">
                <input type="file" accept="image/*" onChange={(e) => setOcrFile(e.target.files?.[0] || null)} />
                Chọn ảnh tư liệu
              </label>
              {ocrUrl ? <img className="usr-mediaImg usr-mediaImgSmall" src={ocrUrl} alt="Ảnh tư liệu" /> : <div className="usr-mediaEmpty">Chưa có ảnh tư liệu</div>}
              <textarea
                className="usr-textarea"
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                placeholder="Text OCR (demo) — khi có backend OCR sẽ tự đổ vào đây."
                rows={6}
              />
            </div>
          </section>
        ) : null}

        {/* REMINDERS */}
        {activeSection === "reminders" ? (
          <section className="usr-panel">
            <div className="usr-panelTitle">Reminders & Alerts (frontend demo)</div>
            <div className="usr-panelText">Tạo nhắc nhở sự kiện gia đình và xem danh sách nhắc.</div>

            <div className="usr-reminderForm">
              <input
                className="usr-input"
                value={newReminder.title}
                onChange={(e) => setNewReminder((p) => ({ ...p, title: e.target.value }))}
                placeholder="Tên sự kiện (vd: Giỗ cụ, Kỷ niệm…)"
              />
              <input
                className="usr-input"
                type="date"
                value={newReminder.date}
                onChange={(e) => setNewReminder((p) => ({ ...p, date: e.target.value }))}
              />
              <input
                className="usr-input"
                value={newReminder.note}
                onChange={(e) => setNewReminder((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ghi chú (vd: nhắc trước 3 ngày)"
              />
              <button className="usr-btnPrimary" type="button" onClick={addReminder}>
                Thêm nhắc nhở
              </button>
            </div>

            <div className="usr-reminderGrid">
              {reminders
                .filter((r) => {
                  const q = search.trim().toLowerCase();
                  if (!q) return true;
                  return (r.title + " " + (r.description || "") + " " + (r.event_date || "")).toLowerCase().includes(q);
                })
                .map((r) => (
                  <div className="usr-reminderCard" key={r.id}>
                    <div className="usr-reminderTitle">{r.title}</div>
                    <div className="usr-reminderMeta">{r.event_date}</div>
                    <div className="usr-reminderNote">{r.description || "—"}</div>
                  </div>
                ))}
            </div>
          </section>
        ) : null}
      </main>

      {treeMemberDetail ? (
        <div
          className="usr-modalOverlay"
          role="presentation"
          onClick={() => setTreeMemberDetail(null)}
        >
          <div
            className="usr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="usr-tree-member-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="usr-modalClose"
              aria-label="Đóng"
              onClick={() => setTreeMemberDetail(null)}
            >
              ×
            </button>
            {(() => {
              const p = treeMemberDetail;
              const fullName =
                p.display_name ||
                [p.surname, p.middle_name, p.first_name].filter(Boolean).join(" ").trim() ||
                "Thành viên";
              const living =
                p.is_living === undefined || p.is_living === null ? null : Number(p.is_living) === 1;
              const deathStr = formatMemberDate(p.death_date);
              const rows = [
                ["Đời thứ", p.generation != null && p.generation !== "" ? `Đời thứ ${p.generation}` : null],
                ["Chi", p.branch != null && p.branch !== "" ? `Chi thứ ${p.branch}` : null],
                ["Giới tính", genderLabel(p.gender)],
                ["Ngày sinh", formatMemberDate(p.birth_date)],
                living === true ? ["Tình trạng", "Còn sống"] : null,
                living === false || deathStr ? ["Ngày mất", deathStr || (living === false ? "—" : null)] : null,
                ["Quê quán", p.hometown || null],
                ["Địa chỉ", p.address || null],
                ["Điện thoại", p.phone || null],
                ["Email", p.email || null],
                ["Giới thiệu", p.bio || null],
              ].filter((row) => row && row[1] != null && row[1] !== "");
              return (
                <>
                  {p.avatar_url ? (
                    <div className="usr-modalAvatarWrap">
                      <img className="usr-modalAvatar" src={p.avatar_url} alt="" />
                    </div>
                  ) : null}
                  <h2 className="usr-modalTitle" id="usr-tree-member-modal-title">
                    {fullName}
                  </h2>
                  <dl className="usr-modalDl">
                    {rows.map(([label, val]) => (
                      <div className="usr-modalRow" key={label}>
                        <dt>{label}</dt>
                        <dd>{val}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Member;