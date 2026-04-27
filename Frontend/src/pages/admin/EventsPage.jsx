import { useEffect, useState } from "react";
import { getAdminEvents, createAdminEvent, updateAdminEvent, deleteAdminEvent, getAdminClans } from "../../api/adminService";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [formData, setFormData] = useState({
    clan_id: "",
    title: "",
    event_date: "",
    description: ""
  });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eRes, cRes] = await Promise.all([getAdminEvents(), getAdminClans()]);
      setEvents(eRes.events || []);
      setClans(cRes.clans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentEvent) {
        await updateAdminEvent(currentEvent.id, formData);
      } else {
        await createAdminEvent(formData);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (event) => {
    setCurrentEvent(event);
    setFormData({
      clan_id: event.clan_id,
      title: event.title,
      event_date: event.event_date ? event.event_date.split('T')[0] : "",
      description: event.description || ""
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Xóa sự kiện này?")) {
      try {
        await deleteAdminEvent(id);
        fetchData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  if (loading) return <div className="loading-state">Đang tải...</div>;

  return (
    <section className="events-management">
      <div className="section-header">
        <div>
          <h2>Quản lý sự kiện</h2>
          <p>Tổ chức và quản lý các sự kiện quan trọng của dòng họ.</p>
        </div>
        <button className="btn-primary" onClick={() => {
          setCurrentEvent(null);
          setFormData({ clan_id: "", title: "", event_date: "", description: "" });
          setShowModal(true);
        }}>
          <span className="material-symbols-outlined">add</span>
          Thêm sự kiện
        </button>
      </div>

      <div className="events-grid">
        {events.map(event => (
          <div key={event.id} className="event-card">
            <div className="event-date">
              <span className="day">{new Date(event.event_date).getDate()}</span>
              <span className="month">Tháng {new Date(event.event_date).getMonth() + 1}</span>
              <span className="year">{new Date(event.event_date).getFullYear()}</span>
            </div>
            <div className="event-details">
              <h3>{event.title}</h3>
              <p className="clan-info"><span className="material-symbols-outlined">group</span> {event.clan_name}</p>
              <p className="desc">{event.description || "Không có mô tả."}</p>
              <div className="event-actions">
                <button onClick={() => handleEdit(event)} className="btn-text">Sửa</button>
                <button onClick={() => handleDelete(event.id)} className="btn-text delete">Xóa</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{currentEvent ? "Cập nhật sự kiện" : "Tạo sự kiện mới"}</h3>
            <form onSubmit={handleSubmit}>
              <label>
                Dòng họ
                <select 
                  required 
                  value={formData.clan_id}
                  onChange={e => setFormData({...formData, clan_id: e.target.value})}
                  disabled={!!currentEvent}
                >
                  <option value="">Chọn dòng họ...</option>
                  {clans.map(c => <option key={c.id} value={c.id}>{c.clan_name}</option>)}
                </select>
              </label>
              <label>
                Tên sự kiện
                <input 
                  type="text" 
                  required 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </label>
              <label>
                Ngày diễn ra
                <input 
                  type="date" 
                  required 
                  value={formData.event_date}
                  onChange={e => setFormData({...formData, event_date: e.target.value})}
                />
              </label>
              <label>
                Mô tả
                <textarea 
                  rows="4" 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Hủy</button>
                <button type="submit" className="btn-primary">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
