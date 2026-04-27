import { useEffect, useMemo, useState } from "react";
import { getMediaLibraryData } from "../../api/managerService";
import { formatDate } from "./managerData";
import "./MediaManagement.css";

export default function MediaManagement() {
  const [mediaItems, setMediaItems] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMediaLibraryData()
      .then((items) => {
        if (!cancelled) setMediaItems(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Không thể tải thư viện");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mediaItems;
    return mediaItems.filter((item) =>
      [item.author_name, item.description, item.content, item.image_url]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [mediaItems, query]);

  return (
    <div className="media-management animate-fade-in">
      <div className="media-header glass-effect">
        <div className="search-bar">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Tìm kiếm tư liệu, hình ảnh..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="media-filters">
          <button className="filter-chip active" type="button">
            Tất cả ({filteredItems.length})
          </button>
        </div>
      </div>

      {error && <div className="manager-inline-error">{error}</div>}
      {loading && <div className="manager-inline-message">Đang tải thư viện từ database...</div>}

      <div className="media-grid">
        {filteredItems.map((item) => (
          <div key={item.post_id} className="media-card glass-effect">
            <div className="media-preview">
              <img src={item.image_url} alt={item.description || item.content || "Tư liệu gia phả"} />
              <div className="media-overlay">
                <a className="media-action-btn" href={item.image_url} target="_blank" rel="noreferrer" title="Xem ảnh">
                  <span className="material-symbols-outlined">visibility</span>
                </a>
                <a className="media-action-btn" href={item.image_url} download title="Tải xuống">
                  <span className="material-symbols-outlined">download</span>
                </a>
              </div>
            </div>
            <div className="media-info">
              <div className="author-info">
                <strong>{item.author_name || "Không rõ người gửi"}</strong>
                <span>{formatDate(item.created_at)}</span>
                {(item.description || item.content) && <small>{item.description || item.content}</small>}
              </div>
            </div>
          </div>
        ))}

        {!loading && filteredItems.length === 0 && (
          <div className="add-media-card glass-effect">
            <span className="material-symbols-outlined">photo_library</span>
            <p>Không có tư liệu nào trong database.</p>
          </div>
        )}
      </div>
    </div>
  );
}
