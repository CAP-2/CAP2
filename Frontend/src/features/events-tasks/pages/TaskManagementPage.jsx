import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getAdminClanTasks, getAdminClans, getAdminMembers } from "../../../api/adminService";
import {
  assignTaskAPI,
  bulkAssignTasksAPI,
  createManagerEventAPI,
  deleteManagerEventAPI,
  getManagerEventsAPI,
  getMembers,
  getTasksAPI,
  updateManagerEventAPI,
} from "../../../api/managerService";
import { getMemberTasks, getMemberEvents, updateMemberTaskStatus } from "../../../api/memberService";
import { generateEventFormAI } from "../../../api/aiServerService";
import { getSocket } from "../../../services/socket";
import DateInput from "../../../shared/components/DateInput";
import { useLanguage } from "../../../i18n/LanguageContext";
import VoiceRecorder from "../../voice/components/VoiceRecorder";
import { formatDateTimeVN, formatDateVN, isoToVietnamDate, vietnamDateToIso } from "../../../shared/utils/dateFormat";
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

function isLivingMember(member) {
  if (!member) return false;

  const livingValue = member.is_living ?? member.isLiving ?? member.living;
  if (livingValue !== undefined && livingValue !== null && livingValue !== "") {
    const normalized = String(livingValue).trim().toLowerCase();
    if (["0", "false", "dead", "deceased", "lost", "mất", "da mat", "đã mất"].includes(normalized)) {
      return false;
    }
  }

  if (member.death_date || member.deathDate || member.date_of_death) {
    return false;
  }

  const statusText = String(member.life_status || member.lifeStatus || member.member_status || "").trim().toLowerCase();
  if (statusText && ["dead", "deceased", "lost", "mất", "da mat", "đã mất"].includes(statusText)) {
    return false;
  }

  return true;
}

function isAssignableMember(member) {
  return (
    Number(member?.account_id) > 0 &&
    Number(member?.role_id) === 3 &&
    (member?.status || member?.account_status || "active") === "active" &&
    isLivingMember(member)
  );
}

function formatDate(value, withTime = false) {
  if (!value) return "Chưa có";
  return withTime ? formatDateTimeVN(value) : formatDateVN(value);
}

function toDateInput(value) {
  return isoToVietnamDate(value);
}
function eventStatusLabel(status) {
  if (status === "ongoing") return "Đang diễn ra";
  if (status === "ended") return "Đã kết thúc";
  return "Sắp diễn ra";
}

function eventStatusClass(status) {
  if (status === "ongoing") return "is-ongoing";
  if (status === "ended") return "is-ended";
  return "is-upcoming";
}

function getEventStartDate(event) {
  return event?.start_date || event?.event_date || event?.date || "";
}

function getEventEndDate(event) {
  return event?.end_date || event?.start_date || event?.event_date || event?.date || "";
}

