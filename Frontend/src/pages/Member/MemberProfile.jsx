import { useCallback, useEffect, useMemo, useState } from "react";
import {
  changeMemberPassword,
  getMemberDashboard,
  proposeProfileUpdate,
  updateMemberProfile,
} from "../../api/memberService";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import { getStoredUser } from "../../utils/auth";
import "./MemberDashboard.css";

function personName(person) {
  return (
    person?.display_name ||
    [person?.surname, person?.middle_name, person?.first_name].filter(Boolean).join(" ").trim() ||
    `Thành viên #${person?.id}`
  );
}

function profileStatusText(status) {
  if (status === "pending") return "Chờ duyệt";
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Từ chối";
  return "Chưa gửi";
}

function updateStoredUser(profile) {
  const current = getStoredUser() || {};
  const next = {
    ...current,
    name: profile.display_name || current.name,
    email: profile.email || current.email,
    status: profile.status || current.status,
    role_id: profile.role_id || current.role_id,
    avatar_url: profile.avatar_url || current.avatar_url,
  };
  localStorage.setItem("user", JSON.stringify(next));
  localStorage.setItem("auth_user", JSON.stringify(next));
}

export default function MemberProfile() {
  const [loading, setLoading] = useState(true);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingRelations, setSavingRelations] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState({});
  const [treeMembers, setTreeMembers] = useState([]);
  const [basicForm, setBasicForm] = useState({
    surname: "",
    middle_name: "",
    first_name: "",
    email: "",
    hometown: "",
    generation: "",
  });
  const [contentForm, setContentForm] = useState({ bio: "", avatar_url: "" });
  const [relationForm, setRelationForm] = useState({ spouse_id: "", children_ids: [] });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getMemberDashboard();
      const nextProfile = response.profile || {};
      setProfile(nextProfile);
      setTreeMembers(response.treeMembers || []);
      setBasicForm({
        surname: nextProfile.surname || "",
        middle_name: nextProfile.middle_name || "",
        first_name: nextProfile.first_name || "",
        email: nextProfile.email || "",
        hometown: nextProfile.hometown || "",
        generation: nextProfile.generation ?? "",
      });
      setContentForm({
        bio: nextProfile.pending_bio != null ? nextProfile.pending_bio || "" : nextProfile.bio || "",
        avatar_url:
          nextProfile.pending_avatar_url != null
            ? nextProfile.pending_avatar_url || ""
            : nextProfile.avatar_url || "",
      });
      setRelationForm({
        spouse_id: nextProfile.spouse_id ?? "",
        children_ids: Array.isArray(nextProfile.children_ids) ? nextProfile.children_ids.map(Number) : [],
      });
    } catch (err) {
      setError(err?.message || "Không thể tải hồ sơ thành viên.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const relationCandidates = useMemo(() => {
    return treeMembers.filter((member) => Number(member.id) !== Number(profile.person_id));
  }, [profile.person_id, treeMembers]);

  const childCandidates = useMemo(() => {
    return relationCandidates.filter((member) => String(member.id) !== String(relationForm.spouse_id));
  }, [relationCandidates, relationForm.spouse_id]);

  const selectedChildren = useMemo(() => new Set(relationForm.children_ids.map(Number)), [relationForm.children_ids]);

  const toggleChild = (id) => {
    setRelationForm((current) => {
      const next = new Set(current.children_ids.map(Number));
      if (next.has(Number(id))) next.delete(Number(id));
      else next.add(Number(id));
      return { ...current, children_ids: [...next].sort((a, b) => a - b) };
    });
  };

  const saveBasicProfile = async (event) => {
    event.preventDefault();
    setSavingBasic(true);
    setError("");
    setNotice("");
    try {
      const generationText = String(basicForm.generation ?? "").trim();
      const generation = generationText === "" ? null : Number(generationText);
      if (generationText !== "" && !Number.isFinite(generation)) {
        throw new Error("Đời phải là số hợp lệ.");
      }

      const response = await updateMemberProfile({
        ...basicForm,
        generation,
      });
      updateStoredUser(response.profile || {});
      setNotice("Đã lưu thông tin cơ bản.");
      await loadProfile();
    } catch (err) {
      setError(err?.message || "Không thể lưu thông tin cơ bản.");
    } finally {
      setSavingBasic(false);
    }
  };

  const saveContentForReview = async (event) => {
    event.preventDefault();
    setSavingContent(true);
    setError("");
    setNotice("");
    try {
      await proposeProfileUpdate({
        bio: contentForm.bio,
        avatar_url: contentForm.avatar_url,
      });
      setNotice("Đã gửi ảnh và tiểu sử để quản lý duyệt.");
      await loadProfile();
    } catch (err) {
      setError(err?.message || "Không thể gửi yêu cầu duyệt hồ sơ.");
    } finally {
      setSavingContent(false);
    }
  };

  const saveRelations = async (event) => {
    event.preventDefault();
    setSavingRelations(true);
    setError("");
    setNotice("");
    try {
      const spouseId = String(relationForm.spouse_id || "").trim();
      const response = await updateMemberProfile({
        spouse_id: spouseId === "" ? null : Number(spouseId),
        children_ids: relationForm.children_ids,
      });
      updateStoredUser(response.profile || {});
      setNotice("Đã lưu quan hệ gia đình.");
      await loadProfile();
    } catch (err) {
      setError(err?.message || "Không thể lưu quan hệ gia đình.");
    } finally {
      setSavingRelations(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setError("");
    setNotice("");
    try {
      if (!passwordForm.current) throw new Error("Vui lòng nhập mật khẩu hiện tại.");
      if (passwordForm.next.length < 6) throw new Error("Mật khẩu mới cần ít nhất 6 ký tự.");
      if (passwordForm.next !== passwordForm.confirm) throw new Error("Mật khẩu xác nhận không khớp.");

      await changeMemberPassword({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
      });
      setPasswordForm({ current: "", next: "", confirm: "" });
      setNotice("Đã đổi mật khẩu.");
    } catch (err) {
      setError(err?.message || "Không thể đổi mật khẩu.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="member-portal-page">
        <section className="member-panel">
          <div className="member-empty">Đang tải hồ sơ...</div>
        </section>
      </div>
    );
  }

  return (
    <div className="member-portal-page">
      {(error || notice) && <div className={`member-alert ${error ? "is-error" : "is-success"}`}>{error || notice}</div>}

      <section className="member-hero-panel">
        <div>
          <span className="member-kicker">Hồ sơ cá nhân</span>
          <h1>{personName(profile)}</h1>
          <p>Cập nhật thông tin cơ bản, quan hệ gia đình, ảnh đại diện và mật khẩu đăng nhập.</p>
        </div>
        {contentForm.avatar_url && <img className="member-profile-avatar" src={contentForm.avatar_url} alt="" />}
      </section>

      <div className="member-content-grid">
        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Thông tin cơ bản</h2>
              <p>Thông tin này được lưu trực tiếp vào hồ sơ người trong gia phả.</p>
            </div>
          </div>
          <form className="member-form" onSubmit={saveBasicProfile}>
            <div className="member-form-grid">
              <label className="member-label">
                Họ
                <input value={basicForm.surname} onChange={(event) => setBasicForm((current) => ({ ...current, surname: event.target.value }))} />
              </label>
              <label className="member-label">
                Tên đệm
                <input value={basicForm.middle_name} onChange={(event) => setBasicForm((current) => ({ ...current, middle_name: event.target.value }))} />
              </label>
              <label className="member-label">
                Tên
                <input value={basicForm.first_name} onChange={(event) => setBasicForm((current) => ({ ...current, first_name: event.target.value }))} />
              </label>
              <label className="member-label">
                Đời
                <input
                  type="number"
                  min={1}
                  value={basicForm.generation}
                  onChange={(event) => setBasicForm((current) => ({ ...current, generation: event.target.value }))}
                />
              </label>
              <label className="member-label member-form-full">
                Email đăng nhập
                <input type="email" value={basicForm.email} onChange={(event) => setBasicForm((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label className="member-label member-form-full">
                Quê quán
                <input value={basicForm.hometown} onChange={(event) => setBasicForm((current) => ({ ...current, hometown: event.target.value }))} />
              </label>
            </div>
            <button className="member-btn member-btn-primary" type="submit" disabled={savingBasic || !profile.person_id}>
              Lưu thông tin cơ bản
            </button>
          </form>
        </section>

        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Ảnh và tiểu sử</h2>
              <p>
                Trạng thái: <span className={`member-status status-${profile.moderation_status || "none"}`}>{profileStatusText(profile.moderation_status)}</span>
              </p>
            </div>
          </div>
          <form className="member-form" onSubmit={saveContentForReview}>
            <ImageUpload
              label="Tải ảnh hồ sơ"
              onUploadSuccess={(url) => setContentForm((current) => ({ ...current, avatar_url: url }))}
            />
            <label className="member-label">
              URL ảnh hiện tại
              <input value={contentForm.avatar_url} onChange={(event) => setContentForm((current) => ({ ...current, avatar_url: event.target.value }))} />
            </label>
            <label className="member-label">
              Tiểu sử
              <textarea rows={5} value={contentForm.bio} onChange={(event) => setContentForm((current) => ({ ...current, bio: event.target.value }))} />
            </label>
            {profile.moderation_reason && <div className="member-empty">Ghi chú duyệt: {profile.moderation_reason}</div>}
            <button className="member-btn member-btn-primary" type="submit" disabled={savingContent || profile.moderation_status === "pending" || !profile.person_id}>
              Gửi duyệt ảnh và tiểu sử
            </button>
          </form>
        </section>
      </div>

      <div className="member-content-grid">
        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Quan hệ gia đình</h2>
              <p>Chọn vợ/chồng và con trong danh sách thành viên cùng dòng họ.</p>
            </div>
          </div>
          <div className="member-empty">
            Member không còn chỉnh sửa quan hệ gia đình từ trang hồ sơ. Khi manager cấp temporary edit key hợp lệ, hãy vào trang cây gia phả để sửa trong phạm vi được phép.
          </div>
          <form className="member-form" onSubmit={saveRelations} style={{ display: "none" }}>
            <label className="member-label">
              Vợ / chồng
              <select value={relationForm.spouse_id} onChange={(event) => setRelationForm((current) => ({ ...current, spouse_id: event.target.value }))}>
                <option value="">Chưa chọn</option>
                {relationCandidates.map((member) => (
                  <option key={member.id} value={member.id}>
                    {personName(member)} (ID {member.id})
                  </option>
                ))}
              </select>
            </label>
            <div className="member-label">
              Con cái
              <div className="member-checkbox-list">
                {childCandidates.length === 0 ? (
                  <div className="member-empty">Không có thành viên phù hợp để chọn.</div>
                ) : (
                  childCandidates.map((member) => (
                    <label className="member-checkbox-row" key={member.id}>
                      <input type="checkbox" checked={selectedChildren.has(Number(member.id))} onChange={() => toggleChild(member.id)} />
                      <span>{personName(member)} (ID {member.id})</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <button className="member-btn member-btn-primary" type="submit" disabled={savingRelations || !profile.person_id}>
              Lưu quan hệ
            </button>
          </form>
        </section>

        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Đổi mật khẩu</h2>
              <p>Mật khẩu mới cần tối thiểu 6 ký tự.</p>
            </div>
          </div>
          <form className="member-form" onSubmit={savePassword}>
            <label className="member-label">
              Mật khẩu hiện tại
              <input
                type="password"
                value={passwordForm.current}
                onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))}
                autoComplete="current-password"
              />
            </label>
            <label className="member-label">
              Mật khẩu mới
              <input
                type="password"
                value={passwordForm.next}
                onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))}
                autoComplete="new-password"
              />
            </label>
            <label className="member-label">
              Xác nhận mật khẩu mới
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))}
                autoComplete="new-password"
              />
            </label>
            <button className="member-btn member-btn-primary" type="submit" disabled={savingPassword}>
              Đổi mật khẩu
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
