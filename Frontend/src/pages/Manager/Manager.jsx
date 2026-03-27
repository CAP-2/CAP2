import { useEffect, useMemo, useState } from "react";
import "./manager.css";
import {
  getStats,
  getMembers,
  getPendingUsers,
  approveUserAPI,
  rejectUserAPI,
  getPendingPosts,
  approvePostAPI,
  rejectPostAPI,
  getMediaAPI,
} from "../../api/managerService";

const Manager = () => {
  const [stats, setStats] = useState({
    total_members: 0,
    total_managers: 0,
    total_pending: 0,
  });
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("members");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = async () => {
    setError("");
    setLoading(true);
    try {
      const [statsData, membersData, pendingData, postsData, mediaData] = await Promise.all([
        getStats(),
        getMembers(),
        getPendingUsers(),
        getPendingPosts(),
        getMediaAPI()
      ]);
      setStats(statsData);
      setMembers(membersData);
      setPending(pendingData);
      setPendingPosts(postsData);
      setMediaList(mediaData);
    } catch (e) {
      setError(e?.message || "Không thể tải dữ liệu manager");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

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
    await rejectPostAPI(id);
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
            <button className="mgr-pill" type="button">
              Trẻ
            </button>
            <button className="mgr-pill" type="button">
              Người già
            </button>
            <button className="mgr-iconBtn" type="button" onClick={loadAll} title="Tải lại">
              ↻
            </button>
          </div>
        </div>

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
            <div className="mgr-panel">
              <div className="mgr-panelTitle">Quản lý dữ liệu gia phả (Lineage)</div>
              <div className="mgr-panelText">
                Tạo mới, cập nhật và liên kết các thành viên để xây dựng cây gia phả kỹ thuật số.
              </div>
              <div className="mgr-panelEmpty">Chưa có backend. Hiện mới dựng UI.</div>
              <div className="mgr-panelActions">
                <button className="mgr-btnPrimary" type="button" disabled>
                  Tạo thành viên mới
                </button>
                <button className="mgr-btnGhost" type="button" disabled>
                  Liên kết quan hệ
                </button>
              </div>
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
                  : "Danh sách thành viên (dữ liệu từ backend)."}
              </div>
            </div>

            <div className="mgr-cardGrid">
              {filteredMembers.map((user) => (
                <div className="mgr-card" key={user.account_id}>
                  <div className="mgr-cardCover">
                    <div className="mgr-dot" aria-hidden="true" />
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
                        <button className="mgr-btnOk" onClick={() => doApprove(user.account_id)}>
                          Duyệt
                        </button>
                        <button className="mgr-btnDanger" onClick={() => doReject(user.account_id)}>
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
          <section className="mgr-panel">
            <div className="mgr-panelTitle">Quản lý dữ liệu gia phả (Lineage Management)</div>
            <div className="mgr-panelText">
              Tạo mới, cập nhật và liên kết các thành viên để xây dựng cây gia phả kỹ thuật số.
            </div>
            <div className="mgr-panelEmpty">Chưa triển khai backend. Bạn có thể yêu cầu mình làm CRUD + liên kết cha/mẹ/vợ/chồng/con.</div>
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
          <section>
            <div className="mgr-listHeader">
              <div className="mgr-listTitle">
                Bài viết chờ duyệt ({pendingPosts.length})
              </div>
              <div className="mgr-listHint">
                Kiểm duyệt hình ảnh và thông tin do thành viên đóng góp.
              </div>
            </div>

            <div className="mgr-cardGrid">
              {pendingPosts.map((post) => (
                <div className="mgr-card" key={post.post_id}>
                  <div className="mgr-cardCover" style={{ height: "120px" }}>
                    {post.image_url ? (
                      <img src={post.image_url} alt="Post content" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
                    ) : (
                      <div className="mgr-cardMeta" style={{ padding: "10px", color: "white" }}>[Không có hình ảnh đính kèm]</div>
                    )}
                  </div>
                  
                  <div className="mgr-cardBody">
                    <div className="mgr-cardName">{post.author_name}</div>
                    <div className="mgr-cardMeta" style={{ marginBottom: "10px" }}>{post.author_email}</div>
                    
                    <div className="mgr-cardRows" style={{ WebkitLineClamp: 3, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                      "{post.content}"
                    </div>
                    <div className="mgr-cardMeta" style={{ fontSize: "0.8rem", marginTop: "10px" }}>Đăng lúc: {new Date(post.created_at).toLocaleString()}</div>

                    <div className="mgr-cardActions" style={{ marginTop: "15px" }}>
                      <button className="mgr-btnOk" onClick={() => doApprovePost(post.post_id)}>Duyệt hiển thị</button>
                      <button className="mgr-btnDanger" onClick={() => doRejectPost(post.post_id)}>Từ chối</button>
                    </div>
                  </div>
                </div>
              ))}

              {!loading && pendingPosts.length === 0 ? (
                <div className="mgr-empty">Chưa có bài viết nào chờ duyệt</div>
              ) : null}
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
    </div>
  );
};

export default Manager;
