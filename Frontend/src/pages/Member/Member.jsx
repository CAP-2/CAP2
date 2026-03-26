import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./member.css";

const Member = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("discover");
  const [search, setSearch] = useState("");

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

  // Discover (mock)
  const [discoverQuery, setDiscoverQuery] = useState("");
  const discoverResults = useMemo(() => {
    const q = discoverQuery.trim().toLowerCase();
    const mock = [
      { title: "Dòng họ Nguyễn", desc: "Gợi ý: xem danh sách thành viên theo đời.", tag: "Dòng họ" },
      { title: "Nguyễn Văn Tí", desc: "Con trai • Đời thứ 1 • Hà Nội", tag: "Thành viên" },
      { title: "Trần Thị Hoa", desc: "Bà nội • Đời thứ 1 • Hà Nam", tag: "Thành viên" },
      { title: "Nguyễn Văn Hùng", desc: "Con trai • Đời thứ 2 • Hà Nội", tag: "Thành viên" },
      { title: "Lịch sử gia đình", desc: "Tư liệu truyền miệng và nhật ký số hóa.", tag: "Tư liệu" },
    ];
    if (!q) return mock;
    return mock.filter((x) => (x.title + " " + x.desc + " " + x.tag).toLowerCase().includes(q));
  }, [discoverQuery]);

  // Chatbot (mock)
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState([
    { role: "ai", text: "Chào bạn! Bạn có thể hỏi về phả hệ, người thân, hoặc sự kiện gia đình." },
  ]);
  const chatListRef = useRef(null);

  const respondAI = (text) => {
    const t = text.toLowerCase();
    if (t.includes("đời") || t.includes("thế hệ")) {
      return "Bạn có thể lọc theo “Đời” để xem các thế hệ. Hiện phần này là demo UI; nếu bạn muốn mình sẽ nối backend để truy vấn thật.";
    }
    if (t.includes("ai") || t.includes("trợ lý") || t.includes("chatbot")) {
      return "Mình đang ở chế độ demo. Khi có API AI, mình sẽ gửi câu hỏi lên server và trả về câu trả lời theo ngữ cảnh gia phả.";
    }
    if (t.includes("nguyễn") || t.includes("họ")) {
      return "Gợi ý: thử tìm “Nguyễn Văn” hoặc “Dòng họ Nguyễn”. Bạn cũng có thể mở “Xem cây gia phả” để xem sơ đồ trực quan.";
    }
    return "Mình đã ghi nhận câu hỏi. Bạn muốn truy vấn theo người (tên/email) hay theo tư liệu (ảnh/ghi âm/nhật ký)?";
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChat((prev) => [...prev, { role: "user", text }, { role: "ai", text: respondAI(text) }]);
    setChatInput("");
    setTimeout(() => {
      if (chatListRef.current) chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }, 0);
  };

  // Interactive visualization (placeholder)
  const treeNodes = useMemo(
    () => [
      { id: "a", label: "Ông/Bà", x: 160, y: 40 },
      { id: "b", label: "Bố/Mẹ", x: 80, y: 120 },
      { id: "c", label: "Chú/Dì", x: 240, y: 120 },
      { id: "d", label: "Bạn", x: 80, y: 200 },
      { id: "e", label: "Anh/Chị/Em", x: 240, y: 200 },
    ],
    []
  );

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
  const [reminders, setReminders] = useState([
    { id: "r1", title: "Giỗ tổ", date: "2026-04-12", note: "Nhắc trước 3 ngày" },
    { id: "r2", title: "Kỷ niệm thành lập dòng họ", date: "2026-06-01", note: "Nhắc trước 7 ngày" },
  ]);
  const [newReminder, setNewReminder] = useState({ title: "", date: "", note: "" });

  const addReminder = () => {
    if (!newReminder.title.trim() || !newReminder.date) return;
    setReminders((prev) => [
      { id: `r${Date.now()}`, title: newReminder.title.trim(), date: newReminder.date, note: newReminder.note.trim() },
      ...prev,
    ]);
    setNewReminder({ title: "", date: "", note: "" });
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

  const userName = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return u?.name || "Thành viên";
    } catch {
      return "Thành viên";
    }
  }, []);

  return (
    <div className="usr-shell">
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
            <span className="usr-pill">User</span>
            <span className="usr-pill">Demo</span>
          </div>
        </div>

        <section className="usr-hero" aria-label="Banner">
          <div className="usr-heroOverlay" />
          <div className="usr-heroContent">
            <div className="usr-heroKicker">Gia Phả Việt</div>
            <div className="usr-heroTitle">{sectionTitle}</div>
            <div className="usr-heroDesc">
              Tìm kiếm thông tin qua nhiều thế hệ, xem cây gia phả trực quan, số hóa tư liệu và quản lý kỷ niệm gia đình.
            </div>
          </div>
        </section>

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
                  return (r.title + " " + r.note + " " + r.date).toLowerCase().includes(q);
                })
                .map((r) => (
                  <div className="usr-reminderCard" key={r.id}>
                    <div className="usr-reminderTitle">{r.title}</div>
                    <div className="usr-reminderMeta">{r.date}</div>
                    <div className="usr-reminderNote">{r.note || "—"}</div>
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