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
import "./GeneralPosts.css";

const emptyPostForm = {
  description: "",
  content: "",
  image_url: "",
};

function formatDate(value) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function buildPostDescription(post) {
  const description = String(post?.description || "").trim();
  if (description) return description;

  const content = String(post?.content || "").trim();
  if (!content) return "Bài viết hình ảnh";
  return content.length > 180 ? `${content.slice(0, 177)}...` : content;
}

function PostCard({ post, onOpen }) {
  return (
    <button type="button" className="general-post-card" onClick={() => onOpen(post)}>
      <span className="general-post-thumb">
        {post.image_url ? (
          <img src={post.image_url} alt="" />
        ) : (
          <span className="general-post-thumb-empty">
            <span className="material-symbols-outlined">article</span>
          </span>
        )}
        <span className="general-post-overlay">
          <span className="general-post-action" title="Xem bài viết">
            <span className="material-symbols-outlined">visibility</span>
          </span>
        </span>
      </span>
      <span className="general-post-info">
        <span className="general-post-author">{post.author_name || "Thành viên"}</span>
        <span className="general-post-date">{formatDate(post.created_at)}</span>
        <span className="general-post-desc">{buildPostDescription(post)}</span>
      </span>
    </button>
  );
}

function AddPostModal({ form, error, notice, submitting, onChange, onClose, onSubmit }) {
  return (
    <div className="post-modal-backdrop" onMouseDown={onClose}>
      <section className="post-modal post-compose-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="post-modal-head">
          <div>
            <h2>Thêm bài đăng</h2>
            <p>Bài của thành viên sẽ hiển thị sau khi quản lý duyệt.</p>
          </div>
          <button type="button" className="post-icon-btn" onClick={onClose} aria-label="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form className="post-compose-form" onSubmit={onSubmit}>
          <label className="post-field">
            <span>Mô tả ngắn</span>
            <input
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Tóm tắt nội dung sẽ hiện ở dạng thu nhỏ"
              maxLength={255}
              disabled={submitting}
            />
          </label>

          <label className="post-field">
            <span>Nội dung đầy đủ</span>
            <textarea
              rows={8}
              value={form.content}
              onChange={(event) => onChange("content", event.target.value)}
              placeholder="Viết toàn bộ bài đăng..."
              disabled={submitting}
            />
          </label>

          <ImageUpload
            value={form.image_url}
            disabled={submitting}
            label="Tải ảnh bài đăng"
            onUploadSuccess={(url) => onChange("image_url", url)}
          />

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
          <div>
            <h2>{buildPostDescription(post)}</h2>
            <p>
              {post.author_name || "Thành viên"} · {formatDate(post.created_at)}
            </p>
          </div>
          <button type="button" className="post-icon-btn" onClick={onClose} aria-label="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {post.image_url && (
          <div className="post-detail-image">
            <img src={post.image_url} alt="" />
          </div>
        )}

        <div className="post-detail-body">{post.content || post.description || "Bài viết hình ảnh"}</div>

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

    if (!description) {
      setFormError("Vui lòng nhập mô tả ngắn cho bài đăng.");
      return;
    }

    if (!content && !imageUrl) {
      setFormError("Vui lòng nhập nội dung đầy đủ hoặc thêm ảnh.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    setFormNotice("");
    try {
      const result = await submitMaterial({
        description,
        content: content || description,
        image_url: imageUrl,
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
    <div className="general-posts-page">
      <header className="general-posts-header">
        <div>
          <span className="general-posts-kicker">Bảng tin dòng họ</span>
          <h1>Bài đăng đã duyệt</h1>
        </div>
        <button type="button" className="post-primary-btn" onClick={() => setShowAddModal(true)}>
          <span className="material-symbols-outlined">add</span>
          Thêm bài đăng
        </button>
      </header>

      {error && <div className="post-form-message is-error">{error}</div>}

      {loading ? (
        <div className="post-empty-state">Đang tải bài viết...</div>
      ) : posts.length === 0 ? (
        <div className="post-empty-state">Chưa có bài viết nào được phê duyệt.</div>
      ) : (
        <div className="general-post-grid">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onOpen={openPost} />
          ))}
        </div>
      )}

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
