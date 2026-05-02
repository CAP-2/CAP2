import { useEffect, useState } from "react";
import { getAdminSettings, updateAdminSettings } from "../../api/adminService";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    site_name: "Gia Phả Việt",
    site_description: "Hệ thống quản lý gia phả trực tuyến",
    contact_email: "support@giaphaviet.vn",
    phone_number: "0123 456 789",
    address: "Hà Nội, Việt Nam",
    maintenance_mode: "false"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getAdminSettings();
      if (res.settings && Object.keys(res.settings).length > 0) {
        setSettings(prev => ({ ...prev, ...res.settings }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateAdminSettings(settings);
      setSuccess("Cài đặt đã được lưu thành công!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-state">Đang tải...</div>;

  return (
    <section className="settings-management">
      <div className="section-header">
        <div>
          <h2>Cài đặt hệ thống</h2>
          <p>Cấu hình các thông tin cơ bản và tùy chọn vận hành của trang web.</p>
        </div>
      </div>

      <div className="settings-container">
        <form onSubmit={handleSave} className="settings-form">
          <div className="form-grid">
            <div className="settings-card">
              <h3>Thông tin chung</h3>
              <div className="form-group">
                <label>Tên trang web</label>
                <input 
                  type="text" 
                  value={settings.site_name}
                  onChange={e => setSettings({...settings, site_name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Mô tả ngắn</label>
                <textarea 
                  rows="3"
                  value={settings.site_description}
                  onChange={e => setSettings({...settings, site_description: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div className="settings-card">
              <h3>Liên hệ & Hỗ trợ</h3>
              <div className="form-group">
                <label>Email hỗ trợ</label>
                <input 
                  type="email" 
                  value={settings.contact_email}
                  onChange={e => setSettings({...settings, contact_email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Số điện thoại</label>
                <input 
                  type="text" 
                  value={settings.phone_number}
                  onChange={e => setSettings({...settings, phone_number: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Địa chỉ văn phòng</label>
                <input 
                  type="text" 
                  value={settings.address}
                  onChange={e => setSettings({...settings, address: e.target.value})}
                />
              </div>
            </div>

            <div className="settings-card">
              <h3>Trạng thái hệ thống</h3>
              <div className="form-group checkbox-group">
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={settings.maintenance_mode === "true"}
                    onChange={e => setSettings({...settings, maintenance_mode: e.target.checked ? "true" : "false"})}
                  />
                  <span className="slider round"></span>
                </label>
                <div className="label-text">
                  <strong>Chế độ bảo trì</strong>
                  <p>Khi bật, chỉ Admin mới có thể truy cập hệ thống.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            {error && <span className="error-text">{error}</span>}
            {success && <span className="success-text">{success}</span>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
