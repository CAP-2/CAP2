import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAdminClanTasks, getAdminClans, getAdminMembers } from "../../api/adminService";
import { assignTaskAPI, getMembers, getTasksAPI } from "../../api/managerService";
import { getMemberTasks, updateMemberTaskStatus } from "../../api/memberService";
import "./TaskManagementPage.css";

const STATUS_LABELS = {
  assigned: "Đã giao",
  in_progress: "Đang làm",
  completed: "Hoàn thành",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function fullName(item) {
  return (
    item?.member_name ||
    item?.display_name ||
    [item?.surname, item?.middle_name, item?.first_name].filter(Boolean).join(" ").trim() ||
    item?.account_email ||
    item?.email ||
    "Chưa có tên"
  );
}

function formatDate(value, withTime = false) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return withTime ? date.toLocaleString("vi-VN") : date.toLocaleDateString("vi-VN");
}

function summarizeTasks(tasks) {
  return {
    total: tasks.length,
    open: tasks.filter((task) => task.status !== "completed").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
  };
}

function MemberCombobox({ members, value, onChange, disabled = false }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedIds = useMemo(() => new Set(value.map((id) => String(id))), [value]);
  const selectedMembers = useMemo(
    () => members.filter((member) => selectedIds.has(String(member.account_id))),
    [members, selectedIds]
  );
  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => `${fullName(member)} ${member.account_id}`.toLowerCase().includes(q));
  }, [members, search]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const toggleMember = (accountId) => {
    const id = String(accountId);
    const next = selectedIds.has(id)
      ? value.filter((item) => String(item) !== id)
      : [...value, id];
    onChange(next);
  };

  const selectFiltered = () => {
    const next = new Set(value.map((id) => String(id)));
    filteredMembers.forEach((member) => next.add(String(member.account_id)));
    onChange([...next]);
  };

  return (
    <div className="task-combobox" ref={rootRef}>
      <button
        type="button"
        className="task-combobox-button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selectedMembers.length ? `${selectedMembers.length} người đã chọn` : "Chọn người thực hiện"}</span>
        <span className="material-symbols-outlined">expand_more</span>
      </button>

      {open && (
        <div className="task-combobox-menu">
          <input
            className="task-combobox-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc ID"
            autoFocus
          />
          <div className="task-combobox-tools">
            <button type="button" onClick={selectFiltered} disabled={!filteredMembers.length}>
              Chọn danh sách đang lọc
            </button>
            <button type="button" onClick={() => onChange([])} disabled={!value.length}>
              Bỏ chọn
            </button>
          </div>
          <div className="task-combobox-list" role="listbox" aria-multiselectable="true">
            {filteredMembers.map((member) => {
              const id = String(member.account_id);
              return (
                <label className="task-combobox-option" key={id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(id)}
                    onChange={() => toggleMember(id)}
                  />
                  <span>{fullName(member)}</span>
                  <small>#{member.account_id}</small>
                </label>
              );
            })}
            {!filteredMembers.length && <div className="task-combobox-empty">Không tìm thấy thành viên.</div>}
          </div>
        </div>
      )}

      <div className="task-selected">
        {selectedMembers.map((member) => (
          <span key={member.account_id}>
            {fullName(member)}
            <button type="button" onClick={() => toggleMember(member.account_id)} aria-label={`Bỏ chọn ${fullName(member)}`}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </span>
        ))}
        {!selectedMembers.length && <small>Có thể tick nhiều thành viên trong combobox.</small>}
      </div>
    </div>
  );
}

