import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMember,
  getMemberDetail,
  getMemberRelations,
  getMembers,
  updateMemberRelations,
  updateMemberByManager,
} from "../../api/managerService";
import { getStoredUser } from "../../utils/auth";
import { compactPayload, fullName } from "./managerData";
import "./manager.css";

const emptyCreateForm = {
  email: "",
  password: "",
  surname: "",
  middle_name: "",
  first_name: "",
  gender: "1",
  birth_date: "",
  hometown: "",
  generation: "1",
  clan_id: "",
};

const emptyEditForm = {
  email: "",
  status: "active",
  role_id: "3",
  surname: "",
  middle_name: "",
  first_name: "",
  gender: "1",
  birth_date: "",
  death_date: "",
  is_living: "1",
  generation: "1",
  branch: "",
  hometown: "",
  address: "",
  phone: "",
  people_email: "",
  avatar_url: "",
  bio: "",
  note: "",
  new_password: "",
};

const emptyRelationForm = {
  parent_father_id: "",
  parent_mother_id: "",
  spouse_id: "",
  children_ids: "",
};

const toEditForm = (member) => ({
  ...emptyEditForm,
  email: member.email || "",
  status: member.status || "active",
  role_id: String(member.role_id ?? 3),
  surname: member.surname || "",
  middle_name: member.middle_name || "",
  first_name: member.first_name || "",
  gender: member.gender == null ? "" : String(member.gender),
  birth_date: member.birth_date || "",
  death_date: member.death_date || "",
  is_living: member.is_living === 0 || member.is_living === false ? "0" : "1",
  generation: member.generation == null ? "1" : String(member.generation),
  branch: member.branch == null ? "" : String(member.branch),
  hometown: member.hometown || "",
  address: member.address || "",
  phone: member.phone || "",
  people_email: member.people_email || "",
  avatar_url: member.avatar_url || "",
  bio: member.bio || "",
  note: member.note || "",
});

const idText = (value) => (value == null || value === "" ? "" : String(value));