function formatEventRange(event) {
  const start = getEventStartDate(event);
  const end = getEventEndDate(event);
  if (!start && !end) return "Chưa có thời gian";
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} - ${formatDate(end)}`;
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
    active: events.filter((event) => event.status === "ongoing").length,
    done: events.filter((event) => event.status === "ended").length,
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
  const { t, language } = useLanguage();
  const { clanId } = useParams();
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [eventForm, setEventForm] = useState({ title: "", start_date: "", end_date: "", description: "" });
  const [editEventForm, setEditEventForm] = useState({ title: "", start_date: "", end_date: "", description: "" });
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTaskSuggestions, setAiTaskSuggestions] = useState([]);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [showAiEventModal, setShowAiEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const [aiTaskCount, setAiTaskCount] = useState(5);
  const [voiceListening, setVoiceListening] = useState(false);

  const handleAiTaskCountChange = (event) => {
    const value = event.target.value;
    if (value === "") {
      setAiTaskCount("");
      return;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;

    setAiTaskCount(Math.min(Math.max(Math.round(parsed), 1), 20));
  };

  const appendAiPromptText = useCallback((text) => {
    const transcript = String(text || "").trim();
    if (!transcript) return;

    setAiPrompt((current) => {
      const prompt = String(current || "").trim();
      if (!prompt) return transcript;
      const separator = /[.!?…]$/.test(prompt) ? " " : ". ";
      return `${prompt}${separator}${transcript}`;
    });
  }, []);

  const toggleAiPromptVoiceInput = useCallback(() => {
    if (voiceListening) {
      recognitionRef.current?.stop?.();
      setVoiceListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Trình duyệt này chưa hỗ trợ chuyển giọng nói thành văn bản. Vui lòng dùng Chrome hoặc Edge.");
      return;
    }

    recognitionRef.current?.abort?.();

    const recognition = new SpeechRecognition();
    recognition.lang = language === "en" ? "en-US" : "vi-VN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || "")
        .join(" ");
      appendAiPromptText(transcript);
    };

    recognition.onerror = (event) => {
      const errorName = event?.error || "";
      if (errorName === "not-allowed" || errorName === "service-not-allowed") {
        setError("Trình duyệt đang chặn quyền micro. Hãy cấp quyền micro rồi thử lại.");
      } else if (errorName === "no-speech") {
        setError("Chưa nhận được giọng nói. Hãy nói rõ hơn hoặc thử lại.");
      } else {
        setError("Không thể chuyển giọng nói thành văn bản. Vui lòng thử lại.");
      }
    };

    recognition.onend = () => {
      setVoiceListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setError("");
    setVoiceListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceListening(false);
      setError("Không thể chuyển giọng nói thành văn bản. Vui lòng thử lại.");
    }
  }, [appendAiPromptText, language, voiceListening]);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isMember = role === "member";
  const canAssign = isManager || (isAdmin && clanId);
  const stats = useMemo(() => summarizeTasks(tasks), [tasks]);
  const eventStats = useMemo(() => summarizeEvents(events), [events]);
  const speechSupported = useMemo(
    () => typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  const selectedEvent = useMemo(
    () => events.find((item) => String(item.id) === String(selectedEventId)) || null,
    [events, selectedEventId]
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, []);

  const selectedTasks = useMemo(() => {
    if (!selectedEventId) return tasks;
    return tasks.filter((task) => String(task.event_id || "") === String(selectedEventId));
  }, [tasks, selectedEventId]);

  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) => `${event.title || ""} ${event.description || ""} ${event.clan_name || ""}`.toLowerCase().includes(q));
  }, [events, searchTerm]);

  const activeFilteredEvents = useMemo(
    () => filteredEvents.filter((event) => event.status !== "ended"),
    [filteredEvents]
  );

  const archivedEvents = useMemo(
    () => events.filter((event) => event.status === "ended"),
    [events]
  );

  const filteredArchivedEvents = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    if (!q) return archivedEvents;
    return archivedEvents.filter((event) => `${event.title || ""} ${event.description || ""} ${event.clan_name || ""}`.toLowerCase().includes(q));
  }, [archivedEvents, archiveSearch]);

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
        const [taskData, eventData] = await Promise.all([getMemberTasks(), getMemberEvents()]);
        setTasks(asArray(taskData.tasks));
        setEvents(asArray(eventData.events));
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
              isAssignableMember(member)
          )
        );
        return;
      }

      const [taskRows, memberRows, eventData] = await Promise.all([getTasksAPI(), getMembers(), getManagerEventsAPI()]);
      setTasks(asArray(taskRows));
      setEvents(asArray(eventData.events));
      setMembers(
        asArray(memberRows).filter(
          (member) => isAssignableMember(member)
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
    if (!isMember) return;
    const taskId = searchParams.get("taskId");
    if (!taskId || !tasks.length) return;

    const task = tasks.find((t) => String(t.task_id || t.id) === String(taskId));
    if (task && task.event_id) {
      setSelectedEventId(task.event_id);
      searchParams.delete("taskId");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, isMember, tasks, setSearchParams]);

  useEffect(() => {
  let timer = null;
  let cleanup = null;

  const attachSocketListeners = () => {
    const socket = getSocket();

    if (!socket) {
      return false;
    }

    const handleTaskAssigned = (payload) => {
      console.log("Realtime task_assigned received:", payload);
      loadData();
    };

    const handleTaskStatusUpdated = (payload) => {
      console.log("Realtime task_status_updated received:", payload);
      loadData();
    };

    if (isMember) {
      socket.on("task_assigned", handleTaskAssigned);
    }

    if (isManager || isAdmin) {
      socket.on("task_status_updated", handleTaskStatusUpdated);
    }

    cleanup = () => {
      socket.off("task_assigned", handleTaskAssigned);
      socket.off("task_status_updated", handleTaskStatusUpdated);
    };

    return true;
  };

  if (!attachSocketListeners()) {
    timer = window.setInterval(() => {
      if (attachSocketListeners()) {
        window.clearInterval(timer);
      }
    }, 500);
  }

  return () => {
    if (timer) {
      window.clearInterval(timer);
    }

    if (cleanup) {
      cleanup();
    }
  };
}, [loadData, isMember, isManager, isAdmin]);

  useEffect(() => {
    if (!canAssign || !selectedEventId) return;
    const stillExists = events.some((event) => String(event.id) === String(selectedEventId));
    if (!stillExists) setSelectedEventId("");
  }, [canAssign, events, selectedEventId]);

  useEffect(() => {
    if (!selectedEvent) {
      setEditEventForm({ title: "", start_date: "", end_date: "", description: "" });
      setForm((prev) => ({ ...prev, event_id: "" }));
      return;
    }
    setEditEventForm({
      title: selectedEvent.title || "",
      start_date: toDateInput(getEventStartDate(selectedEvent)),
      end_date: toDateInput(getEventEndDate(selectedEvent)),
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
        due_date: vietnamDateToIso(form.due_date) || null,
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
    if (!eventForm.start_date) {
      setError("Vui lòng nhập ngày bắt đầu sự kiện.");
      return;
    }
    if (eventForm.end_date && vietnamDateToIso(eventForm.end_date) < vietnamDateToIso(eventForm.start_date)) {
      setError("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");
      return;
    }
    setSaving(true);
    try {
      const result = await createManagerEventAPI({
        title: eventForm.title.trim(),
        event_date: vietnamDateToIso(eventForm.start_date) || null,
        start_date: vietnamDateToIso(eventForm.start_date) || null,
        end_date: vietnamDateToIso(eventForm.end_date || eventForm.start_date) || null,
        description: eventForm.description.trim(),
        ...(isAdmin && clanId ? { clan_id: Number(clanId) } : {}),
      });
      const createdEventId = result?.event_id ? String(result.event_id) : "";
      setMessage(aiTaskSuggestions.length
        ? "Đã tạo sự kiện mới. Công việc AI đã sẵn sàng trong màn hình chi tiết để chọn người thực hiện."
        : "Đã tạo sự kiện mới. Đang mở chi tiết để chỉnh sửa và giao việc.");
      if (createdEventId) {
        setAiTaskSuggestions((prev) => prev.map((task) => ({ ...task, event_id: createdEventId })));
      }
      setEventForm({ title: "", start_date: "", end_date: "", description: "" });
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
    if (!editEventForm.start_date) {
      setError("Vui lòng nhập ngày bắt đầu sự kiện.");
      return;
    }
    if (editEventForm.end_date && vietnamDateToIso(editEventForm.end_date) < vietnamDateToIso(editEventForm.start_date)) {
      setError("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");
      return;
    }
    setSaving(true);
    try {
      await updateManagerEventAPI(selectedEvent.id, {
        title: editEventForm.title.trim(),
        event_date: vietnamDateToIso(editEventForm.start_date) || null,
        start_date: vietnamDateToIso(editEventForm.start_date) || null,
        end_date: vietnamDateToIso(editEventForm.end_date || editEventForm.start_date) || null,
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
    const ok = window.confirm(
      t('Xóa sự kiện "{title}"? Các công việc đã giao sẽ được giữ lại nhưng không còn gắn với sự kiện này.')
        .replace("{title}", selectedEvent.title),
    );
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

const clampAiTaskCount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(Math.max(Math.round(parsed), 1), 20);
};

const normalizeAiTasks = (items = [], fallbackEventId = null, limit = null) => {
  const maxItems = limit ? clampAiTaskCount(limit) : null;
  const normalized = asArray(items)
    .map((item, index) => ({
      id: `ai-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      selected: true,
      event_id: item.event_id || fallbackEventId || null,
      member_account_ids: [],
      title: String(item.title || "").trim(),
      description: String(item.description || "").trim(),
      due_date: isoToVietnamDate(item.due_date),
      suggested_role: String(item.suggested_role || "").trim(),
      status: item.status || "assigned",
    }))
    .filter((item) => item.title);

  return maxItems ? normalized.slice(0, maxItems) : normalized;
};

