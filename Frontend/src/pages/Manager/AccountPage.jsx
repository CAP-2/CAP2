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
import { formatLunarFullFromSolar } from "../../utils/lunarCalendar";
import DateInput from "../../components/common/DateInput";
import { isoToVietnamDate, vietnamDateToIso } from "../../utils/dateFormat";
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
  birth_date: isoToVietnamDate(member.birth_date),
  death_date: isoToVietnamDate(member.death_date),
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

function LunarDateHint({ value, label = "Âm lịch" }) {
  const text = formatLunarFullFromSolar(value);
  if (!text) return null;

  return (
    <small className="mgr-lunarHint">
      {label}: {text}
    </small>
  );
}

export default function AccountPage() {
  const currentUser = getStoredUser();

  const [members, setMembers] = useState([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [relationOpen, setRelationOpen] = useState(false);

  const [relationAccountId, setRelationAccountId] = useState("");
  const [relationForm, setRelationForm] = useState(emptyRelationForm);
  const [relationDetails, setRelationDetails] = useState(null);

  const [editAccountId, setEditAccountId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);

  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [livingFilter, setLivingFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [generationFilter, setGenerationFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [relationLoading, setRelationLoading] = useState(false);
  const [relationSaving, setRelationSaving] = useState(false);
  const [relationMessage, setRelationMessage] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAdmin = Number(currentUser?.role_id) === 1;
  const canAssignManager = isAdmin || Number(currentUser?.role_id) === 2;

  const normalizeText = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const getGenderLabel = (gender) => {
    if (String(gender) === "1" || String(gender).toLowerCase() === "male") return "Nam";
    if (String(gender) === "2" || String(gender).toLowerCase() === "female") return "Nữ";
    return "Chưa rõ";
  };

  const getLivingLabel = (member) => {
    if (member.is_living === 0 || member.is_living === false) return "Đã mất";
    return "Còn sống";
  };

  const getStatusLabel = (status) => {
    if (status === "active") return "Đang hoạt động";
    if (status === "pending") return "Chờ duyệt";
    if (status === "rejected") return "Từ chối";
    return status || "Chưa rõ";
  };

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

  const generationOptions = useMemo(() => {
    return [...new Set(members.map((m) => m.generation).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b))
      .map(String);
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = normalizeText(search);

    return members.filter((member) => {
      const matchSearch =
        !q ||
        [
          fullName(member),
          member.email,
          member.hometown,
          member.phone,
          member.person_id,
          member.account_id,
          member.branch,
          member.generation,
        ]
          .filter((value) => value != null)
          .some((value) => normalizeText(value).includes(q));

      const matchGender =
        !genderFilter || String(member.gender || "") === String(genderFilter);

      const matchLiving =
        !livingFilter ||
        (livingFilter === "living" &&
          !(member.is_living === 0 || member.is_living === false)) ||
        (livingFilter === "dead" &&
          (member.is_living === 0 || member.is_living === false));

      const matchStatus =
        !statusFilter || String(member.status || "") === String(statusFilter);

      const matchGeneration =
        !generationFilter ||
        String(member.generation || "") === String(generationFilter);

      return matchSearch && matchGender && matchLiving && matchStatus && matchGeneration;
    });
  }, [members, search, genderFilter, livingFilter, statusFilter, generationFilter]);

  const summary = useMemo(() => {
    const total = members.length;
    const male = members.filter((m) => String(m.gender) === "1").length;
    const female = members.filter((m) => String(m.gender) === "2").length;
    const living = members.filter(
      (m) => !(m.is_living === 0 || m.is_living === false)
    ).length;
    const pending = members.filter((m) => m.status === "pending").length;

    return { total, male, female, living, pending };
  }, [members]);

  const memberOptions = useMemo(
    () =>
      members
        .filter((member) => member.person_id != null)
        .map((member) => ({
          accountId: String(member.account_id),
          personId: String(member.person_id),
          label: `${fullName(member)}${member.generation ? ` (Đời ${member.generation})` : ""}`,
        })),
    [members]
  );

  const selectedRelationMember = useMemo(
    () =>
      members.find((member) => String(member.account_id) === String(relationAccountId)) ||
      null,
    [members, relationAccountId]
  );

  const relationPersonOptions = useMemo(() => {
    const selectedPersonId =
      selectedRelationMember?.person_id == null
        ? ""
        : String(selectedRelationMember.person_id);

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

  const loadRelationDetails = useCallback(
    async (accountId, nextMessage = "Đã tải quan hệ hiện có của thành viên.") => {
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
          children_ids: Array.isArray(data?.marriage?.children_ids)
            ? data.marriage.children_ids.join(", ")
            : "",
        });
        setRelationMessage(nextMessage);
      } catch (err) {
        setRelationForm(emptyRelationForm);
        setRelationDetails(null);
        setError(err?.message || "Không thể tải quan hệ thành viên");
      } finally {
        setRelationLoading(false);
      }
    },
    []
  );

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
      const payload = compactPayload({
        ...createForm,
        birth_date: vietnamDateToIso(createForm.birth_date) || null,
      });

      if (!isAdmin) delete payload.clan_id;

      await createMember(payload);
      setCreateForm(emptyCreateForm);
      setMessage("Đã tạo thành viên mới từ database.");
      setCreateOpen(false);
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

    const hasBloodline =
      relationForm.parent_father_id || relationForm.parent_mother_id;

    const shouldSaveMarriage =
      relationForm.spouse_id ||
      relationForm.children_ids.trim() ||
      relationDetails?.marriage?.family_id ||
      relationDetails?.marriage?.spouse_id ||
      (Array.isArray(relationDetails?.marriage?.children_ids) &&
        relationDetails.marriage.children_ids.length > 0);

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
      await updateMemberByManager(
        editAccountId,
        compactPayload({
          ...editForm,
          birth_date: vietnamDateToIso(editForm.birth_date) || null,
          death_date:
            editForm.is_living === "1"
              ? null
              : vietnamDateToIso(editForm.death_date) || null,
        })
      );

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
    <section className="manager-data-page member-manager-pro">
      <div className="member-pro-header">
        <div>
          <span>Quản lý nhân sự dòng họ</span>
          <h2>Thành viên dòng họ</h2>
          <p>
            Tạo mới, tìm kiếm, chỉnh sửa hồ sơ và liên kết quan hệ cha mẹ,
            vợ/chồng, con cái.
          </p>
        </div>

        <div className="member-pro-header-actions">
          <button
            className="member-pro-btn member-pro-btn-light"
            type="button"
            onClick={loadMembers}
            disabled={loading}
          >
            <span className="material-symbols-outlined">refresh</span>
            {loading ? "Đang tải..." : "Tải lại"}
          </button>

          <button
            className="member-pro-btn member-pro-btn-gold"
            type="button"
            onClick={() => setCreateOpen((value) => !value)}
          >
            <span className="material-symbols-outlined">person_add</span>
            Thêm thành viên
          </button>
        </div>
      </div>

      {message && <div className="manager-inline-message">{message}</div>}
      {error && <div className="manager-inline-error">{error}</div>}

      <div className="member-pro-summary">
        <div className="member-pro-stat">
          <span className="material-symbols-outlined">groups</span>
          <div>
            <strong>{summary.total}</strong>
            <p>Tổng thành viên</p>
          </div>
        </div>

        <div className="member-pro-stat">
          <span className="material-symbols-outlined">male</span>
          <div>
            <strong>{summary.male}</strong>
            <p>Nam</p>
          </div>
        </div>

        <div className="member-pro-stat">
          <span className="material-symbols-outlined">female</span>
          <div>
            <strong>{summary.female}</strong>
            <p>Nữ</p>
          </div>
        </div>

        <div className="member-pro-stat">
          <span className="material-symbols-outlined">favorite</span>
          <div>
            <strong>{summary.living}</strong>
            <p>Còn sống</p>
          </div>
        </div>

        <div className="member-pro-stat">
          <span className="material-symbols-outlined">pending_actions</span>
          <div>
            <strong>{summary.pending}</strong>
            <p>Chờ duyệt</p>
          </div>
        </div>
      </div>

      {(createOpen || relationOpen) && (
        <div className="member-pro-tools-grid">
          {createOpen && (
            <div className="member-pro-panel">
              <div className="member-pro-panel-head">
                <div>
                  <h3>Tạo thành viên</h3>
                  <p>Thêm tài khoản và hồ sơ thành viên mới.</p>
                </div>

                <button
                  className="member-pro-icon-btn"
                  type="button"
                  onClick={() => setCreateOpen(false)}
                >
                  ×
                </button>
              </div>

              <form className="member-pro-form" onSubmit={submitCreate}>
                <div className="member-pro-form-grid">
                  <input
                    className="mgr-field"
                    name="email"
                    type="email"
                    value={createForm.email}
                    onChange={updateCreateField}
                    placeholder="Email đăng nhập"
                    required
                  />

                  <input
                    className="mgr-field"
                    name="password"
                    type="password"
                    value={createForm.password}
                    onChange={updateCreateField}
                    placeholder="Mật khẩu"
                    required
                  />

                  <input
                    className="mgr-field"
                    name="surname"
                    value={createForm.surname}
                    onChange={updateCreateField}
                    placeholder="Họ"
                  />

                  <input
                    className="mgr-field"
                    name="middle_name"
                    value={createForm.middle_name}
                    onChange={updateCreateField}
                    placeholder="Tên đệm"
                  />

                  <input
                    className="mgr-field"
                    name="first_name"
                    value={createForm.first_name}
                    onChange={updateCreateField}
                    placeholder="Tên"
                    required
                  />

                  <select
                    className="mgr-field"
                    name="gender"
                    value={createForm.gender}
                    onChange={updateCreateField}
                  >
                    <option value="1">Nam</option>
                    <option value="2">Nữ</option>
                    <option value="">Không khai báo</option>
                  </select>

                  <input
                    className="mgr-field"
                    name="generation"
                    type="number"
                    min="1"
                    value={createForm.generation}
                    onChange={updateCreateField}
                    placeholder="Đời"
                  />

                  <div className="mgr-dateField">
                    <DateInput
                      className="mgr-field"
                      name="birth_date"
                      value={createForm.birth_date}
                      onChange={updateCreateField}
                    />
                    <LunarDateHint value={createForm.birth_date} label="Ngày sinh âm lịch" />
                  </div>

                  <input
                    className="mgr-field member-pro-full"
                    name="hometown"
                    value={createForm.hometown}
                    onChange={updateCreateField}
                    placeholder="Quê quán"
                  />

                  {isAdmin && (
                    <input
                      className="mgr-field"
                      name="clan_id"
                      type="number"
                      value={createForm.clan_id}
                      onChange={updateCreateField}
                      placeholder="clan_id"
                    />
                  )}
                </div>

                <button className="mgr-btnPrimary" type="submit" disabled={saving}>
                  {saving ? "Đang lưu..." : "Tạo thành viên"}
                </button>
              </form>
            </div>
          )}

          {relationOpen && (
            <div className="member-pro-panel">
              <div className="member-pro-panel-head">
                <div>
                  <h3>Liên kết quan hệ</h3>
                  <p>Cập nhật cha, mẹ, vợ/chồng và con cái.</p>
                </div>

                <button
                  className="member-pro-icon-btn"
                  type="button"
                  onClick={() => setRelationOpen(false)}
                >
                  ×
                </button>
              </div>

              <form className="member-pro-form" onSubmit={saveRelations}>
                <label className="relation-field">
                  <span>Thành viên cần liên kết</span>
                  <select
                    className="mgr-field"
                    value={relationAccountId}
                    onChange={selectRelationMember}
                  >
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
                    <div className="member-pro-form-grid">
                      <label className="relation-field">
                        <span>Cha</span>
                        <select
                          className="mgr-field"
                          name="parent_father_id"
                          value={relationForm.parent_father_id}
                          onChange={updateRelationField}
                          disabled={relationLoading}
                        >
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
                        <select
                          className="mgr-field"
                          name="parent_mother_id"
                          value={relationForm.parent_mother_id}
                          onChange={updateRelationField}
                          disabled={relationLoading}
                        >
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
                        <select
                          className="mgr-field"
                          name="spouse_id"
                          value={relationForm.spouse_id}
                          onChange={updateRelationField}
                          disabled={relationLoading}
                        >
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
                          value={
                            relationForm.children_ids
                              ? relationForm.children_ids
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean)
                              : []
                          }
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
                    </div>

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

                    <button
                      className="mgr-btnPrimary"
                      type="submit"
                      disabled={relationLoading || relationSaving}
                    >
                      {relationSaving ? "Đang lưu..." : "Lưu quan hệ"}
                    </button>
                  </>
                )}
              </form>
            </div>
          )}
        </div>
      )}

      <div className="member-pro-main-panel">
        <div className="member-pro-toolbar">
          <div>
            <h3>Danh sách thành viên</h3>
            <p>
              Đang hiển thị <strong>{filteredMembers.length}</strong> / {members.length} thành viên.
            </p>
          </div>

          <div className="member-pro-toolbar-actions">
            <button
              className="member-pro-btn member-pro-btn-light"
              type="button"
              onClick={() => setRelationOpen((value) => !value)}
            >
              <span className="material-symbols-outlined">account_tree</span>
              Liên kết quan hệ
            </button>
          </div>
        </div>

        <div className="member-pro-filter-grid">
          <input
            className="mgr-field"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tên, email, quê quán, số điện thoại..."
          />

          <select
            className="mgr-field"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
          >
            <option value="">Tất cả giới tính</option>
            <option value="1">Nam</option>
            <option value="2">Nữ</option>
          </select>

          <select
            className="mgr-field"
            value={livingFilter}
            onChange={(e) => setLivingFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái sống</option>
            <option value="living">Còn sống</option>
            <option value="dead">Đã mất</option>
          </select>

          <select
            className="mgr-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả tài khoản</option>
            <option value="active">Đang hoạt động</option>
            <option value="pending">Chờ duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>

          <select
            className="mgr-field"
            value={generationFilter}
            onChange={(e) => setGenerationFilter(e.target.value)}
          >
            <option value="">Tất cả đời</option>
            {generationOptions.map((generation) => (
              <option key={generation} value={generation}>
                Đời {generation}
              </option>
            ))}
          </select>
        </div>

        <div className="member-pro-table">
          <div className="member-pro-table-head">
            <span>Thành viên</span>
            <span>Đời / chi</span>
            <span>Trạng thái</span>
            <span>Quê quán</span>
            <span>Thao tác</span>
          </div>

          <div className="member-pro-table-body">
            {loading ? (
              <div className="mgr-empty">Đang tải danh sách thành viên...</div>
            ) : filteredMembers.length ? (
              filteredMembers.map((member) => (
                <div className="member-pro-row" key={member.account_id}>
                  <div className="member-pro-person">
                    <div className="member-pro-avatar">
                      {fullName(member).charAt(0).toUpperCase() || "T"}
                    </div>

                    <div>
                      <strong>{fullName(member)}</strong>
                      <span>{member.email || "Chưa có email"}</span>
                      <small>ID: {member.person_id || member.account_id}</small>
                    </div>
                  </div>

                  <div className="member-pro-meta">
                    <strong>Đời {member.generation || "?"}</strong>
                    <span>Chi {member.branch || "?"}</span>
                  </div>

                  <div className="member-pro-status-stack">
                    <span className={`member-pro-pill ${member.status || "unknown"}`}>
                      {getStatusLabel(member.status)}
                    </span>
                    <span className="member-pro-soft-pill">
                      {getGenderLabel(member.gender)} · {getLivingLabel(member)}
                    </span>
                  </div>

                  <div className="member-pro-hometown">
                    {member.hometown || "Chưa có quê quán"}
                  </div>

                  <div className="member-pro-actions">
                    <button
                      className="mgr-btnGhost"
                      type="button"
                      onClick={() => openEdit(member.account_id)}
                    >
                      Sửa
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="mgr-empty">Không có thành viên phù hợp.</div>
            )}
          </div>
        </div>
      </div>

      {editAccountId && (
        <div
          className="mgr-modalOverlay"
          role="presentation"
          onClick={() => !saving && setEditAccountId(null)}
        >
          <div
            className="mgr-modal member-pro-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="mgr-modalClose"
              type="button"
              onClick={() => setEditAccountId(null)}
              disabled={saving}
            >
              ×
            </button>

            <h2 className="mgr-modalTitle">Chỉnh sửa thành viên #{editAccountId}</h2>
            <p className="mgr-modalMeta">Cập nhật tài khoản, hồ sơ cá nhân và thông tin phả hệ.</p>

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

              <div className="mgr-dateField">
                <DateInput className="mgr-field" name="birth_date" value={editForm.birth_date} onChange={updateEditField} />
                <LunarDateHint value={editForm.birth_date} label="Ngày sinh âm lịch" />
              </div>

              <div className="mgr-dateField">
                <DateInput className="mgr-field" name="death_date" value={editForm.death_date} onChange={updateEditField} disabled={editForm.is_living === "1"} />
                <LunarDateHint value={editForm.death_date} label="Ngày mất âm lịch" />
              </div>

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
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
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