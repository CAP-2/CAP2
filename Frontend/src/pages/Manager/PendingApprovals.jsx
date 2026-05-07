import { useCallback, useEffect, useState } from "react";
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

export default function PendingApprovals() {
  const [activeTab, setActiveTab] = useState("users");
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [pendingMemories, setPendingMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPendingReviewData();
      setPendingUsers(data.pendingUsers);
      setPendingPosts(data.pendingPosts);
      setPendingProfiles(data.pendingProfiles);
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

  const runAction = async (action, successMessage) => {
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(successMessage);
      await loadPending();
    } catch (err) {
      setError(err?.message || "Thao tác thất bại");
    }
  };

  const rejectPost = (id) => {
    const reason = window.prompt("Lý do từ chối bài viết:", "Nội dung chưa phù hợp");
    if (reason === null) return;
    runAction(() => rejectPostAPI(id, reason), "Đã từ chối bài viết");
  };

  const rejectProfile = (id) => {
    const reason = window.prompt("Lý do từ chối cập nhật hồ sơ:", "Thông tin chưa đủ rõ");
    if (reason === null) return;
    runAction(() => rejectProfileUpdateAPI(id, reason), "Đã từ chối cập nhật hồ sơ");
  };

  const rejectMemory = (id) => {
    const reason = window.prompt("Lý do từ chối kỉ niệm:", "Nội dung chưa phù hợp");
    if (reason === null) return;
    runAction(() => rejectMemoryAPI(id, reason), "Đã từ chối kỉ niệm dòng họ");
  };

  return (
    <div className="pending-page animate-fade-in">
      <div className="tab-navigation glass-effect">
        <button className={`tab-btn ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
          <span className="material-symbols-outlined">person_add</span>
          Tài khoản mới ({pendingUsers.length})
        </button>
        <button className={`tab-btn ${activeTab === "posts" ? "active" : ""}`} onClick={() => setActiveTab("posts")}>
          <span className="material-symbols-outlined">article</span>
          Bài viết ({pendingPosts.length})
        </button>
        <button className={`tab-btn ${activeTab === "profiles" ? "active" : ""}`} onClick={() => setActiveTab("profiles")}>
          <span className="material-symbols-outlined">badge</span>
          Hồ sơ ({pendingProfiles.length})
        </button>
        <button className={`tab-btn ${activeTab === "memories" ? "active" : ""}`} onClick={() => setActiveTab("memories")}>
          <span className="material-symbols-outlined">collections_bookmark</span>
          Kỉ niệm ({pendingMemories.length})
        </button>
        <button className="tab-btn" onClick={loadPending} disabled={loading}>
          <span className="material-symbols-outlined">refresh</span>
          Tải lại
        </button>
      </div>

      {message && <div className="manager-inline-message">{message}</div>}
      {error && <div className="manager-inline-error">{error}</div>}

      <div className="pending-content">
        {activeTab === "users" && (
          <div className="pending-list">
            {pendingUsers.map((user) => (
              <div key={user.account_id} className="pending-item glass-effect">
                <div className="item-main">
                  <div className="item-avatar">{avatarInitial(user)}</div>
                  <div className="item-info">
                    <h4>{fullName(user)}</h4>
                    <p>{user.email}</p>
                    <span className="item-date">Ngày sinh: {formatDate(user.birth_date)}</span>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="approve-btn" onClick={() => runAction(() => approveUserAPI(user.account_id), "Đã phê duyệt tài khoản")}>
                    Phê duyệt
                  </button>
                  <button className="reject-btn" onClick={() => runAction(() => rejectUserAPI(user.account_id), "Đã từ chối tài khoản")}>
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
            {!loading && pendingUsers.length === 0 && <div className="pending-empty glass-effect">Không có tài khoản chờ duyệt.</div>}
          </div>
        )}

        {activeTab === "posts" && (
          <div className="pending-list">
            {pendingPosts.map((post) => (
              <div key={post.post_id} className="pending-item glass-effect">
                <div className="item-main">
                  {post.image_url && (
                    <a className="pending-thumb-link" href={post.image_url} target="_blank" rel="noreferrer" title="Mo anh bai viet">
                      <img className="pending-thumb" src={post.image_url} alt="" />
                    </a>
                  )}
                  <div className="item-info">
                    <h4>{post.author_name || post.author_email || "Người gửi"}</h4>
                    <p className="post-preview">{post.description || post.content || "[Không có nội dung chữ]"}</p>
                    {post.image_url && (
                      <a className="post-image-url" href={post.image_url} target="_blank" rel="noreferrer">
                        {post.image_url}
                      </a>
                    )}
                    <span className="item-date">{formatDate(post.created_at)}</span>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="approve-btn" onClick={() => runAction(() => approvePostAPI(post.post_id), "Đã phê duyệt bài viết")}>
                    Duyệt bài
                  </button>
                  <button className="reject-btn" onClick={() => rejectPost(post.post_id)}>
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
            {!loading && pendingPosts.length === 0 && <div className="pending-empty glass-effect">Không có bài viết chờ duyệt.</div>}
          </div>
        )}

        {activeTab === "profiles" && (
          <div className="pending-list">
            {pendingProfiles.map((profile) => (
              <div key={profile.person_id} className="pending-item glass-effect pending-item--wide">
                <div className="item-main">
                  <div className="item-avatar">{avatarInitial(profile)}</div>
                  <div className="item-info">
                    <h4>{fullName(profile)}</h4>
                    <p className="post-preview">Bio mới: {profile.pending_bio || "Không thay đổi"}</p>
                    <p className="post-preview">Ảnh mới: {profile.pending_avatar_url || "Không thay đổi"}</p>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="approve-btn" onClick={() => runAction(() => approveProfileUpdateAPI(profile.person_id), "Đã phê duyệt hồ sơ")}>
                    Phê duyệt
                  </button>
                  <button className="reject-btn" onClick={() => rejectProfile(profile.person_id)}>
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
            {!loading && pendingProfiles.length === 0 && <div className="pending-empty glass-effect">Không có hồ sơ chờ duyệt.</div>}
          </div>
        )}

        {activeTab === "memories" && (
          <div className="pending-list">
            {pendingMemories.map((memory) => (
              <div key={memory.id} className="pending-item glass-effect pending-item--wide pending-memory-item">
                <div className="item-main">
                  {memory.media_url && (
                    <a className="pending-thumb-link" href={memory.media_url} target="_blank" rel="noreferrer" title="Mở tệp kỉ niệm">
                      {memory.media_type === "image" ? (
                        <img className="pending-thumb" src={memory.media_url} alt="" />
                      ) : (
                        <span className="pending-memory-icon material-symbols-outlined">{memory.media_type === "video" ? "movie" : memory.media_type === "audio" ? "graphic_eq" : "attach_file"}</span>
                      )}
                    </a>
                  )}
                  <div className="item-info">
                    <h4>{memory.title || "Kỉ niệm dòng họ"}</h4>
                    <p>{memory.author_name || "Thành viên dòng họ"}</p>
                    <p className="post-preview">{memory.content || memory.original_filename || "[Không có nội dung chữ]"}</p>
                    <span className="item-date">{formatDate(memory.created_at)}</span>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="approve-btn" onClick={() => runAction(() => approveMemoryAPI(memory.id), "Đã phê duyệt kỉ niệm")}>
                    Duyệt kỉ niệm
                  </button>
                  <button className="reject-btn" onClick={() => rejectMemory(memory.id)}>
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
            {!loading && pendingMemories.length === 0 && <div className="pending-empty glass-effect">Không có kỉ niệm chờ duyệt.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
