import { useState } from "react";
import "./MediaManagement.css";

export default function MediaManagement() {
  const [mediaItems, setMediaItems] = useState([
    { id: 1, url: "https://images.unsplash.com/photo-1590483736622-39da8af75620?q=80&w=600", author: "Cụ Bảy", date: "24/03/2024" },
    { id: 2, url: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=600", author: "Anh Tuấn", date: "15/04/2024" },
    { id: 3, url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=600", author: "Chị Lan", date: "10/04/2024" },
    { id: 4, url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=600", author: "Ông Tám", date: "05/04/2024" },
  ]);

  return (
    <div className="media-management animate-fade-in">
      <div className="media-header glass-effect">
        <div className="search-bar">
          <span className="material-symbols-outlined">search</span>
          <input type="text" placeholder="Tìm kiếm tư liệu, hình ảnh..." />
        </div>
        <div className="media-filters">
          <button className="filter-chip active">Tất cả</button>
          <button className="filter-chip">Hình ảnh</button>
          <button className="filter-chip">Video</button>
          <button className="filter-chip">Tài liệu</button>
        </div>
      </div>

      <div className="media-grid">
        {mediaItems.map((item) => (
          <div key={item.id} className="media-card glass-effect">
            <div className="media-preview">
              <img src={item.url} alt="Media" />
              <div className="media-overlay">
                <button className="media-action-btn">
                  <span className="material-symbols-outlined">visibility</span>
                </button>
                <button className="media-action-btn">
                  <span className="material-symbols-outlined">download</span>
                </button>
              </div>
            </div>
            <div className="media-info">
              <div className="author-info">
                <strong>{item.author}</strong>
                <span>{item.date}</span>
              </div>
              <button className="more-btn">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
          </div>
        ))}
        
        <div className="add-media-card glass-effect">
          <span className="material-symbols-outlined">add_photo_alternate</span>
          <p>Tải lên tư liệu mới</p>
        </div>
      </div>
    </div>
  );
}
