import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAdminSettings, updateAdminSettings } from "../../../api/adminService";

export default function SettingsPage() {
  const { t } = useTranslation();
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
      setSuccess(t("admin.settings.messages.saveSuccess"));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-state">{t("admin.settings.messages.loading")}</div>;

  return (
    <section className="settings-management">
      <div className="section-header">
        <div>
          <h2>{t("admin.settings.title")}</h2>
          <p>{t("admin.settings.subtitle")}</p>
        </div>
      </div>

      <div className="settings-container">
        <form onSubmit={handleSave} className="settings-form">
          <div className="form-grid">
            <div className="settings-card">
              <h3>{t("admin.settings.sections.general")}</h3>
              <div className="form-group">
                <label>{t("admin.settings.fields.siteName")}</label>
                <input 
                  type="text" 
                  value={settings.site_name}
                  onChange={e => setSettings({...settings, site_name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{t("admin.settings.fields.siteDescription")}</label>
                <textarea 
                  rows="3"
                  value={settings.site_description}
                  onChange={e => setSettings({...settings, site_description: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div className="settings-card">
              <h3>{t("admin.settings.sections.contact")}</h3>
              <div className="form-group">
                <label>{t("admin.settings.fields.supportEmail")}</label>
                <input 
                  type="email" 
                  value={settings.contact_email}
                  onChange={e => setSettings({...settings, contact_email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{t("admin.settings.fields.phone")}</label>
                <input 
                  type="text" 
                  value={settings.phone_number}
                  onChange={e => setSettings({...settings, phone_number: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{t("admin.settings.fields.address")}</label>
                <input 
                  type="text" 
                  value={settings.address}
                  onChange={e => setSettings({...settings, address: e.target.value})}
                />
              </div>
            </div>

            <div className="settings-card">
              <h3>{t("admin.settings.sections.status")}</h3>
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
                  <strong>{t("admin.settings.fields.maintenanceMode")}</strong>
                  <p>{t("admin.settings.fields.maintenanceHint")}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            {error && <span className="error-text">{error}</span>}
            {success && <span className="success-text">{success}</span>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t("admin.settings.actions.saving") : t("admin.settings.actions.save")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