const requestAiEventCreate = async (overridePrompt = "") => {
  const prompt = String(overridePrompt || aiPrompt).trim();

  if (!prompt || aiLoading) return;

  setError("");
  setMessage("");
  setAiLoading(true);

  try {
    const requestedCount = clampAiTaskCount(aiTaskCount);
    const result = await generateEventFormAI({
      mode: "event_create",
      prompt: `${prompt}. Hãy tạo đúng ${requestedCount} công việc chuẩn bị cho sự kiện.`,
      requested_task_count: requestedCount,
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
      start_date: isoToVietnamDate(aiEvent.start_date || aiEvent.event_date),
        end_date: isoToVietnamDate(aiEvent.end_date || aiEvent.start_date || aiEvent.event_date),
      description: aiEvent.description || "",
    });

    setAiTaskSuggestions(normalizeAiTasks(result.manager_tasks, null, requestedCount));
    setShowCreateForm(true);
    setShowAiEventModal(false);
    setMessage("AI đã điền form sự kiện. Sau khi lưu, danh sách công việc AI sẽ hiện trong chi tiết sự kiện.");
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
    const requestedCount = clampAiTaskCount(aiTaskCount);
    const result = await generateEventFormAI({
      mode: "task_create",
      prompt: `${prompt}. Hãy gợi ý đúng ${requestedCount} công việc rõ ràng, có hạn chót phù hợp.`,
      requested_task_count: requestedCount,
      today: getTodayInput(),
      clan_id: selectedEvent.clan_id || (isAdmin && clanId ? Number(clanId) : undefined),
      current_event: {
        id: selectedEvent.id,
        title: selectedEvent.title,
        start_date: toDateInput(getEventStartDate(selectedEvent)),
        end_date: toDateInput(getEventEndDate(selectedEvent)),
        description: selectedEvent.description || "",
        clan_id: selectedEvent.clan_id || (isAdmin && clanId ? Number(clanId) : undefined),
      },
      existing_tasks: [
            ...selectedTasks.map((task) => ({
              id: task.task_id || task.id,
              event_id: task.event_id || selectedEvent.id,
              title: task.title,
              description: task.description,
              due_date: toDateInput(task.due_date),
              status: task.status,
              source: "assigned",
            })),
            ...aiTaskSuggestions.map((task) => ({
              id: task.id,
              event_id: task.event_id || selectedEvent.id,
              title: task.title,
              description: task.description,
              due_date: vietnamDateToIso(task.due_date) || null,
              status: task.status || "assigned",
              source: "ai_suggestion",
            })),
          ],
      });

    if (result.status !== "success") {
      setError("AI chỉ hỗ trợ gợi ý công việc liên quan đến sự kiện đang chọn.");
      return;
    }

    setAiTaskSuggestions((prev) => [
        ...prev,
        ...normalizeAiTasks(result.manager_tasks, selectedEvent.id, requestedCount),
      ]);
    setMessage("AI đã tạo danh sách công việc gợi ý. Hãy kiểm tra, chọn người thực hiện rồi gửi công việc.");
  } catch (err) {
    setError(err?.message || "Không thể gọi AI tạo công việc.");
  } finally {
    setAiLoading(false);
  }
};


