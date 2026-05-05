import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getGeneralPosts, getMySubmissions } from "../../api/memberService";
import { formatDateTimeVN } from "../../utils/dateFormat";
import "./MemberDashboard.css";

function formatDate(value) {
  if (!value) return "Chưa cập nhật";
  return formatDateTimeVN(value);
}

function statusText(status) {
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Từ chối";
  if (status === "pending") return "Chờ duyệt";
  return "Đang xử lý";
}

function postSummary(post) {
  return post?.description || post?.content || post?.image_url || "Bài viết hình ảnh";
}

export default function MemberSubmissions() {
  const [posts, setPosts] = useState([]);
  const [submissions, setSubmissions] = useState({ posts: [], profile: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [postResult, submissionResult] = await Promise.allSettled([getGeneralPosts(), getMySubmissions()]);
      setPosts(postResult.status === "fulfilled" ? postResult.value.posts || [] : []);

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
      {error && <div className="member-alert is-error">{error}</div>}

      <section className="member-hero-panel">
        <div>
          <span className="member-kicker">Đóng góp dòng họ</span>
          <h1>Lịch sử đóng góp</h1>
          <p>Theo dõi trạng thái bài đã gửi. Việc thêm bài mới, thích và bình luận nằm trong trang bảng tin.</p>
        </div>
        <div className="member-hero-actions">
          <Link to="/user/posts?compose=1" className="member-btn member-btn-primary">
            <span className="material-symbols-outlined">add</span>
            Thêm bài đăng
          </Link>
          <Link to="/user/posts" className="member-btn member-btn-ghost">
            Xem bảng tin
          </Link>
        </div>
      </section>

      <div className="member-content-grid">
        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Đăng bài trên bảng tin</h2>
              <p>Sử dụng nút thêm bài ở bảng tin để tạo bài đăng có mô tả, ảnh và nội dung đầy đủ.</p>
            </div>
          </div>
          <Link to="/user/posts?compose=1" className="member-btn member-btn-primary">
            Mở form thêm bài
          </Link>
        </section>

        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Bài đã duyệt</h2>
              <p>Các bài viết đang hiển thị trong bảng tin dòng họ.</p>
            </div>
            <Link to="/user/posts" className="member-btn member-btn-ghost">
              Mở bảng tin
            </Link>
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
                    <p>{postSummary(post)}</p>
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
                  <td>{postSummary(item)}</td>
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
