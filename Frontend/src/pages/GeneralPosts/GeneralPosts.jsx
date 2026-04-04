import React, { useState, useEffect } from "react";
import { getGeneralPosts, submitMaterial } from "../../api/memberService";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import "./GeneralPosts.css";

const GeneralPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPost, setNewPost] = useState({ content: "", image_url: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const fetchPosts = async () => {
    try {
      const data = await getGeneralPosts();
      if (data.success) {
        setPosts(data.posts);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.content && !newPost.image_url) {
      alert("Vui lòng nhập nội dung hoặc thêm ảnh");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitMaterial(newPost);
      if (result.success) {
        setMessage("Bài viết đã được gửi và đang chờ duyệt!");
        setNewPost({ content: "", image_url: "" });
        setTimeout(() => {
          setShowAddModal(false);
          setMessage("");
        }, 2000);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="general-posts-container">
      <header className="posts-header">
        <h1>Bảng Tin Dòng Họ</h1>
        <button className="add-post-btn" onClick={() => setShowAddModal(true)}>
          + Đóng góp bài viết
        </button>
      </header>

      {loading ? (
        <div className="posts-loading">Đang tải bài viết...</div>
      ) : (
        <div className="posts-grid">
          {posts.length > 0 ? (
            posts.map((post) => (
              <div key={post.id} className="post-card">
                {post.image_url && (
                  <div className="post-image">
                    <img src={post.image_url} alt="Post" />
                  </div>
                )}
                <div className="post-content">
                  <p className="post-text">{post.content}</p>
                  <div className="post-meta">
                    <span className="post-author">Bởi: {post.author_name}</span>
                    <span className="post-date">
                      {new Date(post.created_at).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-posts">Chưa có bài viết nào được phê duyệt.</div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Thêm bài viết mới</h2>
            <form onSubmit={handleSubmit}>
              <textarea
                placeholder="Nhập nội dung bài viết..."
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                rows="4"
              />
              <div className="image-upload-wrapper">
                <label>Hình ảnh (không bắt buộc):</label>
                <ImageUpload
                  onUploadSuccess={(url) => setNewPost({ ...newPost, image_url: url })}
                  label="Kéo thả ảnh vào đây"
                />
              </div>
              {message && <p className="success-message">{message}</p>}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddModal(false)} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? "Đang gửi..." : "Gửi bài viết"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralPosts;
