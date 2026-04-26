import { useCallback, useEffect, useState } from "react";
import { getGeneralPosts, getMySubmissions, submitMaterial } from "../../api/memberService";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import "./MemberDashboard.css";

function formatDate(value) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function statusText(status) {
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Từ chối";
  if (status === "pending") return "Chờ duyệt";
  return "Đang xử lý";
}

export default function MemberSubmissions() {
  const [posts, setPosts] = useState([]);
  const [submissions, setSubmissions] = useState({ posts: [], profile: {} });
  const [form, setForm] = useState({ content: "", image_url: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [postResult, submissionResult] = await Promise.allSettled([getGeneralPosts(), getMySubmissions()]);
      if (postResult.status === "fulfilled") setPosts(postResult.value.posts || []);
      else setPosts([]);

      if (submissionResult.status === "rejected") throw submissionResult.reason;
      setSubmissions({
        posts: submissionResult.value.posts || [],
        profile: submissionResult.value.profile || {},
      });
    } catch (err) {
      setError(err?.message || "Không thể tải dữ liệu đóng góp.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.content.trim() && !form.image_url.trim()) {
      setError("Vui lòng nhập nội dung hoặc thêm ảnh.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await submitMaterial({
        content: form.content.trim(),
        image_url: form.image_url.trim(),
      });
      setForm({ content: "", image_url: "" });
      setNotice("Đã gửi bài viết, vui lòng chờ quản lý phê duyệt.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Không thể gửi bài đóng góp.");
    } finally {
      setSubmitting(false);
    }
  };

  const profileStatus = submissions.profile?.moderation_status;
  const profileSubmissionVisible = Boolean(
    (profileStatus && profileStatus !== "none") ||
      submissions.profile?.pending_bio ||
      submissions.profile?.pending_avatar_url,
  );

  if (loading) {
    return (
      <div className="member-portal-page">
        <section className="member-panel">
          <div className="member-empty">Đang tải bảng tin và lịch sử đóng góp...</div>
        </section>
      </div>
    );
  }

  return (
    <div className="member-portal-page">
      {(error || notice) && <div className={`member-alert ${error ? "is-error" : "is-success"}`}>{error || notice}</div>}

      <section className="member-hero-panel">
        <div>
          <span className="member-kicker">Đóng góp dòng họ</span>
          <h1>Bảng tin và lịch sử đóng góp</h1>
          <p>Gửi tư liệu mới, xem bài đã duyệt và theo dõi trạng thái các nội dung bạn đã gửi.</p>
        </div>
      </section>

      <div className="member-content-grid">
        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Gửi bài viết mới</h2>
              <p>Nội dung sẽ được hiển thị sau khi quản lý phê duyệt.</p>
            </div>
          </div>
          <form className="member-form" onSubmit={handleSubmit}>
            <ImageUpload
              label="Tải ảnh bài viết"
              onUploadSuccess={(url) => setForm((current) => ({ ...current, image_url: url }))}
            />
            <label className="member-label">
              URL ảnh
              <input value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} />
            </label>
            <label className="member-label">
              Nội dung
              <textarea rows={7} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
            </label>
            <button className="member-btn member-btn-primary" type="submit" disabled={submitting}>
              Gửi đóng góp
            </button>
          </form>
        </section>

        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Bài đã duyệt</h2>
              <p>Các bài viết đang hiển thị trong bảng tin dòng họ.</p>
            </div>
          </div>
          <div className="member-feed">
            {posts.length === 0 ? (
              <div className="member-empty">Chưa có bài viết nào được phê duyệt.</div>
            ) : (
              posts.slice(0, 6).map((post) => (
                <article className="member-post-card" key={post.id}>
                  {post.image_url && <img src={post.image_url} alt="" />}
                  <div>
                    <strong>{post.author_name || "Thành viên"}</strong>
                    <span>{formatDate(post.created_at)}</span>
                    <p>{post.content || "Bài viết hình ảnh"}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="member-panel">
        <div className="member-panel-header">
          <div>
            <h2>Lịch sử đóng góp của tôi</h2>
            <p>Theo dõi trạng thái duyệt bài viết và yêu cầu cập nhật hồ sơ.</p>
          </div>
        </div>
        <div className="member-table-wrap">
          <table className="member-table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {submissions.posts.map((item, index) => (
                <tr key={`${item.created_at || "post"}-${index}`}>
                  <td>Bài viết</td>
                  <td>{item.content || item.image_url || "Bài viết hình ảnh"}</td>
                  <td>
                    <span className={`member-status status-${item.status || "pending"}`}>{statusText(item.status)}</span>
                  </td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>{item.rejection_reason || "Không có"}</td>
                </tr>
              ))}

              {profileSubmissionVisible && (
                <tr>
                  <td>Cập nhật hồ sơ</td>
                  <td>{submissions.profile.pending_bio || submissions.profile.pending_avatar_url || "Ảnh và tiểu sử"}</td>
                  <td>
                    <span className={`member-status status-${submissions.profile.moderation_status || "pending"}`}>
                      {statusText(submissions.profile.moderation_status)}
                    </span>
                  </td>
                  <td>Chưa cập nhật</td>
                  <td>{submissions.profile.moderation_reason || "Không có"}</td>
                </tr>
              )}

              {submissions.posts.length === 0 && !profileSubmissionVisible && (
                <tr>
                  <td colSpan={5}>
                    <div className="member-empty">Bạn chưa gửi đóng góp nào.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