const updateAiTaskSuggestion = (taskId, patch) => {
  setAiTaskSuggestions((prev) =>
    prev.map((task) =>
      task.id === taskId ? { ...task, ...patch } : task
    )
  );
};

const removeAiTaskSuggestion = (taskId) => {
  setAiTaskSuggestions((prev) => prev.filter((task) => task.id !== taskId));
};

const selectedAiTaskCount = aiTaskSuggestions.filter((task) => task.selected).length;
const aiTaskTotal = aiTaskSuggestions.length;
const currentAiTaskTarget = clampAiTaskCount(aiTaskCount);

const requestAiTasksForCreateForm = () => {
  const prompt = [
    aiPrompt.trim(),
    eventForm.title ? `Sự kiện: ${eventForm.title}` : "",
    eventForm.start_date ? `Ngày bắt đầu: ${eventForm.start_date}` : "",
    eventForm.end_date ? `Ngày kết thúc: ${eventForm.end_date}` : "",
    eventForm.description ? `Mô tả: ${eventForm.description}` : "",
    `Hãy gợi ý đúng ${clampAiTaskCount(aiTaskCount)} công việc cần chuẩn bị cho sự kiện này.`,
  ]
    .filter(Boolean)
    .join(". ");

  requestAiEventCreate(prompt);
};

const submitSingleAiTaskSuggestion = async (task) => {
  if (!selectedEvent) {
    setError("Vui lòng chọn sự kiện trước khi gửi công việc.");
    return;
  }

  const title = String(task.title || "").trim();
  const description = String(task.description || "").trim();
  const dueDate = task.due_date || null;
  const memberIds = Array.isArray(task.member_account_ids)
    ? task.member_account_ids
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0)
    : [];

  if (!task.selected) {
    setError("Công việc này chưa được chọn.");
    return;
  }

  if (!title) {
    setError("Tiêu đề công việc không được để trống.");
    return;
  }

  if (!description) {
    setError("Mô tả công việc không được để trống.");
    return;
  }

  if (!dueDate) {
    setError("Hạn chót không được để trống.");
    return;
  }

  if (!memberIds.length) {
    setError("Vui lòng chọn ít nhất một người thực hiện.");
    return;
  }

  setError("");
  setMessage("");
  setBulkAssigning(true);

  try {
    const result = await bulkAssignTasksAPI({
      event_id: Number(selectedEvent.id),
      ...(isAdmin && clanId ? { clan_id: Number(clanId) } : {}),
      tasks: [
        {
          title,
          description,
          due_date: vietnamDateToIso(dueDate) || null,
          member_account_ids: memberIds,
        },
      ],
    });

    setMessage(result?.message || `Đã gửi công việc "${title}".`);

    setAiTaskSuggestions((prev) =>
      prev.filter((item) => item.id !== task.id)
    );

    await loadData();
  } catch (err) {
    setError(err?.message || "Không thể gửi công việc AI đề xuất.");
  } finally {
    setBulkAssigning(false);
  }
};

const submitSelectedAiTaskSuggestions = async () => {
  if (!selectedEvent) {
    setError("Vui lòng chọn sự kiện trước khi gửi công việc.");
    return;
  }

  const selectedAiTasks = aiTaskSuggestions.filter((task) => task.selected);

  if (!selectedAiTasks.length) {
    setError("Vui lòng chọn ít nhất một công việc AI đề xuất.");
    return;
  }

  const invalidTask = selectedAiTasks.find((task) => {
    const title = String(task.title || "").trim();
    const description = String(task.description || "").trim();
    const dueDate = task.due_date || null;
    const memberIds = Array.isArray(task.member_account_ids)
      ? task.member_account_ids
      : [];

    return !title || !description || !dueDate || !memberIds.length;
  });

  if (invalidTask) {
    setError("Mỗi công việc được chọn phải có đủ: tiêu đề, mô tả, hạn chót và người thực hiện.");
    return;
  }

  setError("");
  setMessage("");
  setBulkAssigning(true);

  try {
    const result = await bulkAssignTasksAPI({
      event_id: Number(selectedEvent.id),
      ...(isAdmin && clanId ? { clan_id: Number(clanId) } : {}),
      tasks: selectedAiTasks.map((task) => ({
        title: String(task.title || "").trim(),
        description: String(task.description || "").trim(),
        due_date: vietnamDateToIso(task.due_date) || null,
        member_account_ids: task.member_account_ids.map(Number),
      })),
    });

    setMessage(result?.message || `Đã gửi ${selectedAiTasks.length} công việc AI đề xuất.`);
    setAiTaskSuggestions([]);
    await loadData();
  } catch (err) {
    setError(err?.message || "Không thể gửi danh sách công việc AI đề xuất.");
  } finally {
    setBulkAssigning(false);
  }
};