export default function AccountPage() {
  const currentUser = getStoredUser();
  const [members, setMembers] = useState([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createOpen, setCreateOpen] = useState(true);
  const [relationOpen, setRelationOpen] = useState(true);
  const [relationAccountId, setRelationAccountId] = useState("");
  const [relationForm, setRelationForm] = useState(emptyRelationForm);
  const [relationDetails, setRelationDetails] = useState(null);
  const [editAccountId, setEditAccountId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [relationLoading, setRelationLoading] = useState(false);
  const [relationSaving, setRelationSaving] = useState(false);
  const [relationMessage, setRelationMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAdmin = Number(currentUser?.role_id) === 1;
  const canAssignManager = isAdmin || Number(currentUser?.role_id) === 2;

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const memberRows = await getMembers();
      setMembers(Array.isArray(memberRows) ? memberRows : []);
    } catch (err) {
      setError(err?.message || "Không thể tải thành viên từ database");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) =>
      [fullName(member), member.email, member.hometown, member.phone, member.person_id, member.account_id]
        .filter((value) => value != null)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [members, search]);

  const memberOptions = useMemo(
    () =>
      members
        .filter((member) => member.person_id != null)
        .map((member) => ({
          accountId: String(member.account_id),
          personId: String(member.person_id),
          label: `#${member.person_id} - ${fullName(member)}${member.generation ? ` (Đời ${member.generation})` : ""}`,
        })),
    [members]
  );

  const selectedRelationMember = useMemo(
    () => members.find((member) => String(member.account_id) === String(relationAccountId)) || null,
    [members, relationAccountId]
  );

  const relationPersonOptions = useMemo(() => {
    const selectedPersonId = selectedRelationMember?.person_id == null ? "" : String(selectedRelationMember.person_id);
    return memberOptions.filter((member) => member.personId !== selectedPersonId);
  }, [memberOptions, selectedRelationMember]);

  const updateCreateField = (event) => {
    const { name, value } = event.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateRelationField = (event) => {
    const { name, value } = event.target;
    setRelationForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateChildrenSelection = (event) => {
    const values = Array.from(event.target.selectedOptions, (option) => option.value);
    setRelationForm((prev) => ({ ...prev, children_ids: values.join(", ") }));
  };

  const updateEditField = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const loadRelationDetails = useCallback(async (accountId, nextMessage = "Đã tải quan hệ hiện có của thành viên.") => {
    if (!accountId) {
      setRelationForm(emptyRelationForm);
      setRelationDetails(null);
      setRelationMessage("");
      return;
    }

    setRelationLoading(true);
    setRelationMessage("");
    setError("");
    try {
      const data = await getMemberRelations(accountId);
      setRelationDetails(data);
      setRelationForm({
        parent_father_id: idText(data?.bloodline?.parent_father_id),
        parent_mother_id: idText(data?.bloodline?.parent_mother_id),
        spouse_id: idText(data?.marriage?.spouse_id),
        children_ids: Array.isArray(data?.marriage?.children_ids) ? data.marriage.children_ids.join(", ") : "",
      });
      setRelationMessage(nextMessage);
    } catch (err) {
      setRelationForm(emptyRelationForm);
      setRelationDetails(null);
      setError(err?.message || "Không thể tải quan hệ thành viên");
    } finally {
      setRelationLoading(false);
    }
  }, []);

  const selectRelationMember = (event) => {
    const accountId = event.target.value;
    setRelationAccountId(accountId);
    loadRelationDetails(accountId);
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = compactPayload(createForm);
      if (!isAdmin) delete payload.clan_id;
      await createMember(payload);
      setCreateForm(emptyCreateForm);
      setMessage("Đã tạo thành viên mới từ database.");
      await loadMembers();
    } catch (err) {
      setError(err?.message || "Không thể tạo thành viên");
    } finally {
      setSaving(false);
    }
  };

  const saveRelations = async (event) => {
    event.preventDefault();
    if (!relationAccountId) {
      setRelationMessage("Vui lòng chọn thành viên cần liên kết.");
      return;
    }

    const hasBloodline = relationForm.parent_father_id || relationForm.parent_mother_id;
    const shouldSaveMarriage =
      relationForm.spouse_id ||
      relationForm.children_ids.trim() ||
      relationDetails?.marriage?.family_id ||
      relationDetails?.marriage?.spouse_id ||
      (Array.isArray(relationDetails?.marriage?.children_ids) && relationDetails.marriage.children_ids.length > 0);

    if (!hasBloodline && !shouldSaveMarriage) {
      setRelationMessage("Chưa có thông tin quan hệ để lưu.");
      return;
    }

    setRelationSaving(true);
    setRelationMessage("");
    setError("");
    try {
      if (hasBloodline) {
        await updateMemberRelations(relationAccountId, {
          mode: "bloodline",
          parent_father_id: relationForm.parent_father_id || null,
          parent_mother_id: relationForm.parent_mother_id || null,
        });
      }

      if (shouldSaveMarriage) {
        await updateMemberRelations(relationAccountId, {
          mode: "marriage",
          spouse_id: relationForm.spouse_id || null,
          children_ids: relationForm.children_ids,
        });
      }

      await loadRelationDetails(relationAccountId, "Đã lưu liên kết quan hệ.");
    } catch (err) {
      setError(err?.message || "Không thể lưu liên kết quan hệ");
    } finally {
      setRelationSaving(false);
    }
  };

  const openEdit = async (accountId) => {
    setEditAccountId(accountId);
    setMessage("");
    setError("");
    try {
      const data = await getMemberDetail(accountId);
      setEditForm(toEditForm(data.member || {}));
    } catch (err) {
      setError(err?.message || "Không thể tải chi tiết thành viên");
      setEditAccountId(null);
    }
  };

  const saveEdit = async () => {
    if (!editAccountId) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await updateMemberByManager(editAccountId, compactPayload(editForm));
      setMessage("Đã lưu thay đổi thành viên vào database.");
      setEditAccountId(null);
      await loadMembers();
    } catch (err) {
      setError(err?.message || "Không thể lưu thành viên");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="manager-data-page">
      <div className="manager-data-header">
        <div>
          <h2>Thành viên dòng họ</h2>
          <p>Quản lý thành viên trong dòng họ: tạo mới, tìm kiếm, chỉnh sửa hồ sơ và liên kết quan hệ.</p>
        </div>
        <button className="mgr-btnGhost" type="button" onClick={loadMembers} disabled={loading}>
          Tải lại
        </button>
      </div>

      {message && <div className="manager-inline-message">{message}</div>}
      {error && <div className="manager-inline-error">{error}</div>}

      <div className="manager-data-grid">
        <div className="panel-card member-stack">
          <div className="collapsible-section">
            <button className="collapsible-toggle" type="button" onClick={() => setCreateOpen((value) => !value)}>
              <span>Tạo thành viên</span>
              <span className="material-symbols-outlined">{createOpen ? "expand_less" : "expand_more"}</span>
            </button>

            {createOpen && (
              <form className="member-form" onSubmit={submitCreate}>
                <input className="mgr-field" name="email" type="email" value={createForm.email} onChange={updateCreateField} placeholder="Email đăng nhập" required />
                <input className="mgr-field" name="password" type="password" value={createForm.password} onChange={updateCreateField} placeholder="Mật khẩu" required />
                <div className="form-row">
                  <input className="mgr-field" name="surname" value={createForm.surname} onChange={updateCreateField} placeholder="Họ" />
                  <input className="mgr-field" name="middle_name" value={createForm.middle_name} onChange={updateCreateField} placeholder="Tên đệm" />
                </div>
                <input className="mgr-field" name="first_name" value={createForm.first_name} onChange={updateCreateField} placeholder="Tên" required />
                <div className="form-row">
                  <select className="mgr-field" name="gender" value={createForm.gender} onChange={updateCreateField}>
                    <option value="1">Nam</option>
                    <option value="2">Nữ</option>
                    <option value="">Không khai báo</option>
                  </select>
                  <input className="mgr-field" name="generation" type="number" min="1" value={createForm.generation} onChange={updateCreateField} placeholder="Đời" />
                </div>
                <input className="mgr-field" name="birth_date" type="date" value={createForm.birth_date} onChange={updateCreateField} />
                <input className="mgr-field" name="hometown" value={createForm.hometown} onChange={updateCreateField} placeholder="Quê quán" />
                {isAdmin && <input className="mgr-field" name="clan_id" type="number" value={createForm.clan_id} onChange={updateCreateField} placeholder="clan_id" />}
                <button className="mgr-btnPrimary" type="submit" disabled={saving}>
                  {saving ? "Đang lưu..." : "Tạo thành viên"}
                </button>
              </form>
            )}
          </div>

          <div className="collapsible-section relation-form">
            <button className="collapsible-toggle" type="button" onClick={() => setRelationOpen((value) => !value)}>
              <span>Liên kết quan hệ</span>
              <span className="material-symbols-outlined">{relationOpen ? "expand_less" : "expand_more"}</span>
            </button>

            {relationOpen && (
              <form className="member-form" onSubmit={saveRelations}>
                <p className="relation-note">Chọn một thành viên để xem và cập nhật cha, mẹ, vợ/chồng, con cái.</p>

                <label className="relation-field">
                  <span>Thành viên cần liên kết</span>
                  <select className="mgr-field" value={relationAccountId} onChange={selectRelationMember}>
                    <option value="">Chọn thành viên</option>
                    {memberOptions.map((member) => (
                      <option key={member.accountId} value={member.accountId}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                </label>

                {relationAccountId && (
                  <>
                    <label className="relation-field">
                      <span>Cha</span>
                      <select className="mgr-field" name="parent_father_id" value={relationForm.parent_father_id} onChange={updateRelationField} disabled={relationLoading}>
                        <option value="">Chưa chọn cha</option>
                        {relationPersonOptions.map((member) => (
                          <option key={member.personId} value={member.personId}>
                            {member.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="relation-field">
                      <span>Mẹ</span>
                      <select className="mgr-field" name="parent_mother_id" value={relationForm.parent_mother_id} onChange={updateRelationField} disabled={relationLoading}>
                        <option value="">Chưa chọn mẹ</option>
                        {relationPersonOptions.map((member) => (
                          <option key={member.personId} value={member.personId}>
                            {member.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="relation-field">
                      <span>Vợ/chồng</span>
                      <select className="mgr-field" name="spouse_id" value={relationForm.spouse_id} onChange={updateRelationField} disabled={relationLoading}>
                        <option value="">Chưa chọn vợ/chồng</option>
                        {relationPersonOptions.map((member) => (
                          <option key={member.personId} value={member.personId}>
                            {member.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="relation-field">
                      <span>Con cái</span>
                      <select
                        className="mgr-field relation-children-select"
                        multiple
                        value={relationForm.children_ids ? relationForm.children_ids.split(",").map((item) => item.trim()).filter(Boolean) : []}
                        onChange={updateChildrenSelection}
                        disabled={relationLoading}
                      >
                        {relationPersonOptions.map((member) => (
                          <option key={member.personId} value={member.personId}>
                            {member.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="relation-summary">
                      <strong>Quan hệ hiện tại</strong>
                      <span>Cha: {relationDetails?.bloodline?.parent_father_name || "Chưa có"}</span>
                      <span>Mẹ: {relationDetails?.bloodline?.parent_mother_name || "Chưa có"}</span>
                      <span>Vợ/chồng: {relationDetails?.marriage?.spouse_name || "Chưa có"}</span>
                      <span>
                        Con cái:{" "}
                        {relationDetails?.marriage?.children?.length
                          ? relationDetails.marriage.children.map((child) => child.name).join(", ")
                          : "Chưa có"}
                      </span>
                    </div>

                    {relationMessage && <div className="mgr-subtle">{relationMessage}</div>}

                    <button className="mgr-btnPrimary" type="submit" disabled={relationLoading || relationSaving}>
                      {relationSaving ? "Đang lưu..." : "Lưu quan hệ"}
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </div>

        <div className="panel-card">
          <div className="manager-list-toolbar">
            <h2>Danh sách ({filteredMembers.length})</h2>
            <input className="mgr-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, email, quê quán..." />
          </div>
          <div className="manager-member-table">
            {filteredMembers.map((member) => (
              <div className="manager-member-row" key={member.account_id}>
                <div>
                  <strong>{fullName(member)}</strong>
                  <span>#{member.person_id} · {member.email}</span>
                </div>
                <div>Đời {member.generation || "?"}</div>
                <div>{member.hometown || "Chưa có quê quán"}</div>
                <button className="mgr-btnGhost" type="button" onClick={() => openEdit(member.account_id)}>
                  Sửa
                </button>
              </div>
            ))}
            {!loading && filteredMembers.length === 0 && <div className="mgr-empty">Không có thành viên phù hợp.</div>}
          </div>
        </div>
      </div>

      {editAccountId && (
        <div className="mgr-modalOverlay" role="presentation" onClick={() => !saving && setEditAccountId(null)}>
          <div className="mgr-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="mgr-modalClose" type="button" onClick={() => setEditAccountId(null)} disabled={saving}>
              ×
            </button>
            <h2 className="mgr-modalTitle">Chỉnh sửa thành viên #{editAccountId}</h2>
            <div className="mgr-overviewFormGrid mgr-modalGrid">
              <input className="mgr-field" name="email" type="email" value={editForm.email} onChange={updateEditField} placeholder="Email đăng nhập" />
              <select className="mgr-field" name="status" value={editForm.status} onChange={updateEditField}>
                <option value="active">active</option>
                <option value="pending">pending</option>
                <option value="rejected">rejected</option>
              </select>
              {canAssignManager && (
                <select className="mgr-field" name="role_id" value={editForm.role_id} onChange={updateEditField}>
                  <option value="3">Member</option>
                  <option value="2">Manager</option>
                </select>
              )}
              <input className="mgr-field" name="new_password" type="password" value={editForm.new_password} onChange={updateEditField} placeholder="Mật khẩu mới nếu cần đổi" />
              <input className="mgr-field" name="surname" value={editForm.surname} onChange={updateEditField} placeholder="Họ" />
              <input className="mgr-field" name="middle_name" value={editForm.middle_name} onChange={updateEditField} placeholder="Tên đệm" />
              <input className="mgr-field" name="first_name" value={editForm.first_name} onChange={updateEditField} placeholder="Tên" />
              <select className="mgr-field" name="gender" value={editForm.gender} onChange={updateEditField}>
                <option value="1">Nam</option>
                <option value="2">Nữ</option>
                <option value="">Không khai báo</option>
              </select>
              <input className="mgr-field" name="birth_date" type="date" value={editForm.birth_date} onChange={updateEditField} />
              <input className="mgr-field" name="death_date" type="date" value={editForm.death_date} onChange={updateEditField} />
              <select className="mgr-field" name="is_living" value={editForm.is_living} onChange={updateEditField}>
                <option value="1">Còn sống</option>
                <option value="0">Đã mất</option>
              </select>
              <input className="mgr-field" name="generation" type="number" min="1" value={editForm.generation} onChange={updateEditField} placeholder="Đời" />
              <input className="mgr-field" name="branch" type="number" value={editForm.branch} onChange={updateEditField} placeholder="Chi" />
              <input className="mgr-field" name="hometown" value={editForm.hometown} onChange={updateEditField} placeholder="Quê quán" />
              <input className="mgr-field" name="phone" value={editForm.phone} onChange={updateEditField} placeholder="Điện thoại" />
              <input className="mgr-field" name="people_email" type="email" value={editForm.people_email} onChange={updateEditField} placeholder="Email phụ" />
              <input className="mgr-field" name="address" value={editForm.address} onChange={updateEditField} placeholder="Địa chỉ" />
              <input className="mgr-field" name="avatar_url" value={editForm.avatar_url} onChange={updateEditField} placeholder="URL ảnh đại diện" />
              <textarea className="mgr-field mgr-fieldTextarea" name="bio" value={editForm.bio} onChange={updateEditField} placeholder="Tiểu sử" />
              <textarea className="mgr-field mgr-fieldTextarea" name="note" value={editForm.note} onChange={updateEditField} placeholder="Ghi chú" />
            </div>
            <div className="mgr-modalActions">
              <button className="mgr-btnPrimary" type="button" onClick={saveEdit} disabled={saving}>
                Lưu thay đổi
              </button>
              <button className="mgr-btnGhost" type="button" onClick={() => setEditAccountId(null)} disabled={saving}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
