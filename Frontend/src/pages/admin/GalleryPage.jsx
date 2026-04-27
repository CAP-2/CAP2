import { useEffect, useState } from "react";
import { getAdminGallery, deleteAdminGalleryItem } from "../../api/adminService";

export default function GalleryPage() {
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getAdminGallery();
      setGallery(res.gallery || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Xóa ảnh này khỏi thư viện?")) {
      try {
        await deleteAdminGalleryItem(id);
        fetchData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  if (loading) return <div className="loading-state">Đang tải...</div>;

  return (
    <section className="gallery-management">
      <div className="section-header">
        <div>
          <h2>Thư viện hình ảnh</h2>
          <p>Quản lý toàn bộ hình ảnh và kỷ niệm của các dòng họ.</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="gallery-grid">
        {gallery.map(item => (
          <div key={item.id} className="gallery-card">
            <div className="gallery-image-wrap" onClick={() => setSelectedImage(item)}>
              <img src={item.image_url} alt={item.content} />
              <div className="gallery-overlay">
                <span className="material-symbols-outlined">zoom_in</span>
              </div>
            </div>
            <div className="gallery-info">
              <p className="caption">{item.content || "Không có chú thích"}</p>
              <div className="meta">
                <span className="author">Bởi: {item.author_name || "N/A"}</span>
                <span className="clan">{item.clan_name}</span>
              </div>
              <button className="btn-delete-item" onClick={() => handleDelete(item.id)}>
                <span className="material-symbols-outlined">delete</span>
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {gallery.length === 0 && (
        <div className="empty-state">
          <span className="material-symbols-outlined">image_not_supported</span>
          <p>Thư viện hiện đang trống.</p>
        </div>
      )}

      {selectedImage && (
        <div className="lightbox-overlay" onClick={() => setSelectedImage(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={selectedImage.image_url} alt="" />
            <button className="close-btn" onClick={() => setSelectedImage(null)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
