import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./member.css";
import {
  createMemberReminder,
  getMemberChat,
  getMemberDashboard,
  sendMemberChat,
  updateMemberProfile,
} from "../../api/memberService";

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
    display_name: "",
    email: "",
    hometown: "",
    generation: "",
    family_id: "",
    spouse_id: "",
    children_ids: "",
  });

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
  const [discoverItemsFromDb, setDiscoverItemsFromDb] = useState([]);

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

  // Interactive visualization (placeholder)
  const treeNodes = useMemo(() => {
    const sample = treeMembers.slice(0, 5);
    const positions = [
      { x: 160, y: 40 },
      { x: 80, y: 120 },
      { x: 240, y: 120 },
      { x: 80, y: 200 },
      { x: 240, y: 200 },
    ];
    return sample.map((m, idx) => ({
      id: String(m.id),
      label: m.display_name || `${m.surname || ""} ${m.first_name || ""}`.trim(),
      x: positions[idx]?.x || 160,
      y: positions[idx]?.y || 40 + idx * 30,
    }));
  }, [treeMembers]);

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

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const userName = user?.name || "Thành viên";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const dash = await getMemberDashboard();
        const p = dash.profile || {};
        const c = dash.clan || {};
        setClanInfo({ clan_name: c.clan_name || "", history: c.history || "" });
        setTreeMembers(dash.treeMembers || []);
        setDiscoverItemsFromDb(dash.discoverItems || []);
        setReminders(dash.reminders || []);
        setAccountForm({
          display_name: p.display_name || user?.name || "",
          email: p.email || user?.email || "",
          hometown: p.hometown || user?.hometown || "",
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
        setLoading(false);
      }
    };
    load();
  }, [user?.email, user?.hometown, user?.name]);

  const saveAccountInfo = async () => {
    try {
      const payload = {
        ...accountForm,
        generation:
          String(accountForm.generation).trim() === ""
            ? null
            : Number(accountForm.generation),
        family_id:
          String(accountForm.family_id).trim() === ""
            ? null
            : Number(accountForm.family_id),
        spouse_id:
          String(accountForm.spouse_id).trim() === ""
            ? null
            : Number(accountForm.spouse_id),
        children_ids: String(accountForm.children_ids || "")
          .split(",")
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isFinite(v)),
      };
      const res = await updateMemberProfile(payload);
      const p = res.profile || {};
      const merged = {
        ...user,
        name: p.display_name || accountForm.display_name || user?.name || "Thành viên",
        email: p.email || accountForm.email || user?.email || "",
        hometown: p.hometown || accountForm.hometown || user?.hometown || "",
        status: p.status || user?.status,
        role_id: p.role_id || user?.role_id,
      };
      localStorage.setItem("user", JSON.stringify(merged));
      setAccountForm((prev) => ({
        ...prev,
        generation: p.generation ?? prev.generation,
        family_id: p.family_id ?? "",
        spouse_id: p.spouse_id ?? "",
        children_ids: Array.isArray(p.children_ids) ? p.children_ids.join(", ") : prev.children_ids,
      }));
      setShowAccountPanel(false);
      setError("");
    } catch {
      setError("Không thể cập nhật thông tin tài khoản");
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
              Bạn có thể chỉnh sửa thông tin cơ bản, khai báo quan hệ gia đình (ID people) và đăng xuất.
            </div>
            <div className="usr-reminderForm usr-accountGrid">
              <input
                className="usr-input"
                value={accountForm.display_name}
                onChange={(e) => setAccountForm((p) => ({ ...p, display_name: e.target.value }))}
                placeholder="Tên hiển thị"
              />
              <input
                className="usr-input"
                value={accountForm.email}
                onChange={(e) => setAccountForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email"
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
              <button className="usr-btnPrimary" type="button" onClick={saveAccountInfo}>
                Lưu thay đổi
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
                  <div className="usr-treeMemberCard" key={m.id}>
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

        {/* TREE */}
        {activeSection === "tree" ? (
          <section className="usr-panel">
            <div className="usr-panelTitle">Interactive Visualization (demo)</div>
            <div className="usr-panelText">Hiện là sơ đồ mẫu để mô phỏng cây gia phả tương tác.</div>

            <div className="usr-treeWrap">
              <svg className="usr-tree" viewBox="0 0 320 240" role="img" aria-label="Cây gia phả demo">
                <line x1="160" y1="52" x2="80" y2="112" stroke="rgba(111,127,152,0.55)" strokeWidth="2" />
                <line x1="160" y1="52" x2="240" y2="112" stroke="rgba(111,127,152,0.55)" strokeWidth="2" />
                <line x1="80" y1="132" x2="80" y2="192" stroke="rgba(111,127,152,0.55)" strokeWidth="2" />
                <line x1="240" y1="132" x2="240" y2="192" stroke="rgba(111,127,152,0.55)" strokeWidth="2" />

                {treeNodes.map((n) => (
                  <g key={n.id}>
                    <rect x={n.x - 46} y={n.y - 16} width="92" height="32" rx="12" fill="white" stroke="rgba(228,235,245,1)" />
                    <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="11" fill="#2a3a58" fontWeight="700">
                      {n.label}
                    </text>
                  </g>
                ))}
              </svg>

              <div className="usr-treeHint">
                Bạn muốn cây tương tác thật (zoom/pan, click node, load dữ liệu nhiều thế hệ) thì mình sẽ tích hợp thư viện (ví dụ React Flow / D3) và nối API.
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
    </div>
  );
};

export default Member;