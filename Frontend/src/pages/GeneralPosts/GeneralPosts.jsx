import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  addPostComment,
  getGeneralPosts,
  getPostComments,
  submitMaterial,
  togglePostLike,
} from "../../api/memberService";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import { formatDateTimeVN } from "../../utils/dateFormat";
import "./GeneralPosts.css";

const emptyPostForm = {
  type: "story",
  description: "",
  content: "",
  image_url: "",
  media_type: "",
};

function formatDate(value) {
  if (!value) return "Chưa cập nhật";
  return formatDateTimeVN(value);
}

function buildPostDescription(post) {
  const description = String(post?.description || "").trim();
  if (description) return description;

  const content = String(post?.content || "").trim();
  if (!content) return "Bài viết hình ảnh";
  return content.length > 180 ? `${content.slice(0, 177)}...` : content;
}

function getAuthorName(post) {
  return post?.author_name || post?.created_by_name || post?.email || "Thành viên dòng họ";
}

function getPostMediaUrl(post) {
  return String(post?.image_url || post?.media_url || "").trim();
}

function isVideoMedia(value, explicitType = "") {
  const type = String(explicitType || "").toLowerCase();
  const url = String(value || "").toLowerCase();
  return type.startsWith("video/") || /[?&]media=video(?:&|$)/.test(url) || /\.(mp4|webm|mov|m4v)(\?|#|$)/.test(url);
}

function PostMedia({ url, mediaType = "", detail = false }) {
  if (!url) return null;
  if (isVideoMedia(url, mediaType)) {
    return (
      <video
        className={detail ? "post-detail-video" : "feed-post-video"}
        src={url}
        controls={detail}
        muted={!detail}
        playsInline
        preload="metadata"
      />
    );
  }
  return <img src={url} alt="Media bài đăng" />;
}

function PostCard({ post, onOpen, onLike, liking }) {
  const text = post.content || post.description || "Bài viết hình ảnh";
  const mediaUrl = getPostMediaUrl(post);

  return (
    <article className="feed-post-card">
      <header className="feed-post-author-row">
        <button type="button" className="feed-author-button" onClick={() => onOpen(post)}>
          <span className="feed-avatar">
            <img src="/logo.png" alt="" />
          </span>
          <span className="feed-author-text">
            <strong>{getAuthorName(post)}</strong>
            <time>{formatDate(post.created_at)}</time>
          </span>
        </button>
      </header>

      <button type="button" className="feed-post-content-button" onClick={() => onOpen(post)}>
        <p className="feed-post-text">{text}</p>
      </button>

      {mediaUrl ? (
        <button type="button" className="feed-post-media" onClick={() => onOpen(post)}>
          <PostMedia url={mediaUrl} mediaType={post.media_type || post.mime_type || ""} />
        </button>
      ) : null}

      <div className="feed-post-stats">
        <span>{Number(post.like_count || 0)} lượt thích</span>
        <span>{Number(post.comment_count || 0)} bình luận</span>
      </div>

      <div className="feed-post-actions">
        <button type="button" className={post.liked_by_me ? "is-liked" : ""} onClick={() => onLike(post)} disabled={liking}>
          <span className="material-symbols-outlined">{post.liked_by_me ? "favorite" : "favorite_border"}</span>
          <span>Thích</span>
        </button>
        <button type="button" onClick={() => onOpen(post)}>
          <span className="material-symbols-outlined">chat_bubble</span>
          <span>Bình luận</span>
        </button>
        <button type="button" onClick={() => onOpen(post)}>
          <span className="material-symbols-outlined">visibility</span>
          <span>Xem</span>
        </button>
      </div>
    </article>
  );
}

function FeedComposer({ onOpen }) {
  return (
    <section className="feed-composer-card">
      <div className="feed-composer-top">
        <span className="feed-avatar is-small">
          <img src="/logo.png" alt="" />
        </span>
        <button type="button" className="feed-composer-input" onClick={() => onOpen("story")}>
          Chia sẻ điều gì với dòng họ...
        </button>
      </div>
      <div className="feed-composer-actions">
        <button type="button" onClick={() => onOpen("media")}>
          <span className="material-symbols-outlined">perm_media</span>
          Ảnh / Video
        </button>
        <button type="button" onClick={() => onOpen("story")}>
          <span className="material-symbols-outlined">history_edu</span>
          Câu chuyện
        </button>
      </div>
    </section>
  );
}

function AddPostModal({ form, error, notice, submitting, onChange, onClose, onSubmit }) {
  return (
    <div className="post-modal-backdrop" onMouseDown={onClose}>
      <section className="post-modal post-compose-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="post-modal-head">
          <div>
            <h2>Tạo bài đăng</h2>
            <p>Bài của thành viên sẽ hiển thị sau khi quản lý duyệt.</p>
          </div>
          <button type="button" className="post-icon-btn" onClick={onClose} aria-label="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form className="post-compose-form" onSubmit={onSubmit}>
          <div className="post-type-tabs" role="tablist" aria-label="Loại bài đăng">
            <button
              type="button"
              className={form.type === "media" ? "is-active" : ""}
              onClick={() => onChange("type", "media")}
              disabled={submitting}
            >
              <span className="material-symbols-outlined">perm_media</span>
              Ảnh / Video
            </button>
            <button
              type="button"
              className={form.type !== "media" ? "is-active" : ""}
              onClick={() => onChange("type", "story")}
              disabled={submitting}
            >
              <span className="material-symbols-outlined">history_edu</span>
              Câu chuyện
            </button>
          </div>

          <label className="post-field">
            <span>Tiêu đề / mô tả ngắn</span>
            <input
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Ví dụ: Ngày họp mặt dòng họ, ảnh kỷ niệm..."
              maxLength={255}
              disabled={submitting}
            />
          </label>

          <label className="post-field">
            <span>Nội dung bài viết</span>
            <textarea
              rows={8}
              value={form.content}
              onChange={(event) => onChange("content", event.target.value)}
              placeholder="Bạn muốn chia sẻ điều gì với dòng họ?"
              disabled={submitting}
            />
          </label>

          {form.type === "media" && (
            <ImageUpload
              value={form.image_url}
              disabled={submitting}
              label="Tải ảnh hoặc video bài đăng"
              accept="image/*,video/*"
              allowVideo
              usageType="post_image"
              onUploadSuccess={(url, result = {}) => {
                const mimeType = String(result.mimeType || result.mime_type || "");
                const mediaUrl = mimeType.startsWith("video/") && url && !/[?&]media=video\b/.test(url)
                  ? `${url}${url.includes("?") ? "&" : "?"}media=video`
                  : url;
                onChange("image_url", mediaUrl);
                onChange("media_type", mimeType);
              }}
            />
          )}

          {(error || notice) && <div className={`post-form-message ${error ? "is-error" : "is-success"}`}>{error || notice}</div>}

          <div className="post-modal-actions">
            <button type="button" className="post-secondary-btn" onClick={onClose} disabled={submitting}>
              Hủy
            </button>
            <button type="submit" className="post-primary-btn" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi bài đăng"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PostDetailModal({
  post,
  comments,
  commentsLoading,
  commentText,
  commentError,
  liking,
  commenting,
  onClose,
  onLike,
  onCommentChange,
  onCommentSubmit,
}) {
  if (!post) return null;

  return (
    <div className="post-modal-backdrop" onMouseDown={onClose}>
      <article className="post-modal post-detail-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="post-modal-head">
          <div className="post-detail-title-row">
            <span className="feed-avatar is-small">
              <img src="/logo.png" alt="" />
            </span>
            <div>
              <h2>{getAuthorName(post)}</h2>
              <p>{formatDate(post.created_at)}</p>
            </div>
          </div>
          <button type="button" className="post-icon-btn" onClick={onClose} aria-label="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="post-detail-body">
          <h3>{buildPostDescription(post)}</h3>
          <p>{post.content || post.description || "Bài viết hình ảnh"}</p>
        </div>

        {getPostMediaUrl(post) && (
          <div className="post-detail-image">
            <PostMedia url={getPostMediaUrl(post)} mediaType={post.media_type || post.mime_type || ""} detail />
          </div>
        )}

        <div className="post-detail-toolbar">
          <button type="button" className={`post-like-btn ${post.liked_by_me ? "is-liked" : ""}`} onClick={() => onLike(post)} disabled={liking}>
            <span className="material-symbols-outlined">{post.liked_by_me ? "favorite" : "favorite_border"}</span>
            <span>{Number(post.like_count || 0)} lượt thích</span>
          </button>
          <div className="post-comment-count">
            <span className="material-symbols-outlined">chat_bubble</span>
            <span>{Number(post.comment_count || 0)} bình luận</span>
          </div>
        </div>

        <section className="post-comments">
          <h3>Bình luận</h3>
          {commentsLoading ? (
            <div className="post-empty-state">Đang tải bình luận...</div>
          ) : comments.length === 0 ? (
            <div className="post-empty-state">Chưa có bình luận.</div>
          ) : (
            <div className="post-comment-list">
              {comments.map((comment) => (
                <article className="post-comment" key={comment.id}>
                  <strong>{comment.author_name || "Thành viên"}</strong>
                  <p>{comment.content}</p>
                  <time>{formatDate(comment.created_at)}</time>
                </article>
              ))}
            </div>
          )}

          <form className="post-comment-form" onSubmit={onCommentSubmit}>
            <textarea
              rows={3}
              value={commentText}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Viết bình luận..."
              disabled={commenting}
            />
            {commentError && <div className="post-form-message is-error">{commentError}</div>}
            <button type="submit" className="post-primary-btn" disabled={commenting}>
              {commenting ? "Đang gửi..." : "Bình luận"}
            </button>
          </form>
        </section>
      </article>
    </div>
  );
}

export default function GeneralPosts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyPostForm);
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [likingPostId, setLikingPostId] = useState(null);

  const selectedPostData = useMemo(
    () => (selectedPost ? posts.find((post) => post.id === selectedPost.id) || selectedPost : null),
    [posts, selectedPost],
  );

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getGeneralPosts();
      setPosts(data.posts || []);
    } catch (err) {
      setError(err?.message || "Không thể tải bài viết.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComments = useCallback(async (postId) => {
    setCommentsLoading(true);
    setCommentError("");
    try {
      const data = await getPostComments(postId);
      setComments(data.comments || []);
    } catch (err) {
      setCommentError(err?.message || "Không thể tải bình luận.");
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (searchParams.get("compose") === "1") {
      setShowAddModal(true);
    }
  }, [searchParams]);

  const updatePost = (postId, updates) => {
    setPosts((current) => current.map((post) => (post.id === postId ? { ...post, ...updates } : post)));
    setSelectedPost((current) => (current?.id === postId ? { ...current, ...updates } : current));
  };

  const changeFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
    setFormNotice("");
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setFormError("");
    setFormNotice("");
    if (searchParams.get("compose")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("compose");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const openPost = (post) => {
    setSelectedPost(post);
    setCommentText("");
    loadComments(post.id);
  };

  const handleSubmitPost = async (event) => {
    event.preventDefault();
    const description = form.description.trim();
    const content = form.content.trim();
    const imageUrl = form.image_url.trim();
    const postType = form.type === "media" ? "media" : "story";

    if (!description) {
      setFormError("Vui lòng nhập tiêu đề hoặc mô tả ngắn cho bài đăng.");
      return;
    }

    if (postType === "media" && !imageUrl) {
      setFormError("Vui lòng chọn ảnh hoặc video cho bài đăng.");
      return;
    }

    if (postType === "story" && !content) {
      setFormError("Vui lòng nhập nội dung câu chuyện.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    setFormNotice("");
    try {
      const result = await submitMaterial({
        description,
        content: content || description,
        image_url: postType === "media" ? imageUrl : "",
        media_type: form.media_type || "",
      });
      setForm(emptyPostForm);
      setFormNotice(result.message || "Đã gửi bài đăng.");
      await loadPosts();
      window.setTimeout(closeAddModal, 700);
    } catch (err) {
      setFormError(err?.message || "Không thể gửi bài đăng.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (post) => {
    setLikingPostId(post.id);
    try {
      const result = await togglePostLike(post.id);
      updatePost(post.id, {
        liked_by_me: result.liked,
        like_count: result.like_count,
      });
    } catch (err) {
      setCommentError(err?.message || "Không thể cập nhật lượt thích.");
    } finally {
      setLikingPostId(null);
    }
  };

  const openAddModal = (type = "story") => {
    setForm((current) => ({
      ...current,
      type: type === "media" ? "media" : "story",
      image_url: type === "media" ? current.image_url : "",
      media_type: type === "media" ? current.media_type : "",
    }));
    setFormError("");
    setFormNotice("");
    setShowAddModal(true);
  };

  const handleSubmitComment = async (event) => {
    event.preventDefault();
    if (!selectedPostData) return;

    const content = commentText.trim();
    if (!content) {
      setCommentError("Vui lòng nhập bình luận.");
      return;
    }

    setCommenting(true);
    setCommentError("");
    try {
      const data = await addPostComment(selectedPostData.id, { content });
      setComments((current) => [...current, data.comment]);
      setCommentText("");
      updatePost(selectedPostData.id, {
        comment_count: Number(selectedPostData.comment_count || 0) + 1,
      });
    } catch (err) {
      setCommentError(err?.message || "Không thể gửi bình luận.");
    } finally {
      setCommenting(false);
    }
  };

  return (
    <div className="general-posts-page feed-page">
      <header className="general-posts-hero">
        <div>
          <span className="general-posts-kicker">Bảng tin dòng họ</span>
          <h1>Bảng tin dòng họ</h1>
          <p>Nơi lưu giữ câu chuyện, hình ảnh và kỷ niệm của các thành viên.</p>
        </div>
      </header>

      <div className="feed-layout">
        <main className="feed-main-column">
          <FeedComposer onOpen={openAddModal} />
          {error && <div className="post-form-message is-error">{error}</div>}

          {loading ? (
            <div className="post-empty-state">Đang tải bài viết...</div>
          ) : posts.length === 0 ? (
            <div className="post-empty-state">Chưa có bài viết nào được phê duyệt.</div>
          ) : (
            <div className="feed-post-list">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onOpen={openPost} onLike={handleToggleLike} liking={likingPostId === post.id} />
              ))}
            </div>
          )}
        </main>

        <aside className="feed-right-panel">
          <section className="feed-mini-card">
            <h3>Bảng tin</h3>
            <p>Các bài viết đã duyệt sẽ hiển thị cho thành viên trong dòng họ.</p>
            <button type="button" className="post-primary-btn" onClick={() => openAddModal("story")}>
              <span className="material-symbols-outlined">add</span>
              Thêm bài đăng
            </button>
          </section>
        </aside>
      </div>

      {showAddModal && (
        <AddPostModal
          form={form}
          error={formError}
          notice={formNotice}
          submitting={submitting}
          onChange={changeFormField}
          onClose={closeAddModal}
          onSubmit={handleSubmitPost}
        />
      )}

      {selectedPostData && (
        <PostDetailModal
          post={selectedPostData}
          comments={comments}
          commentsLoading={commentsLoading}
          commentText={commentText}
          commentError={commentError}
          liking={likingPostId === selectedPostData.id}
          commenting={commenting}
          onClose={() => setSelectedPost(null)}
          onLike={handleToggleLike}
          onCommentChange={(value) => {
            setCommentText(value);
            setCommentError("");
          }}
          onCommentSubmit={handleSubmitComment}
        />
      )}
    </div>
  );
}