export default function TaskManagementPage({ role = "member" }) {
  const { clanId } = useParams();
  const navigate = useNavigate();
  const [clans, setClans] = useState([]);
  const [clan, setClan] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    member_ids: [],
    title: "",
    description: "",
    due_date: "",
  });

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isMember = role === "member";
  const canAssign = isManager || (isAdmin && clanId);
  const stats = useMemo(() => summarizeTasks(tasks), [tasks]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin && !clanId) {
        const data = await getAdminClans();
        setClans(asArray(data.clans));
        setTasks([]);
        setMembers([]);
        setClan(null);
        return;
      }

      if (isMember) {
        const data = await getMemberTasks();
        setTasks(asArray(data.tasks));
        setMembers([]);
        setClan(null);
        return;
      }

      if (isAdmin && clanId) {
        const [taskData, memberData] = await Promise.all([
          getAdminClanTasks(clanId),
          getAdminMembers(),
        ]);
        setClan(taskData.clan || null);
        setTasks(asArray(taskData.tasks));
        setMembers(
          asArray(memberData.members).filter(
            (member) =>
              Number(member.clan_id) === Number(clanId) &&
              Number(member.account_id) > 0 &&
              Number(member.role_id) === 3 &&
              member.account_status === "active"
          )
        );
        return;
      }

      const [taskRows, memberRows] = await Promise.all([getTasksAPI(), getMembers()]);
      setTasks(asArray(taskRows));
      setMembers(
        asArray(memberRows).filter(
          (member) =>
            Number(member.account_id) > 0 &&
            Number(member.role_id) === 3 &&
            (member.status || member.account_status || "active") === "active"
        )
      );
      setClan(null);
    } catch (err) {
      setError(err?.message || "Không tải được dữ liệu công việc");
    } finally {
      setLoading(false);
    }
  }, [clanId, isAdmin, isMember]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitTask = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const memberIds = form.member_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    if (!memberIds.length) {
      setError("Vui lòng chọn ít nhất một thành viên.");
      return;
    }
    if (!form.title.trim()) {
      setError("Vui lòng nhập tiêu đề công việc.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        member_ids: memberIds,
        ...(isAdmin && clanId ? { clan_id: Number(clanId) } : {}),
      };
      const result = await assignTaskAPI(payload);
      setMessage(`Đã giao việc cho ${result.assigned_count || memberIds.length} thành viên.`);
      setForm({ member_ids: [], title: "", description: "", due_date: "" });
      await loadData();
    } catch (err) {
      setError(err?.message || "Không thể giao công việc.");
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    setSavingTaskId(taskId);
    setError("");
    setMessage("");
    try {
      await updateMemberTaskStatus(taskId, status);
      setMessage(status === "completed" ? "Đã đánh dấu hoàn thành." : "Đã cập nhật trạng thái.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Không thể cập nhật trạng thái công việc.");
    } finally {
      setSavingTaskId(null);
    }
  };

  if (loading) {
    return (
      <section className="task-page">
        <div className="task-card task-empty">Đang tải dữ liệu công việc...</div>
      </section>
    );
  }

  if (isAdmin && !clanId) {
    return (
      <section className="task-page">
        <header className="task-header">
          <div>
            <span className="task-kicker">Admin</span>
            <h1>Phân công công việc theo dòng họ</h1>
            <p>Chọn một cây gia phả để xem danh sách công việc và phân công trong phạm vi cây đó.</p>
          </div>
        </header>

        {error && <div className="task-alert is-error">{error}</div>}

        <div className="task-clan-grid">
          {clans.map((item) => (
            <button
              key={item.id}
              type="button"
              className="task-clan-card"
              onClick={() => navigate(`/dashboard/tasks/clan/${item.id}`)}
            >
              <span className="material-symbols-outlined">account_tree</span>
              <strong>{item.clan_name}</strong>
              <small>{item.owner_name || "Chưa có manager"}</small>
              <div className="task-clan-metrics">
                <span>{Number(item.open_task_count || 0)} đang mở</span>
                <span>{Number(item.completed_task_count || 0)} hoàn thành</span>
                <span>{Number(item.task_count || 0)} tổng việc</span>
              </div>
            </button>
          ))}
        </div>

        {!clans.length && <div className="task-card task-empty">Chưa có dòng họ nào.</div>}
      </section>
    );
  }

  return (
    <section className="task-page">
      <header className="task-header">
        <div>
          <span className="task-kicker">
            {isAdmin ? "Admin" : isManager ? "Manager" : "Member"}
          </span>
          <h1>
            {isAdmin
              ? `Công việc dòng họ ${clan?.clan_name || `#${clanId}`}`
              : isManager
                ? "Phân công công việc dòng họ"
                : "Công việc được giao"}
          </h1>
          <p>
            {isMember
              ? "Bạn chỉ xem được các công việc được giao cho tài khoản của mình."
              : "Danh sách này chỉ hiển thị công việc trong phạm vi cây gia phả đang quản lý."}
          </p>
        </div>
        {isAdmin && (
          <Link className="task-btn task-btn-ghost" to="/dashboard/tasks">
            <span className="material-symbols-outlined">arrow_back</span>
            Tất cả dòng họ
          </Link>
        )}
      </header>

      {message && <div className="task-alert is-success">{message}</div>}
      {error && <div className="task-alert is-error">{error}</div>}

      <div className="task-stats">
        <div className="task-stat">
          <span className="material-symbols-outlined">assignment</span>
          <strong>{stats.total}</strong>
          <small>Tổng việc</small>
        </div>
        <div className="task-stat">
          <span className="material-symbols-outlined">pending_actions</span>
          <strong>{stats.open}</strong>
          <small>Đang mở</small>
        </div>
        <div className="task-stat">
          <span className="material-symbols-outlined">sync</span>
          <strong>{stats.inProgress}</strong>
          <small>Đang làm</small>
        </div>
        <div className="task-stat">
          <span className="material-symbols-outlined">task_alt</span>
          <strong>{stats.completed}</strong>
          <small>Hoàn thành</small>
        </div>
      </div>
      {isMember && <div className="task-scope-note">Thống kê chỉ tính công việc được giao cho tài khoản của bạn.</div>}

      <div className={canAssign ? "task-layout" : "task-layout single"}>
        {canAssign && (
          <form className="task-card task-form" onSubmit={submitTask}>
            <div className="task-card-title">
              <span className="material-symbols-outlined">assignment_add</span>
              <h2>Giao việc mới</h2>
            </div>
            <div className="task-field">
              <span>Người thực hiện</span>
              <MemberCombobox
                members={members}
                value={form.member_ids}
                disabled={saving || !members.length}
                onChange={(memberIds) => setForm((prev) => ({ ...prev, member_ids: memberIds }))}
              />
            </div>
            <label>
              <span>Tiêu đề</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ví dụ: Chuẩn bị lễ giỗ tổ"
              />
            </label>
            <label>
              <span>Mô tả</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                placeholder="Nội dung cần thực hiện"
              />
            </label>
            <label>
              <span>Hạn chót</span>
              <input
                type="date"
                value={form.due_date}
                onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
              />
            </label>
            <button className="task-btn task-btn-primary" type="submit" disabled={saving || !members.length}>
              <span className="material-symbols-outlined">send</span>
              {saving ? "Đang giao..." : "Giao việc"}
            </button>
            {!members.length && <p className="task-note">Chưa có member active để giao việc trong dòng họ này.</p>}
          </form>
        )}

        <div className="task-card">
          <div className="task-card-title">
            <span className="material-symbols-outlined">view_list</span>
            <h2>{isMember ? "Danh sách việc của tôi" : "Lịch sử phân công"}</h2>
          </div>

          <div className="task-list">
            {tasks.map((task) => (
              <article className="task-item" key={task.id}>
                <div className="task-item-main">
                  <div className="task-item-head">
                    <h3>{task.title}</h3>
                    <span className={`task-status status-${task.status}`}>
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  </div>
                  {task.description && <p>{task.description}</p>}
                  <div className="task-meta">
                    {!isMember && <span>Người nhận: {fullName(task)}</span>}
                    <span>Người giao: {task.manager_name || "Manager"}</span>
                    <span>Hạn: {formatDate(task.due_date)}</span>
                    <span>Giao lúc: {formatDate(task.assigned_at || task.created_at, true)}</span>
                    {task.completed_at && <span>Hoàn thành: {formatDate(task.completed_at, true)}</span>}
                  </div>
                </div>

                {isMember && task.status !== "completed" && (
                  <div className="task-actions">
                    <button
                      className="task-btn task-btn-ghost"
                      type="button"
                      disabled={savingTaskId === task.id || task.status === "in_progress"}
                      onClick={() => updateTaskStatus(task.id, "in_progress")}
                    >
                      Đang làm
                    </button>
                    <button
                      className="task-btn task-btn-primary"
                      type="button"
                      disabled={savingTaskId === task.id}
                      onClick={() => updateTaskStatus(task.id, "completed")}
                    >
                      Hoàn thành
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!tasks.length && <div className="task-empty">Chưa có công việc nào.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
