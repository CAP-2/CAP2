import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approvePostAPI,
  approveMemoryAPI,
  approveProfileUpdateAPI,
  approveUserAPI,
  getPendingReviewData,
  rejectPostAPI,
  rejectMemoryAPI,
  rejectProfileUpdateAPI,
  rejectUserAPI,
} from "../../api/managerService";
import { avatarInitial, formatDate, fullName } from "./managerData";
import "./PendingApprovals.css";

const isVideoUrl = (value = "") =>
  /[?&]media=video(?:&|$)/i.test(String(value)) ||
  /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(value));

const safeText = (value, fallback = "Chưa có thông tin") => {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
};

function MediaPreview({ url, type = "" }) {
  if (!url) return null;

  const isImage = type === "image" || /\.(png|jpg|jpeg|gif|webp|avif)(\?|#|$)/i.test(url);
  const isVideo = type === "video" || isVideoUrl(url);

  return (
    <a
      className="pending-pro-thumb-link"
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Mở tệp đính kèm"
    >
      {isVideo ? (
        <video className="pending-pro-thumb" src={url} muted playsInline preload="metadata" />
      ) : isImage ? (
        <img className="pending-pro-thumb" src={url} alt="" />
      ) : (
        <span className="pending-pro-file material-symbols-outlined">
          {type === "audio" ? "graphic_eq" : "attach_file"}
        </span>
      )}
    </a>
  );
}

export default function PendingApprovals() {
  const [activeTab, setActiveTab] = useState("users");
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [pendingMemories, setPendingMemories] = useState([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getPendingReviewData();

      setPendingUsers(data.pendingUsers || []);
      setPendingPosts(data.pendingPosts || []);
      setPendingProfiles(data.pendingProfiles || []);
      setPendingMemories(data.pendingMemories || []);
    } catch (err) {
      setError(err?.message || "Không thể tải danh sách chờ duyệt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const totalPending =
    pendingUsers.length +
    pendingPosts.length +
    pendingProfiles.length +
    pendingMemories.length;

  const tabs = [
    {
      key: "users",
      label: "Tài khoản mới",
      shortLabel: "Tài khoản",
      icon: "person_add",
      count: pendingUsers.length,
    },
    {
      key: "posts",
      label: "Bài viết",
      shortLabel: "Bài viết",
      icon: "article",
      count: pendingPosts.length,
    },
    {
      key: "profiles",
      label: "Hồ sơ",
      shortLabel: "Hồ sơ",
      icon: "badge",
      count: pendingProfiles.length,
    },
    {
      key: "memories",
      label: "Kỉ niệm",
      shortLabel: "Kỉ niệm",
      icon: "collections_bookmark",
      count: pendingMemories.length,
    },
  ];

  const currentTab = tabs.find((tab) => tab.key === activeTab) || tabs[0];

  const normalizeText = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const runAction = async (action, successMessage, id = "") => {
    setMessage("");
    setError("");
    setActingId(id);

    try {
      await action();
      setMessage(successMessage);
      await loadPending();
    } catch (err) {
      setError(err?.message || "Thao tác thất bại");
    } finally {
      setActingId("");
    }
  };

  const rejectPost = (id) => {
    const reason = window.prompt("Lý do từ chối bài viết:", "Nội dung chưa phù hợp");
    if (reason === null) return;
    runAction(() => rejectPostAPI(id, reason), "Đã từ chối bài viết", `post-${id}`);
  };

  const rejectProfile = (id) => {
    const reason = window.prompt("Lý do từ chối cập nhật hồ sơ:", "Thông tin chưa đủ rõ");
    if (reason === null) return;
    runAction(() => rejectProfileUpdateAPI(id, reason), "Đã từ chối cập nhật hồ sơ", `profile-${id}`);
  };

  const rejectMemory = (id) => {
    const reason = window.prompt("Lý do từ chối kỉ niệm:", "Nội dung chưa phù hợp");
    if (reason === null) return;
    runAction(() => rejectMemoryAPI(id, reason), "Đã từ chối kỉ niệm dòng họ", `memory-${id}`);
  };

  const filteredUsers = useMemo(() => {
    const q = normalizeText(search);

    return pendingUsers.filter((user) => {
      if (!q) return true;

      return [fullName(user), user.email, user.phone, user.hometown, user.birth_date]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(q));
    });
  }, [pendingUsers, search]);

  const filteredPosts = useMemo(() => {
    const q = normalizeText(search);

    return pendingPosts.filter((post) => {
      if (!q) return true;

      return [
        post.author_name,
        post.author_email,
        post.description,
        post.content,
        post.image_url,
        post.created_at,
      ]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(q));
    });
  }, [pendingPosts, search]);

  const filteredProfiles = useMemo(() => {
    const q = normalizeText(search);

    return pendingProfiles.filter((profile) => {
      if (!q) return true;

      return [
        fullName(profile),
        profile.pending_bio,
        profile.pending_avatar_url,
        profile.email,
        profile.person_id,
      ]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(q));
    });
  }, [pendingProfiles, search]);

  const filteredMemories = useMemo(() => {
    const q = normalizeText(search);

    return pendingMemories.filter((memory) => {
      if (!q) return true;

      return [
        memory.title,
        memory.author_name,
        memory.content,
        memory.original_filename,
        memory.media_url,
        memory.created_at,
      ]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(q));
    });
  }, [pendingMemories, search]);

  const activeCount = {
    users: filteredUsers.length,
    posts: filteredPosts.length,
    profiles: filteredProfiles.length,
    memories: filteredMemories.length,
  }[activeTab];

  const summaryCards = [
    {
      icon: "pending_actions",
      label: "Tổng chờ duyệt",
      value: totalPending,
      tone: "gold",
    },
    {
      icon: "person_add",
      label: "Tài khoản mới",
      value: pendingUsers.length,
      tone: "red",
    },
    {
      icon: "article",
      label: "Bài viết",
      value: pendingPosts.length,
      tone: "green",
    },
    {
      icon: "collections_bookmark",
      label: "Kỉ niệm",
      value: pendingMemories.length,
      tone: "slate",
    },
  ];

  return (
    <div className="pending-page pending-pro-page">
      <section className="pending-pro-hero">
        <div className="pending-pro-hero-left">
          <div className="pending-pro-hero-icon">
            <span className="material-symbols-outlined">fact_check</span>
          </div>

          <div>
            <span className="pending-pro-kicker">Trung tâm kiểm duyệt</span>
            <h2>Duyệt chờ</h2>
            <p>
              Kiểm tra tài khoản mới, bài viết, hồ sơ cập nhật và kỉ niệm dòng họ
              trước khi hiển thị công khai.
            </p>
          </div>
        </div>

        <div className="pending-pro-hero-actions">
          <button
            className="pending-pro-btn pending-pro-btn-light"
            type="button"
            onClick={loadPending}
            disabled={loading}
          >
            <span className="material-symbols-outlined">refresh</span>
            {loading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
      </section>

      {message && <div className="manager-inline-message pending-pro-alert">{message}</div>}
      {error && <div className="manager-inline-error pending-pro-alert">{error}</div>}

      <section className="pending-pro-summary-grid">
        {summaryCards.map((card) => (
          <div key={card.label} className={`pending-pro-summary-card ${card.tone}`}>
            <span className="material-symbols-outlined">{card.icon}</span>

            <div>
              <strong>{loading ? "..." : card.value}</strong>
              <p>{card.label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="pending-pro-control-panel">
        <div className="pending-pro-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`pending-pro-tab ${activeTab === tab.key ? "active" : ""}`}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span>{tab.shortLabel}</span>
              <b>{tab.count}</b>
            </button>
          ))}
        </div>

        <div className="pending-pro-search">
          <span className="material-symbols-outlined">search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Tìm trong ${currentTab.label.toLowerCase()}...`}
          />
        </div>
      </section>

      <section className="pending-pro-content-card">
        <div className="pending-pro-content-head">
          <div>
            <h3>{currentTab.label}</h3>
            <p>
              Đang hiển thị <strong>{activeCount}</strong> mục trong nhóm{" "}
              <strong>{currentTab.label.toLowerCase()}</strong>.
            </p>
          </div>

          <span className="pending-pro-badge">
            {currentTab.count} mục chờ
          </span>
        </div>

        <div className="pending-pro-list">
          {loading && (
            <div className="pending-pro-empty">
              <span className="material-symbols-outlined">progress_activity</span>
              Đang tải dữ liệu chờ duyệt...
            </div>
          )}

          {!loading && activeTab === "users" && (
            <>
              {filteredUsers.map((user) => (
                <article key={user.account_id} className="pending-pro-item">
                  <div className="pending-pro-main">
                    <div className="pending-pro-avatar">{avatarInitial(user)}</div>

                    <div className="pending-pro-info">
                      <span className="pending-pro-type">Tài khoản mới</span>
                      <h4>{fullName(user)}</h4>
                      <p>{safeText(user.email, "Chưa có email")}</p>

                      <div className="pending-pro-meta">
                        <span>Ngày sinh: {formatDate(user.birth_date)}</span>
                        {user.hometown && <span>Quê quán: {user.hometown}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="pending-pro-actions">
                    <button
                      className="pending-pro-approve"
                      type="button"
                      disabled={actingId === `user-${user.account_id}`}
                      onClick={() =>
                        runAction(
                          () => approveUserAPI(user.account_id),
                          "Đã phê duyệt tài khoản",
                          `user-${user.account_id}`
                        )
                      }
                    >
                      <span className="material-symbols-outlined">check_circle</span>
                      Phê duyệt
                    </button>

                    <button
                      className="pending-pro-reject"
                      type="button"
                      disabled={actingId === `user-${user.account_id}`}
                      onClick={() =>
                        runAction(
                          () => rejectUserAPI(user.account_id),
                          "Đã từ chối tài khoản",
                          `user-${user.account_id}`
                        )
                      }
                    >
                      <span className="material-symbols-outlined">cancel</span>
                      Từ chối
                    </button>
                  </div>
                </article>
              ))}

              {!filteredUsers.length && (
                <div className="pending-pro-empty">
                  <span className="material-symbols-outlined">verified</span>
                  Không có tài khoản chờ duyệt.
                </div>
              )}
            </>
          )}

          {!loading && activeTab === "posts" && (
            <>
              {filteredPosts.map((post) => (
                <article key={post.post_id} className="pending-pro-item">
                  <div className="pending-pro-main">
                    <MediaPreview url={post.image_url} />

                    {!post.image_url && (
                      <div className="pending-pro-avatar pending-pro-avatar-soft">
                        <span className="material-symbols-outlined">article</span>
                      </div>
                    )}

                    <div className="pending-pro-info">
                      <span className="pending-pro-type">Bài viết</span>
                      <h4>{post.author_name || post.author_email || "Người gửi"}</h4>

                      <p className="pending-pro-preview">
                        {post.description || post.content || "[Không có nội dung chữ]"}
                      </p>

                      {post.image_url && (
                        <a
                          className="pending-pro-link"
                          href={post.image_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {post.image_url}
                        </a>
                      )}

                      <div className="pending-pro-meta">
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pending-pro-actions">
                    <button
                      className="pending-pro-approve"
                      type="button"
                      disabled={actingId === `post-${post.post_id}`}
                      onClick={() =>
                        runAction(
                          () => approvePostAPI(post.post_id),
                          "Đã phê duyệt bài viết",
                          `post-${post.post_id}`
                        )
                      }
                    >
                      <span className="material-symbols-outlined">check_circle</span>
                      Duyệt bài
                    </button>

                    <button
                      className="pending-pro-reject"
                      type="button"
                      disabled={actingId === `post-${post.post_id}`}
                      onClick={() => rejectPost(post.post_id)}
                    >
                      <span className="material-symbols-outlined">cancel</span>
                      Từ chối
                    </button>
                  </div>
                </article>
              ))}

              {!filteredPosts.length && (
                <div className="pending-pro-empty">
                  <span className="material-symbols-outlined">verified</span>
                  Không có bài viết chờ duyệt.
                </div>
              )}
            </>
          )}

          {!loading && activeTab === "profiles" && (
            <>
              {filteredProfiles.map((profile) => (
                <article key={profile.person_id} className="pending-pro-item">
                  <div className="pending-pro-main">
                    <div className="pending-pro-avatar">{avatarInitial(profile)}</div>

                    <div className="pending-pro-info">
                      <span className="pending-pro-type">Cập nhật hồ sơ</span>
                      <h4>{fullName(profile)}</h4>

                      <div className="pending-pro-change-box">
                        <p>
                          <b>Bio mới:</b> {profile.pending_bio || "Không thay đổi"}
                        </p>
                        <p>
                          <b>Ảnh mới:</b> {profile.pending_avatar_url || "Không thay đổi"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pending-pro-actions">
                    <button
                      className="pending-pro-approve"
                      type="button"
                      disabled={actingId === `profile-${profile.person_id}`}
                      onClick={() =>
                        runAction(
                          () => approveProfileUpdateAPI(profile.person_id),
                          "Đã phê duyệt hồ sơ",
                          `profile-${profile.person_id}`
                        )
                      }
                    >
                      <span className="material-symbols-outlined">check_circle</span>
                      Phê duyệt
                    </button>

                    <button
                      className="pending-pro-reject"
                      type="button"
                      disabled={actingId === `profile-${profile.person_id}`}
                      onClick={() => rejectProfile(profile.person_id)}
                    >
                      <span className="material-symbols-outlined">cancel</span>
                      Từ chối
                    </button>
                  </div>
                </article>
              ))}

              {!filteredProfiles.length && (
                <div className="pending-pro-empty">
                  <span className="material-symbols-outlined">verified</span>
                  Không có hồ sơ chờ duyệt.
                </div>
              )}
            </>
          )}

          {!loading && activeTab === "memories" && (
            <>
              {filteredMemories.map((memory) => (
                <article key={memory.id} className="pending-pro-item">
                  <div className="pending-pro-main">
                    <MediaPreview url={memory.media_url} type={memory.media_type} />

                    {!memory.media_url && (
                      <div className="pending-pro-avatar pending-pro-avatar-soft">
                        <span className="material-symbols-outlined">collections_bookmark</span>
                      </div>
                    )}

                    <div className="pending-pro-info">
                      <span className="pending-pro-type">Kỉ niệm dòng họ</span>
                      <h4>{memory.title || "Kỉ niệm dòng họ"}</h4>
                      <p>{memory.author_name || "Thành viên dòng họ"}</p>

                      <p className="pending-pro-preview">
                        {memory.content || memory.original_filename || "[Không có nội dung chữ]"}
                      </p>

                      <div className="pending-pro-meta">
                        <span>{formatDate(memory.created_at)}</span>
                        {memory.media_type && <span>Loại tệp: {memory.media_type}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="pending-pro-actions">
                    <button
                      className="pending-pro-approve"
                      type="button"
                      disabled={actingId === `memory-${memory.id}`}
                      onClick={() =>
                        runAction(
                          () => approveMemoryAPI(memory.id),
                          "Đã phê duyệt kỉ niệm",
                          `memory-${memory.id}`
                        )
                      }
                    >
                      <span className="material-symbols-outlined">check_circle</span>
                      Duyệt kỉ niệm
                    </button>

                    <button
                      className="pending-pro-reject"
                      type="button"
                      disabled={actingId === `memory-${memory.id}`}
                      onClick={() => rejectMemory(memory.id)}
                    >
                      <span className="material-symbols-outlined">cancel</span>
                      Từ chối
                    </button>
                  </div>
                </article>
              ))}

              {!filteredMemories.length && (
                <div className="pending-pro-empty">
                  <span className="material-symbols-outlined">verified</span>
                  Không có kỉ niệm chờ duyệt.
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}