const openEvent = (eventId) => {
  setSelectedEventId(String(eventId));
  setAiTaskSuggestions([]);
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
            <h1>Sự kiện & Công việc</h1>
            <p>Danh sách sự kiện đang diễn ra và công việc bạn được phân công.</p>
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

        {events.length > 0 && (
          <div className="manager-event-grid">
            {events.map((event) => {
              const myTaskCount = Number(event.my_task_count || 0);
              const myCompletedTaskCount = Number(event.my_completed_task_count || 0);
              const openTasks = Math.max(myTaskCount - myCompletedTaskCount, 0);
              const hasAssignedTasks = myTaskCount > 0;
              
              return (
                <button 
                  key={event.id} 
                  type="button" 
                  className={`manager-event-card ${openTasks > 0 ? 'is-assigned-glow' : ''}`}
                  onClick={() => setSelectedEventId(event.id)}
                >
                  <span className="manager-event-icon material-symbols-outlined">event_note</span>
                  <strong>{event.title}</strong>
                  <small>{formatEventRange(event)}</small>
                  <span className={`event-status-pill ${eventStatusClass(event.status)}`}>{eventStatusLabel(event.status)}</span>
                  {event.description && <p>{event.description}</p>}
                  <div className="manager-event-metrics">
                    {hasAssignedTasks ? (
                      <>
                        <span>{openTasks} việc đang mở</span>
                        <span>{myCompletedTaskCount} hoàn thành</span>
                        <span>{myTaskCount} tổng việc</span>
                      </>
                    ) : (
                      <span>Chưa có việc cho bạn</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedEventId && (
          <div className="task-modal-backdrop" role="presentation" onMouseDown={() => setSelectedEventId("")}>
            <div className="task-modal-card member-tasks-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
              <div className="task-modal-head">
                <div className="task-card-title">
                  <span className="material-symbols-outlined">assignment</span>
                  <h2>{selectedEvent ? selectedEvent.title : "Công việc trong sự kiện"}</h2>
                </div>
                <button className="task-icon-btn" type="button" onClick={() => setSelectedEventId("")} aria-label="Đóng">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="member-tasks-modal-body">
                <TaskList tasks={selectedTasks} isMember savingTaskId={savingTaskId} onUpdateStatus={updateTaskStatus} />
              </div>
            </div>
          </div>
        )}

        {!events.length && (
          <TaskList tasks={tasks} isMember savingTaskId={savingTaskId} onUpdateStatus={updateTaskStatus} />
        )}
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
            <p>{formatEventRange(selectedEvent)} • {eventStatusLabel(selectedEvent.status)} • {selectedTasks.length} công việc trong sự kiện • Manager chỉ quản lý dữ liệu thuộc dòng họ của mình.</p>
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

        <div className="event-action-strip task-card">
          <div>
            <strong>Quản lý sự kiện</strong>
            <small>Quản lý thông tin, sinh gợi ý công việc bằng AI và giao việc cho thành viên trong một luồng rõ ràng.</small>
          </div>
          <div className="event-action-buttons">
            <button className="task-btn task-btn-primary" type="button" onClick={requestAiTaskCreate} disabled={aiLoading}>
              <span className="material-symbols-outlined">auto_awesome</span>
              {aiLoading ? "AI đang tạo..." : "AI tạo công việc"}
            </button>
            <button className="task-btn task-btn-ghost" type="button" onClick={() => setShowAssignTaskModal(true)}>
              <span className="material-symbols-outlined">assignment_add</span>
              Giao công việc
            </button>
            <button className="task-btn task-btn-ghost" type="button" onClick={() => setShowEditEventModal(true)}>
              <span className="material-symbols-outlined">edit_calendar</span>
              Sửa sự kiện
            </button>
          </div>
        </div>

        <div className="event-detail-summary event-detail-summary-compact">
          <span><span className="material-symbols-outlined">calendar_month</span> Thời gian: <strong>{formatEventRange(selectedEvent)}</strong></span>
          <span><span className="material-symbols-outlined">assignment</span> Đã giao: <strong>{selectedTasks.length} công việc</strong></span>
          <span><span className="material-symbols-outlined">auto_awesome</span> AI chờ giao: <strong>{aiTaskTotal} gợi ý</strong></span>
        </div>

        <div className="event-workspace-grid">
          <section className="task-card ai-task-panel event-ai-panel">
            <div className="ai-task-panel-head">
              <div>
                <span className="task-section-kicker">Gợi ý từ AI</span>
                <h3>Công việc AI sinh ra</h3>
                <p>Chọn công việc phù hợp, bổ sung người thực hiện rồi gửi vào danh sách công việc của sự kiện.</p>
                <div className="ai-count-notice" aria-label="Thống kê công việc AI">
                  <div className="ai-count-notice-icon">
                    <span className="material-symbols-outlined">info</span>
                  </div>
                  <div className="ai-count-notice-body">
                    <strong>Trạng thái gợi ý AI</strong>
                    <div className="ai-count-notice-grid">
                      <span><b>{currentAiTaskTarget}</b> việc yêu cầu</span>
                      <span><b>{aiTaskTotal}</b> việc AI đã tạo</span>
                      <span><b>{selectedAiTaskCount}</b>/{aiTaskTotal || currentAiTaskTarget} việc đang chọn</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="ai-task-head-actions">
                <label className="ai-count-control">
                  <span>Số việc AI</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={aiTaskCount}
                    onChange={handleAiTaskCountChange}
                  />
                  <small>Tối đa 20 việc/lần tạo</small>
                </label>
              </div>
            </div>

            <div className="ai-inline-prompt">
              <div className="ai-prompt-input-wrap">
                <input
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder="Ví dụ: Gợi ý thêm việc chuẩn bị hậu cần, đón khách, mâm cỗ..."
                  disabled={aiLoading}
                />
                <button
                  className={`ai-voice-btn ${voiceListening ? "is-listening" : ""}`}
                  type="button"
                  onClick={toggleAiPromptVoiceInput}
                  disabled={aiLoading}
                  aria-label={voiceListening ? "Dừng nhập giọng nói" : "Nhập prompt bằng giọng nói"}
                  title={speechSupported ? "Nhập prompt bằng giọng nói" : "Trình duyệt chưa hỗ trợ nhập giọng nói"}
                >
                  <span className="material-symbols-outlined">{voiceListening ? "mic_off" : "mic"}</span>
                </button>
              </div>
              <button className="task-btn task-btn-ghost" type="button" onClick={requestAiTaskCreate} disabled={aiLoading}>
                <span className="material-symbols-outlined">auto_awesome</span>
                Tạo thêm
              </button>
              <VoiceRecorder disabled={aiLoading} maxSeconds={60} onTranscript={appendAiPromptText} />
            </div>

            {aiTaskSuggestions.length ? (
              <div className="ai-task-grid ai-task-grid-compact">
                {aiTaskSuggestions.map((task) => {
                  const titleOk = Boolean(String(task.title || "").trim());
                  const descriptionOk = Boolean(String(task.description || "").trim());
                  const dueDateOk = Boolean(task.due_date);
                  const assigneeOk = Array.isArray(task.member_account_ids) && task.member_account_ids.length > 0;
                  const canSend = task.selected && titleOk && descriptionOk && dueDateOk && assigneeOk && !bulkAssigning;

                  return (
                    <article className="ai-task-card ai-task-card-compact" key={task.id}>
                      <div className="ai-task-card-top">
                        <label className="ai-task-check">
                          <input
                            type="checkbox"
                            checked={Boolean(task.selected)}
                            onChange={(event) => updateAiTaskSuggestion(task.id, { selected: event.target.checked })}
                          />
                          <span>Chọn</span>
                        </label>

                        <div className="ai-task-top-actions">
                          <span className={canSend ? "ai-task-valid is-ok" : "ai-task-valid is-warning"}>
                            {canSend ? "Đủ thông tin" : "Thiếu thông tin"}
                          </span>
                          <button className="task-icon-btn is-danger" type="button" onClick={() => removeAiTaskSuggestion(task.id)} aria-label="Xóa công việc AI">
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="ai-task-fields ai-task-fields-compact">
                        <label className={!titleOk ? "field-invalid" : ""}>
                          <span>Tiêu đề</span>
                          <input
                            value={task.title}
                            onChange={(event) => updateAiTaskSuggestion(task.id, { title: event.target.value })}
                            placeholder="Nhập tiêu đề công việc"
                          />
                        </label>

                        <label className={!dueDateOk ? "field-invalid" : ""}>
                          <span>Hạn chót</span>
                          <DateInput
                            value={task.due_date || ""}
                            onChange={(event) => updateAiTaskSuggestion(task.id, { due_date: event.target.value })}
                          />
                        </label>

                        <label className={!descriptionOk ? "field-invalid" : "ai-task-desc"}>
                          <span>Mô tả</span>
                          <textarea
                            rows={2}
                            value={task.description}
                            onChange={(event) => updateAiTaskSuggestion(task.id, { description: event.target.value })}
                            placeholder="Mô tả việc cần làm"
                          />
                        </label>

                        <div className={!assigneeOk ? "task-field field-invalid" : "task-field"}>
                          <span>Người thực hiện</span>
                          <MemberCombobox
                            members={members}
                            value={task.member_account_ids || []}
                            disabled={bulkAssigning || !members.length}
                            onChange={(memberIds) => updateAiTaskSuggestion(task.id, { member_account_ids: memberIds })}
                          />
                        </div>

                        {task.suggested_role && (
                          <div className="ai-task-role">
                            Gợi ý: <strong>{task.suggested_role}</strong>
                          </div>
                        )}
                      </div>

                      <div className="ai-task-card-actions">
                        <button className="task-btn task-btn-primary" type="button" onClick={() => submitSingleAiTaskSuggestion(task)} disabled={!canSend}>
                          <span className="material-symbols-outlined">send</span>
                          Gửi việc này
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="task-empty ai-empty">Chưa có công việc AI. Bấm “AI tạo công việc” để sinh gợi ý.</div>
            )}
          </section>

          <div className="event-assigned-column">
            <TaskList title="Công việc trong sự kiện" tasks={selectedTasks} />
          </div>
        </div>

        {showEditEventModal && (
          <div className="task-modal-backdrop" role="presentation" onMouseDown={() => setShowEditEventModal(false)}>
            <form className="task-modal-card task-form event-edit-card" onSubmit={saveEvent} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
              <div className="task-modal-head">
                <div className="task-card-title">
                  <span className="material-symbols-outlined">edit_calendar</span>
                  <h2>Sửa sự kiện</h2>
                </div>
                <button className="task-icon-btn" type="button" onClick={() => setShowEditEventModal(false)} aria-label="Đóng">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <label>
                <span>Tên sự kiện</span>
                <input value={editEventForm.title} onChange={(event) => setEditEventForm((prev) => ({ ...prev, title: event.target.value }))} />
              </label>
              <label>
                <span>Ngày bắt đầu</span>
                <DateInput value={editEventForm.start_date} onChange={(event) => setEditEventForm((prev) => ({ ...prev, start_date: event.target.value }))} />
              </label>
              <label>
                <span>Ngày kết thúc</span>
                <DateInput value={editEventForm.end_date} onChange={(event) => setEditEventForm((prev) => ({ ...prev, end_date: event.target.value }))} />
              </label>
              <label>
                <span>Trạng thái</span>
                <div className={`event-status-pill ${eventStatusClass(selectedEvent.status)}`}>{eventStatusLabel(selectedEvent.status)}</div>
              </label>
              <label>
                <span>Mô tả</span>
                <textarea value={editEventForm.description} onChange={(event) => setEditEventForm((prev) => ({ ...prev, description: event.target.value }))} rows={5} placeholder="Mô tả sự kiện" />
              </label>
              <div className="task-form-actions task-modal-actions">
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
          </div>
        )}

        {showAssignTaskModal && (
          <div className="task-modal-backdrop" role="presentation" onMouseDown={() => setShowAssignTaskModal(false)}>
            <form className="task-modal-card task-form event-assign-card" onSubmit={submitTask} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
              <div className="task-modal-head">
                <div className="task-card-title">
                  <span className="material-symbols-outlined">assignment_add</span>
                  <h2>Giao công việc</h2>
                </div>
                <button className="task-icon-btn" type="button" onClick={() => setShowAssignTaskModal(false)} aria-label="Đóng">
                  <span className="material-symbols-outlined">close</span>
                </button>
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
                <DateInput value={form.due_date} onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))} />
              </label>
              <div className="task-form-actions task-modal-actions">
                <button className="task-btn task-btn-primary" type="submit" disabled={saving || !members.length}>
                  <span className="material-symbols-outlined">send</span>
                  {saving ? "Đang lưu..." : "Giao việc"}
                </button>
              </div>
              {!members.length && <p className="task-note">Chưa có member active để giao việc trong dòng họ này.</p>}
            </form>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="task-page task-page-manager">
      <header className="task-hero task-hero-wide manager-hero">
        <div>
          <span className="task-kicker">{isAdmin ? "Admin" : "Manager"}</span>
          <h1>{isAdmin ? `Phân công công việc dòng họ ${clan?.clan_name || ""}` : "Phân công công việc dòng họ"}</h1>
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

      <div className="event-toolbar event-toolbar-compact">
        <div className="event-search event-search-compact">
          <span className="material-symbols-outlined">search</span>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm sự kiện..." />
        </div>
        <div className="event-toolbar-actions">
          <button className="task-btn task-btn-ghost" type="button" onClick={() => setShowAiEventModal(true)}>
            <span className="material-symbols-outlined">auto_awesome</span>
            AI điền form
          </button>
          <button className="task-btn task-btn-ghost" type="button" onClick={() => setShowArchive(true)}>
            <span className="material-symbols-outlined">inventory_2</span>
            Kho lưu trữ ({archivedEvents.length})
          </button>
          <button className="task-btn task-btn-primary" type="button" onClick={() => { setAiTaskSuggestions([]); setShowCreateForm(true); }}>
            <span className="material-symbols-outlined">add</span>
            Thêm sự kiện
          </button>
        </div>
      </div>

      {showAiEventModal && (
        <div className="task-modal-backdrop" role="presentation" onMouseDown={() => setShowAiEventModal(false)}>
          <div className="task-modal-card ai-event-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="task-modal-head">
              <div className="task-card-title">
                <span className="material-symbols-outlined">auto_awesome</span>
                <div>
                  <h2>AI tạo sự kiện & công việc</h2>
                  <p>Nhập câu lệnh, AI sẽ điền sẵn form tạo sự kiện và gợi ý công việc.</p>
                </div>
              </div>
              <button className="task-icon-btn" type="button" onClick={() => setShowAiEventModal(false)} aria-label="Đóng AI">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <label className="ai-modal-field">
              <span>Câu lệnh cho AI</span>
              <div className="ai-prompt-input-wrap ai-prompt-input-wrap-textarea">
                <textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  rows={4}
                  placeholder="Ví dụ: Tạo sự kiện giỗ tổ ngày 10/11/2025, tụ họp con cháu ở từ đường và gợi ý 6 công việc chuẩn bị"
                  disabled={aiLoading}
                />
                <button
                  className={`ai-voice-btn ${voiceListening ? "is-listening" : ""}`}
                  type="button"
                  onClick={toggleAiPromptVoiceInput}
                  disabled={aiLoading}
                  aria-label={voiceListening ? "Dừng nhập giọng nói" : "Nhập prompt bằng giọng nói"}
                  title={speechSupported ? "Nhập prompt bằng giọng nói" : "Trình duyệt chưa hỗ trợ nhập giọng nói"}
                >
                  <span className="material-symbols-outlined">{voiceListening ? "mic_off" : "mic"}</span>
                </button>
              </div>
              {voiceListening && <small className="ai-voice-status">Đang nghe giọng nói...</small>}
              <VoiceRecorder disabled={aiLoading} maxSeconds={60} onTranscript={appendAiPromptText} />
            </label>
            <label className="ai-count-control ai-count-control-wide">
              <span>Số công việc muốn AI gợi ý</span>
              <input
                type="number"
                min="1"
                max="20"
                value={aiTaskCount}
                onChange={handleAiTaskCountChange}
              />
              <small>Tối đa 20 việc/lần tạo</small>
            </label>
            <div className="task-form-actions task-modal-actions">
              <button className="task-btn task-btn-primary" type="button" onClick={() => requestAiEventCreate()} disabled={aiLoading || !aiPrompt.trim()}>
                <span className="material-symbols-outlined">auto_awesome</span>
                {aiLoading ? "AI đang tạo..." : "AI điền form"}
              </button>
              <button className="task-btn task-btn-ghost" type="button" onClick={() => setShowAiEventModal(false)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchive && (
        <div className="task-modal-backdrop" role="presentation" onMouseDown={() => setShowArchive(false)}>
          <div className="task-modal-card archive-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="task-modal-head">
              <div className="task-card-title">
                <span className="material-symbols-outlined">inventory_2</span>
                <div>
                  <h2>Kho lưu trữ sự kiện</h2>
                  <p>Chỉ xem và tìm kiếm các sự kiện đã kết thúc. Không chỉnh sửa hoặc xóa tại đây.</p>
                </div>
              </div>
              <button className="task-icon-btn" type="button" onClick={() => setShowArchive(false)} aria-label="Đóng kho lưu trữ">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="event-search archive-search">
              <span className="material-symbols-outlined">search</span>
              <input value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder="Tìm trong kho lưu trữ..." />
            </div>
            <div className="archive-event-list">
              {filteredArchivedEvents.map((event) => (
                <article className="archive-event-item" key={event.id}>
                  <span className="manager-event-icon material-symbols-outlined">event_available</span>
                  <div>
                    <strong>{event.title}</strong>
                    <small>{formatEventRange(event)}</small>
                    {event.description && <p>{event.description}</p>}
                  </div>
                  <div className="archive-event-actions">
                    <span className={`event-status-pill ${eventStatusClass(event.status)}`}>{eventStatusLabel(event.status)}</span>
                    <button
                      className="task-btn task-btn-ghost archive-view-btn"
                      type="button"
                      onClick={() => { setShowArchive(false); openEvent(event.id); }}
                    >
                      <span className="material-symbols-outlined">visibility</span>
                      Xem sự kiện
                    </button>
                  </div>
                </article>
              ))}
              {!filteredArchivedEvents.length && <div className="task-empty">Không có sự kiện đã kết thúc phù hợp.</div>}
            </div>
          </div>
        </div>
      )}

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
              <span>Ngày bắt đầu</span>
              <DateInput value={eventForm.start_date} onChange={(event) => setEventForm((prev) => ({ ...prev, start_date: event.target.value }))} />
            </label>
            <label>
              <span>Ngày kết thúc</span>
              <DateInput value={eventForm.end_date} onChange={(event) => setEventForm((prev) => ({ ...prev, end_date: event.target.value }))} />
            </label>
            <label>
              <span>Mô tả ngắn</span>
              <textarea value={eventForm.description} onChange={(event) => setEventForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} placeholder="Ghi chú địa điểm, nội dung chính hoặc yêu cầu chuẩn bị..." />
            </label>

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
        {activeFilteredEvents.map((event) => {
          const assignmentCount = Number(event.assignment_count || 0);
          const completedCount = Number(event.completed_assignment_count || 0);
          const openCount = Math.max(assignmentCount - completedCount, 0);
          return (
            <button key={event.id} type="button" className="manager-event-card" onClick={() => openEvent(event.id)}>
              <span className="manager-event-icon material-symbols-outlined">event_note</span>
              <strong>{event.title}</strong>
              <small>{formatEventRange(event)}</small>
              <span className={`event-status-pill ${eventStatusClass(event.status)}`}>{eventStatusLabel(event.status)}</span>
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

      {!activeFilteredEvents.length && (
        <div className="task-card task-empty">
          {events.length ? "Không tìm thấy sự kiện đang/sắp diễn ra phù hợp. Sự kiện đã kết thúc nằm trong Kho lưu trữ." : "Dòng họ này chưa có sự kiện. Bấm Thêm sự kiện để tạo mới."}
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
