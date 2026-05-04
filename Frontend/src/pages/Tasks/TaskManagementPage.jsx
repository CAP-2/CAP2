import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAdminClanTasks, getAdminClans, getAdminMembers } from "../../api/adminService";
import {
  assignTaskAPI,
  createManagerEventAPI,
  deleteManagerEventAPI,
  getManagerEventsAPI,
  getMembers,
  getTasksAPI,
  updateManagerEventAPI,
} from "../../api/managerService";
import { getMemberTasks, updateMemberTaskStatus } from "../../api/memberService";
import { generateEventFormAI } from "../../api/aiServerService";
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

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function summarizeTasks(tasks) {
  return {
    total: tasks.length,
    open: tasks.filter((task) => task.status !== "completed").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
  };
}

function summarizeEvents(events) {
  return {
    total: events.length,
    active: events.filter((event) => Number(event.assignment_count || 0) > Number(event.completed_assignment_count || 0)).length,
    done: events.filter((event) => Number(event.assignment_count || 0) > 0 && Number(event.assignment_count || 0) === Number(event.completed_assignment_count || 0)).length,
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
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const toggleMember = (accountId) => {
    const id = String(accountId);
    const next = selectedIds.has(id) ? value.filter((item) => String(item) !== id) : [...value, id];
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
                  <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleMember(id)} />
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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ event_id: "", member_ids: [], title: "", description: "", due_date: "" });
  const [eventForm, setEventForm] = useState({ title: "", event_date: "", description: "" });
  const [editEventForm, setEditEventForm] = useState({ title: "", event_date: "", description: "" });
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTaskSuggestions, setAiTaskSuggestions] = useState([]);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isMember = role === "member";
  const canAssign = isManager || (isAdmin && clanId);
  const stats = useMemo(() => summarizeTasks(tasks), [tasks]);
  const eventStats = useMemo(() => summarizeEvents(events), [events]);

  const selectedEvent = useMemo(
    () => events.find((item) => String(item.id) === String(selectedEventId)) || null,
    [events, selectedEventId]
  );

  const selectedTasks = useMemo(() => {
    if (!selectedEventId) return tasks;
    return tasks.filter((task) => String(task.event_id || "") === String(selectedEventId));
  }, [tasks, selectedEventId]);

  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) => `${event.title || ""} ${event.description || ""} ${event.clan_name || ""}`.toLowerCase().includes(q));
  }, [events, searchTerm]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin && !clanId) {
        const data = await getAdminClans();
        setClans(asArray(data.clans));
        setTasks([]);
        setEvents([]);
        setMembers([]);
        setClan(null);
        return;
      }

      if (isMember) {
        const data = await getMemberTasks();
        setTasks(asArray(data.tasks));
        setEvents([]);
        setMembers([]);
        setClan(null);
        return;
      }

      if (isAdmin && clanId) {
        const [taskData, memberData, eventData] = await Promise.all([
          getAdminClanTasks(clanId),
          getAdminMembers(),
          getManagerEventsAPI({ clan_id: clanId }),
        ]);
        setClan(taskData.clan || null);
        setTasks(asArray(taskData.tasks));
        setEvents(asArray(eventData.events));
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

      const [taskRows, memberRows, eventData] = await Promise.all([getTasksAPI(), getMembers(), getManagerEventsAPI()]);
      setTasks(asArray(taskRows));
      setEvents(asArray(eventData.events));
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

  useEffect(() => {
    if (!canAssign || !selectedEventId) return;
    const stillExists = events.some((event) => String(event.id) === String(selectedEventId));
    if (!stillExists) setSelectedEventId("");
  }, [canAssign, events, selectedEventId]);

  useEffect(() => {
    if (!selectedEvent) {
      setEditEventForm({ title: "", event_date: "", description: "" });
      setForm((prev) => ({ ...prev, event_id: "" }));
      return;
    }
    setEditEventForm({
      title: selectedEvent.title || "",
      event_date: toDateInput(selectedEvent.event_date),
      description: selectedEvent.description || "",
    });
    setForm((prev) => ({ ...prev, event_id: String(selectedEvent.id) }));
  }, [selectedEvent]);

  const submitTask = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const memberIds = form.member_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    if (!selectedEventId) {
      setError("Vui lòng chọn sự kiện trước khi giao việc.");
      return;
    }
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
        event_id: Number(selectedEventId),
        member_ids: memberIds,
        ...(isAdmin && clanId ? { clan_id: Number(clanId) } : {}),
      };
      const result = await assignTaskAPI(payload);
      setMessage(`Đã giao việc cho ${result.assigned_count || memberIds.length} thành viên.`);
      setForm({ event_id: String(selectedEventId), member_ids: [], title: "", description: "", due_date: "" });
      await loadData();
    } catch (err) {
      setError(err?.message || "Không thể giao công việc.");
    } finally {
      setSaving(false);
    }
  };

  const submitEvent = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!eventForm.title.trim()) {
      setError("Vui lòng nhập tên sự kiện.");
      return;
    }
    setSaving(true);
    try {
      const result = await createManagerEventAPI({
        title: eventForm.title.trim(),
        event_date: eventForm.event_date || null,
        description: eventForm.description.trim(),
        ...(isAdmin && clanId ? { clan_id: Number(clanId) } : {}),
      });
      const createdEventId = result?.event_id ? String(result.event_id) : "";
      setMessage("Đã tạo sự kiện mới. Đang mở chi tiết để chỉnh sửa và giao việc.");
      setEventForm({ title: "", event_date: "", description: "" });
      setShowCreateForm(false);
      await loadData();
      if (createdEventId) {
        setSelectedEventId(createdEventId);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      setError(err?.message || "Không thể tạo sự kiện.");
    } finally {
      setSaving(false);
    }
  };

  const saveEvent = async (event) => {
    event.preventDefault();
    if (!selectedEvent) return;
    setError("");
    setMessage("");
    if (!editEventForm.title.trim()) {
      setError("Tên sự kiện không được để trống.");
      return;
    }
    setSaving(true);
    try {
      await updateManagerEventAPI(selectedEvent.id, {
        title: editEventForm.title.trim(),
        event_date: editEventForm.event_date || null,
        description: editEventForm.description.trim(),
        ...(isAdmin && clanId ? { clan_id: Number(clanId) } : {}),
      });
      setMessage("Đã cập nhật sự kiện.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Không thể cập nhật sự kiện.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!selectedEvent) return;
    const ok = window.confirm(`Xóa sự kiện "${selectedEvent.title}"? Các công việc đã giao sẽ được giữ lại nhưng không còn gắn với sự kiện này.`);
    if (!ok) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await deleteManagerEventAPI(selectedEvent.id, isAdmin && clanId ? { clan_id: Number(clanId) } : {});
      setMessage("Đã xóa sự kiện.");
      setSelectedEventId("");
      await loadData();
    } catch (err) {
      setError(err?.message || "Không thể xóa sự kiện.");
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

  const getTodayInput = () => new Date().toISOString().slice(0, 10);

  const normalizeAiTasks = (items = [], fallbackEventId = null) =>
    asArray(items)
      .map((item, index) => ({
        id: `ai-${Date.now()}-${index}`,
        event_id: item.event_id || fallbackEventId || null,
        member_id: null,
        title: String(item.title || "").trim(),
        description: String(item.description || "").trim(),
        due_date: item.due_date || "",
        status: item.status || "assigned",
      }))
      .filter((item) => item.title);

  const requestAiEventCreate = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiLoading) return;
    setError("");
    setMessage("");
    setAiLoading(true);
    try {
      const result = await generateEventFormAI({
        mode: "event_create",
        prompt,
        today: getTodayInput(),
        clan_id: isAdmin && clanId ? Number(clanId) : undefined,
        current_event: null,
        existing_tasks: [],
      });

      if (result.status !== "success") {
        setError("AI chỉ hỗ trợ tạo sự kiện và công việc dòng họ. Vui lòng nhập nội dung liên quan đến sự kiện.");
        return;
      }

      const aiEvent = result.event || {};
      setEventForm({
        title: aiEvent.title || "",
        event_date: aiEvent.event_date || "",
        description: aiEvent.description || "",
      });
      setAiTaskSuggestions(normalizeAiTasks(result.manager_tasks));
      setShowCreateForm(true);
      setMessage("AI đã điền form sự kiện và tạo danh sách công việc gợi ý. Hãy kiểm tra trước khi lưu.");
    } catch (err) {
      setError(err?.message || "Không thể gọi AI tạo sự kiện.");
    } finally {
      setAiLoading(false);
    }
  };

  const requestAiTaskCreate = async () => {
    if (!selectedEvent || aiLoading) return;
    const prompt = aiPrompt.trim() || "Gợi ý thêm các công việc còn thiếu cho sự kiện này";
    setError("");
    setMessage("");
    setAiLoading(true);
    try {
      const result = await generateEventFormAI({
        mode: "task_create",
        prompt,
        today: getTodayInput(),
        clan_id: selectedEvent.clan_id || (isAdmin && clanId ? Number(clanId) : undefined),
        current_event: {
          id: selectedEvent.id,
          title: selectedEvent.title,
          event_date: toDateInput(selectedEvent.event_date),
          description: selectedEvent.description || "",
          clan_id: selectedEvent.clan_id || (isAdmin && clanId ? Number(clanId) : undefined),
        },
        existing_tasks: selectedTasks.map((task) => ({
          id: task.task_id || task.id,
          event_id: task.event_id || selectedEvent.id,
          title: task.title,
          description: task.description,
          due_date: toDateInput(task.due_date),
          status: task.status,
        })),
      });

      if (result.status !== "success") {
        setError("AI chỉ hỗ trợ gợi ý công việc liên quan đến sự kiện đang chọn.");
        return;
      }

      setAiTaskSuggestions(normalizeAiTasks(result.manager_tasks, selectedEvent.id));
      setMessage("AI đã tạo danh sách công việc gợi ý. Chọn một công việc để đưa vào form giao việc.");
    } catch (err) {
      setError(err?.message || "Không thể gọi AI tạo công việc.");
    } finally {
      setAiLoading(false);
    }
  };

  const useAiTaskSuggestion = (task) => {
    setForm((prev) => ({
      ...prev,
      event_id: String(selectedEventId || task.event_id || ""),
      title: task.title || "",
      description: task.description || "",
      due_date: task.due_date || "",
    }));
    setMessage("Đã đưa công việc AI gợi ý vào form. Hãy chọn người thực hiện rồi bấm Giao việc.");
  };

  const openEvent = (eventId) => {
    setSelectedEventId(String(eventId));
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        <header className="task-hero task-hero-wide">
          <div>
            <span className="task-kicker">Admin</span>
            <h1>Phân công công việc theo dòng họ</h1>
            <p>Chọn một cây gia phả để xem danh sách sự kiện, chỉnh sửa và phân công trong phạm vi cây đó.</p>
          </div>
        </header>
        {error && <div className="task-alert is-error">{error}</div>}
        <div className="task-clan-grid">
          {clans.map((item) => (
            <button key={item.id} type="button" className="task-clan-card" onClick={() => navigate(`/dashboard/tasks/clan/${item.id}`)}>
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

  if (isMember) {
    return (
      <section className="task-page">
        <header className="task-hero task-hero-wide">
          <div>
            <span className="task-kicker">Member</span>
            <h1>Công việc được giao</h1>
            <p>Bạn chỉ xem được các công việc được giao cho tài khoản của mình.</p>
          </div>
        </header>
        {message && <div className="task-alert is-success">{message}</div>}
        {error && <div className="task-alert is-error">{error}</div>}
        <div className="task-stats">
          <div className="task-stat"><span className="material-symbols-outlined">assignment</span><strong>{stats.total}</strong><small>Tổng việc</small></div>
          <div className="task-stat"><span className="material-symbols-outlined">pending_actions</span><strong>{stats.open}</strong><small>Đang mở</small></div>
          <div className="task-stat"><span className="material-symbols-outlined">sync</span><strong>{stats.inProgress}</strong><small>Đang làm</small></div>
          <div className="task-stat"><span className="material-symbols-outlined">task_alt</span><strong>{stats.completed}</strong><small>Hoàn thành</small></div>
        </div>
        <TaskList tasks={tasks} isMember savingTaskId={savingTaskId} onUpdateStatus={updateTaskStatus} />
      </section>
    );
  }

  if (selectedEvent) {
    return (
      <section className="task-page task-page-manager">
        <header className="task-hero task-hero-wide manager-hero">
          <div>
            <span className="task-kicker">{isAdmin ? "Admin" : "Manager"}</span>
            <h1>{selectedEvent.title}</h1>
            <p>{formatDate(selectedEvent.event_date)} • {selectedTasks.length} công việc trong sự kiện • Manager chỉ quản lý dữ liệu thuộc dòng họ của mình.</p>
          </div>
          <div className="task-hero-actions">
            <button className="task-btn task-btn-ghost" type="button" onClick={() => setSelectedEventId("")}> 
              <span className="material-symbols-outlined">arrow_back</span>
              Danh sách sự kiện
            </button>
            {isAdmin && (
              <Link className="task-btn task-btn-ghost" to="/dashboard/tasks">
                <span className="material-symbols-outlined">account_tree</span>
                Dòng họ
              </Link>
            )}
          </div>
        </header>

        {message && <div className="task-alert is-success">{message}</div>}
        {error && <div className="task-alert is-error">{error}</div>}

        <section className="task-card ai-event-card">
          <div className="task-card-title">
            <span className="material-symbols-outlined">auto_awesome</span>
            <h2>AI gợi ý công việc cho sự kiện</h2>
          </div>
          <div className="ai-event-row">
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              rows={3}
              placeholder="Ví dụ: Gợi ý thêm 5 việc còn thiếu cho giỗ tổ này"
              disabled={aiLoading}
            />
            <button className="task-btn task-btn-primary" type="button" onClick={requestAiTaskCreate} disabled={aiLoading}>
              <span className="material-symbols-outlined">auto_awesome</span>
              {aiLoading ? "AI đang tạo..." : "Tạo công việc bằng AI"}
            </button>
          </div>
          {!!aiTaskSuggestions.length && (
            <div className="ai-suggestion-list">
              {aiTaskSuggestions.map((task) => (
                <article className="ai-suggestion-item" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    {task.description && <p>{task.description}</p>}
                    <small>Hạn chót: {task.due_date ? formatDate(task.due_date) : "Chưa có"}</small>
                  </div>
                  <button className="task-btn task-btn-ghost" type="button" onClick={() => useAiTaskSuggestion(task)}>
                    Đưa vào form
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="event-detail-layout">
          <form className="task-card task-form event-edit-card" onSubmit={saveEvent}>
            <div className="task-card-title">
              <span className="material-symbols-outlined">edit_calendar</span>
              <h2>Sửa sự kiện</h2>
            </div>
            <label>
              <span>Tên sự kiện</span>
              <input value={editEventForm.title} onChange={(event) => setEditEventForm((prev) => ({ ...prev, title: event.target.value }))} />
            </label>
            <label>
              <span>Ngày sự kiện</span>
              <input type="date" value={editEventForm.event_date} onChange={(event) => setEditEventForm((prev) => ({ ...prev, event_date: event.target.value }))} />
            </label>
            <label>
              <span>Mô tả</span>
              <textarea value={editEventForm.description} onChange={(event) => setEditEventForm((prev) => ({ ...prev, description: event.target.value }))} rows={5} placeholder="Mô tả sự kiện" />
            </label>
            <div className="task-form-actions">
              <button className="task-btn task-btn-primary" type="submit" disabled={saving}>
                <span className="material-symbols-outlined">save</span>
                Lưu thay đổi
              </button>
              <button className="task-btn task-btn-danger" type="button" onClick={deleteEvent} disabled={saving}>
                <span className="material-symbols-outlined">delete</span>
                Xóa sự kiện
              </button>
            </div>
          </form>

          <form className="task-card task-form event-assign-card" onSubmit={submitTask}>
            <div className="task-card-title">
              <span className="material-symbols-outlined">assignment_add</span>
              <h2>Giao công việc</h2>
            </div>
            <div className="selected-event-banner">
              <span className="material-symbols-outlined">event</span>
              <div>
                <strong>{selectedEvent.title}</strong>
                <small>Công việc tạo tại đây tự động gắn vào sự kiện này.</small>
              </div>
            </div>
            <div className="task-field">
              <span>Người thực hiện</span>
              <MemberCombobox members={members} value={form.member_ids} disabled={saving || !members.length} onChange={(memberIds) => setForm((prev) => ({ ...prev, member_ids: memberIds }))} />
            </div>
            <label>
              <span>Tiêu đề công việc</span>
              <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Ví dụ: Chuẩn bị mâm cúng" />
            </label>
            <label>
              <span>Mô tả công việc</span>
              <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} placeholder="Nội dung cần thực hiện" />
            </label>
            <label>
              <span>Hạn chót</span>
              <input type="date" value={form.due_date} onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))} />
            </label>
            <button className="task-btn task-btn-primary" type="submit" disabled={saving || !members.length}>
              <span className="material-symbols-outlined">send</span>
              {saving ? "Đang lưu..." : "Giao việc"}
            </button>
            {!members.length && <p className="task-note">Chưa có member active để giao việc trong dòng họ này.</p>}
          </form>
        </div>

        <TaskList title="Công việc trong sự kiện" tasks={selectedTasks} />
      </section>
    );
  }

  return (
    <section className="task-page task-page-manager">
      <header className="task-hero task-hero-wide manager-hero">
        <div>
          <span className="task-kicker">{isAdmin ? "Admin" : "Manager"}</span>
          <h1>{isAdmin ? `Phân công công việc dòng họ ${clan?.clan_name || `#${clanId}`}` : "Phân công công việc dòng họ"}</h1>
          <p>{isAdmin ? "Chọn sự kiện của dòng họ này để chỉnh sửa và phân công." : "Danh sách chỉ hiển thị các sự kiện trong dòng họ bạn đang quản lý."}</p>
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

      <div className="event-toolbar">
        <div className="event-search event-search-wide">
          <span className="material-symbols-outlined">search</span>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm sự kiện theo tên hoặc mô tả..." />
        </div>
        <button className="task-btn task-btn-primary" type="button" onClick={() => setShowCreateForm(true)}>
          <span className="material-symbols-outlined">add</span>
          Thêm sự kiện
        </button>
      </div>

      <section className="task-card ai-event-card">
        <div className="task-card-title">
          <span className="material-symbols-outlined">auto_awesome</span>
          <h2>AI tạo sự kiện và công việc</h2>
        </div>
        <div className="ai-event-row">
          <textarea
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            rows={3}
            placeholder="Ví dụ: Tạo sự kiện giỗ tổ ngày 10/11/2025, tụ họp con cháu ở từ đường"
            disabled={aiLoading}
          />
          <button className="task-btn task-btn-primary" type="button" onClick={requestAiEventCreate} disabled={aiLoading || !aiPrompt.trim()}>
            <span className="material-symbols-outlined">auto_awesome</span>
            {aiLoading ? "AI đang tạo..." : "AI điền form"}
          </button>
        </div>
        {!!aiTaskSuggestions.length && (
          <div className="ai-suggestion-list">
            {aiTaskSuggestions.map((task) => (
              <article className="ai-suggestion-item" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  {task.description && <p>{task.description}</p>}
                  <small>Hạn chót: {task.due_date ? formatDate(task.due_date) : "Chưa có"}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showCreateForm && (
        <div className="task-modal-backdrop" role="presentation" onMouseDown={() => setShowCreateForm(false)}>
          <form
            className="task-modal-card quick-event-form"
            onSubmit={submitEvent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-event-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="task-modal-head">
              <div className="task-card-title">
                <span className="material-symbols-outlined">event_upcoming</span>
                <div>
                  <h2 id="create-event-title">Tạo sự kiện mới</h2>
                  <p>Điền thông tin sự kiện của dòng họ, sau đó mở sự kiện để chia công việc.</p>
                </div>
              </div>
              <button className="task-icon-btn" type="button" onClick={() => setShowCreateForm(false)} aria-label="Đóng bảng thêm sự kiện">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <label>
              <span>Tên sự kiện</span>
              <input
                value={eventForm.title}
                onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ví dụ: Giỗ tổ, Đám đình, Họp mặt cuối năm"
                autoFocus
              />
            </label>
            <label>
              <span>Ngày sự kiện</span>
              <input type="date" value={eventForm.event_date} onChange={(event) => setEventForm((prev) => ({ ...prev, event_date: event.target.value }))} />
            </label>
            <label>
              <span>Mô tả ngắn</span>
              <textarea value={eventForm.description} onChange={(event) => setEventForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} placeholder="Ghi chú địa điểm, nội dung chính hoặc yêu cầu chuẩn bị..." />
            </label>

            {!!aiTaskSuggestions.length && (
              <div className="ai-modal-suggestions">
                <strong>Công việc AI đề xuất</strong>
                <p>Sau khi lưu sự kiện, mở sự kiện để chọn người thực hiện và giao các công việc này.</p>
                <div className="ai-suggestion-list">
                  {aiTaskSuggestions.map((task) => (
                    <article className="ai-suggestion-item" key={task.id}>
                      <div>
                        <strong>{task.title}</strong>
                        {task.description && <p>{task.description}</p>}
                        <small>Hạn chót: {task.due_date ? formatDate(task.due_date) : "Chưa có"}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div className="task-form-actions task-modal-actions">
              <button className="task-btn task-btn-primary" type="submit" disabled={saving}>
                <span className="material-symbols-outlined">add</span>
                {saving ? "Đang lưu..." : "Lưu sự kiện"}
              </button>
              <button className="task-btn task-btn-ghost" type="button" onClick={() => setShowCreateForm(false)}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="manager-event-grid">
        {filteredEvents.map((event) => {
          const assignmentCount = Number(event.assignment_count || 0);
          const completedCount = Number(event.completed_assignment_count || 0);
          const openCount = Math.max(assignmentCount - completedCount, 0);
          return (
            <button key={event.id} type="button" className="manager-event-card" onClick={() => openEvent(event.id)}>
              <span className="manager-event-icon material-symbols-outlined">account_tree</span>
              <strong>{event.title}</strong>
              <small>{formatDate(event.event_date)}</small>
              {event.description && <p>{event.description}</p>}
              <div className="manager-event-metrics">
                <span>{openCount} đang mở</span>
                <span>{completedCount} hoàn thành</span>
                <span>{Number(event.task_count || 0)} tổng việc</span>
              </div>
            </button>
          );
        })}
      </div>

      {!filteredEvents.length && (
        <div className="task-card task-empty">
          {events.length ? "Không tìm thấy sự kiện phù hợp." : "Dòng họ này chưa có sự kiện. Bấm Thêm sự kiện để tạo mới."}
        </div>
      )}
    </section>
  );
}

function TaskList({ title = "Lịch sử phân công", tasks, isMember = false, savingTaskId = null, onUpdateStatus = () => {} }) {
  return (
    <div className="task-card task-history-card">
      <div className="task-card-title">
        <span className="material-symbols-outlined">view_list</span>
        <h2>{title}</h2>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <article className="task-item" key={task.id}>
            <div className="task-item-main">
              <div className="task-item-head">
                <h3>{task.title}</h3>
                <span className={`task-status status-${task.status}`}>{STATUS_LABELS[task.status] || task.status}</span>
              </div>
              {task.description && <p>{task.description}</p>}
              <div className="task-meta">
                {!isMember && <span>Người nhận: {fullName(task)}</span>}
                <span>Sự kiện: {task.event_title || "Chưa gắn sự kiện"}</span>
                <span>Người giao: {task.manager_name || "Manager"}</span>
                <span>Hạn: {formatDate(task.due_date)}</span>
                <span>Giao lúc: {formatDate(task.assigned_at || task.created_at, true)}</span>
                {task.completed_at && <span>Hoàn thành: {formatDate(task.completed_at, true)}</span>}
              </div>
            </div>
            {isMember && task.status !== "completed" && (
              <div className="task-actions">
                <button className="task-btn task-btn-ghost" type="button" disabled={savingTaskId === task.id || task.status === "in_progress"} onClick={() => onUpdateStatus(task.id, "in_progress")}>
                  Đang làm
                </button>
                <button className="task-btn task-btn-primary" type="button" disabled={savingTaskId === task.id} onClick={() => onUpdateStatus(task.id, "completed")}>
                  Hoàn thành
                </button>
              </div>
            )}
          </article>
        ))}
        {!tasks.length && <div className="task-empty">Chưa có công việc nào.</div>}
      </div>
    </div>
  );
}
