import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/api";
import { getStoredUser } from "../../utils/auth";
import "./ProfileDrawer.css";

const buildName = (profile) =>
  profile?.display_name ||
  [profile?.surname, profile?.middle_name, profile?.first_name].filter(Boolean).join(" ").trim() ||
  profile?.email ||
  "Tài khoản";

function syncStoredUser(profile, setCurrentUser) {
  if (!profile) return;
  const storedUser = getStoredUser() || {};
  const profileName = buildName(profile);
  const nextUser = {
    ...storedUser,
    email: profile.email || storedUser.email,
    display_name: profile.display_name || storedUser.display_name,
    name: profileName || storedUser.name,
    role_id: profile.role_id || storedUser.role_id,
    status: profile.status || storedUser.status,
    avatar_url: profile.avatar_url || storedUser.avatar_url || "",
  };
  localStorage.setItem("auth_user", JSON.stringify(nextUser));
  localStorage.setItem("user", JSON.stringify(nextUser));
  if (typeof setCurrentUser === "function") setCurrentUser(nextUser);
}

export default function ProfileDrawer({
  open,
  onClose,
  currentUser,
  setCurrentUser,
  roleLabel = "Thành viên dòng họ",
  title = "Chỉnh sửa thông tin cá nhân",
}) {
  const [loading, setLoading] = useState(false);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState({});
  const [basicForm, setBasicForm] = useState({
    email: "",
    surname: "",
    middle_name: "",
    first_name: "",
    hometown: "",
    generation: "",
  });
  const [contentForm, setContentForm] = useState({ avatar_url: "", bio: "" });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const displayName = useMemo(
    () => buildName(profile) || currentUser?.name || currentUser?.display_name || currentUser?.email || "Tài khoản",
    [profile, currentUser],
  );

  const avatarUrl = contentForm.avatar_url || profile.avatar_url || currentUser?.avatar_url || "";

  const loadProfile = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiRequest("/api/member/dashboard");
      const nextProfile = data.profile || {};
      setProfile(nextProfile);
      setBasicForm({
        email: nextProfile.email || "",
        surname: nextProfile.surname || "",
        middle_name: nextProfile.middle_name || "",
        first_name: nextProfile.first_name || "",
        hometown: nextProfile.hometown || "",
        generation: nextProfile.generation ?? "",
      });
      setContentForm({
        avatar_url:
          nextProfile.pending_avatar_url !== null && nextProfile.pending_avatar_url !== undefined
            ? nextProfile.pending_avatar_url || ""
            : nextProfile.avatar_url || "",
        bio:
          nextProfile.pending_bio !== null && nextProfile.pending_bio !== undefined
            ? nextProfile.pending_bio || ""
            : nextProfile.bio || "",
      });
      syncStoredUser(nextProfile, setCurrentUser);
    } catch (error) {
      setMessage(error?.message || "Không tải được thông tin cá nhân.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadProfile();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const updateBasicField = (event) => {
    const { name, value } = event.target;
    setBasicForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateContentField = (event) => {
    const { name, value } = event.target;
    setContentForm((prev) => ({ ...prev, [name]: value }));
  };

  const updatePasswordField = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveBasicInfo = async () => {
    setMessage("");
    if (profile.person_id == null) {
      setMessage("Tài khoản chưa liên kết hồ sơ người nên chưa thể cập nhật.");
      return;
    }

    const generationText = String(basicForm.generation || "").trim();
    const generation = generationText === "" ? null : Number(generationText);
    if (generationText && !Number.isFinite(generation)) {
      setMessage("Đời phải là một số hợp lệ.");
      return;
    }

    setSavingBasic(true);
    try {
      const data = await apiRequest("/api/member/profile", {
        method: "PUT",
        body: JSON.stringify({
          email: basicForm.email,
          surname: basicForm.surname,
          middle_name: basicForm.middle_name,
          first_name: basicForm.first_name,
          hometown: basicForm.hometown,
          generation,
        }),
      });
      syncStoredUser(data.profile, setCurrentUser);
      setProfile((prev) => ({ ...prev, ...(data.profile || {}) }));
      setMessage("Đã lưu thông tin cơ bản vào database.");
      await loadProfile();
    } catch (error) {
      setMessage(error?.message || "Không thể lưu thông tin cá nhân.");
    } finally {
      setSavingBasic(false);
    }
  };

  const submitProfileContent = async () => {
    setMessage("");
    if (profile.person_id == null) {
      setMessage("Tài khoản chưa liên kết hồ sơ người nên chưa thể cập nhật ảnh/tiểu sử.");
      return;
    }

    setSavingContent(true);
    try {
      await apiRequest("/api/member/content/profile", {
        method: "POST",
        body: JSON.stringify({
          avatar_url: contentForm.avatar_url,
          bio: contentForm.bio,
        }),
      });
      setMessage("Đã lưu yêu cầu cập nhật ảnh và tiểu sử vào database để quản lý duyệt.");
      await loadProfile();
    } catch (error) {
      setMessage(error?.message || "Không thể gửi cập nhật ảnh và tiểu sử.");
    } finally {
      setSavingContent(false);
    }
  };

  const savePassword = async () => {
    setMessage("");
    if (!passwordForm.current_password || !passwordForm.new_password) {
      setMessage("Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSavingPassword(true);
    try {
      await apiRequest("/api/member/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        }),
      });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setMessage("Đã đổi mật khẩu và lưu vào database.");
    } catch (error) {
      setMessage(error?.message || "Không thể đổi mật khẩu.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="profile-drawer-layer" role="presentation" onMouseDown={onClose}>
      <aside
        className="profile-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="profile-drawer-top">
          <div className="profile-drawer-user">
            <div className="profile-drawer-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : <span className="material-symbols-outlined">person</span>}
            </div>
            <div>
              <span className="profile-drawer-kicker">{roleLabel}</span>
              <h2>{title}</h2>
              <p>{loading ? "Đang tải thông tin..." : displayName}</p>
            </div>
          </div>
          <button type="button" className="profile-drawer-close" onClick={onClose} aria-label="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {message && <div className="profile-drawer-message">{message}</div>}

        <section className="profile-drawer-card">
          <div className="profile-drawer-card-title">
            <span className="material-symbols-outlined">badge</span>
            <div>
              <h3>Thông tin cơ bản</h3>
              <p>Lưu trực tiếp vào tài khoản và hồ sơ thành viên.</p>
            </div>
          </div>

          <div className="profile-drawer-grid">
            <label>
              <span>Họ</span>
              <input name="surname" value={basicForm.surname} onChange={updateBasicField} placeholder="Ví dụ: Nguyễn" />
            </label>
            <label>
              <span>Tên đệm</span>
              <input name="middle_name" value={basicForm.middle_name} onChange={updateBasicField} placeholder="Ví dụ: Minh" />
            </label>
            <label>
              <span>Tên</span>
              <input name="first_name" value={basicForm.first_name} onChange={updateBasicField} placeholder="Ví dụ: Quân" />
            </label>
            <label>
              <span>Email đăng nhập</span>
              <input name="email" type="email" value={basicForm.email} onChange={updateBasicField} placeholder="email@example.com" />
            </label>
            <label>
              <span>Quê quán</span>
              <input name="hometown" value={basicForm.hometown} onChange={updateBasicField} placeholder="Ví dụ: Thanh Hóa" />
            </label>
            <label>
              <span>Đời</span>
              <input name="generation" type="number" min="1" value={basicForm.generation} onChange={updateBasicField} placeholder="Ví dụ: 3" />
            </label>
          </div>

          <button type="button" className="profile-drawer-primary" onClick={saveBasicInfo} disabled={loading || savingBasic}>
            <span className="material-symbols-outlined">save</span>
            {savingBasic ? "Đang lưu..." : "Lưu thông tin cơ bản"}
          </button>
        </section>

        <section className="profile-drawer-card">
          <div className="profile-drawer-card-title">
            <span className="material-symbols-outlined">photo_camera</span>
            <div>
              <h3>Ảnh và tiểu sử</h3>
              <p>Thông tin này được gửi vào hàng chờ duyệt của quản lý.</p>
            </div>
          </div>

          {profile.moderation_status === "pending" && (
            <div className="profile-drawer-note">Đang có yêu cầu cập nhật hồ sơ chờ duyệt.</div>
          )}

          <label className="profile-drawer-full">
            <span>URL ảnh đại diện</span>
            <input name="avatar_url" value={contentForm.avatar_url} onChange={updateContentField} placeholder="https://example.com/avatar.jpg" />
          </label>
          <label className="profile-drawer-full">
            <span>Tiểu sử / giới thiệu</span>
            <textarea name="bio" value={contentForm.bio} onChange={updateContentField} placeholder="Viết vài dòng giới thiệu..." rows={4} />
          </label>

          <button
            type="button"
            className="profile-drawer-secondary"
            onClick={submitProfileContent}
            disabled={loading || savingContent || profile.moderation_status === "pending"}
          >
            <span className="material-symbols-outlined">send</span>
            {savingContent ? "Đang gửi..." : "Gửi duyệt ảnh và tiểu sử"}
          </button>
        </section>

        <section className="profile-drawer-card">
          <div className="profile-drawer-card-title">
            <span className="material-symbols-outlined">lock_reset</span>
            <div>
              <h3>Đổi mật khẩu</h3>
              <p>Mật khẩu mới sẽ được mã hóa và lưu lại trong database.</p>
            </div>
          </div>

          <div className="profile-drawer-grid">
            <label>
              <span>Mật khẩu hiện tại</span>
              <input name="current_password" type="password" value={passwordForm.current_password} onChange={updatePasswordField} placeholder="Nhập mật khẩu hiện tại" />
            </label>
            <label>
              <span>Mật khẩu mới</span>
              <input name="new_password" type="password" value={passwordForm.new_password} onChange={updatePasswordField} placeholder="Nhập mật khẩu mới" />
            </label>
            <label className="profile-drawer-full">
              <span>Xác nhận mật khẩu mới</span>
              <input name="confirm_password" type="password" value={passwordForm.confirm_password} onChange={updatePasswordField} placeholder="Nhập lại mật khẩu mới" />
            </label>
          </div>

          <button type="button" className="profile-drawer-primary" onClick={savePassword} disabled={savingPassword}>
            <span className="material-symbols-outlined">vpn_key</span>
            {savingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
          </button>
        </section>
      </aside>
    </div>
  );
}
