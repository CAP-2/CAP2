import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createMemberReminder,
  getGeneralPosts,
  getMemberChat,
  getMemberDashboard,
  sendMemberChat,
  updateMemberTaskStatus,
} from "../../api/memberService";
import "./MemberDashboard.css";

function formatDate(value, withTime = false) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return withTime ? date.toLocaleString("vi-VN") : date.toLocaleDateString("vi-VN");
}

function getTaskLabel(status) {
  if (status === "completed") return "Đã hoàn thành";
  if (status === "in_progress") return "Đang làm";
  return "Đã giao";
}

function buildDisplayName(profile) {
  return (
    profile?.display_name ||
    [profile?.surname, profile?.middle_name, profile?.first_name].filter(Boolean).join(" ").trim() ||
    "Thành viên"
  );
}

export default function MemberDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [posts, setPosts] = useState([]);
  const [reminderForm, setReminderForm] = useState({ title: "", date: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [sendingChat, setSendingChat] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const chatListRef = useRef(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [dashResult, chatResult, postResult] = await Promise.allSettled([
        getMemberDashboard(),
        getMemberChat(),
        getGeneralPosts(),
      ]);

      if (dashResult.status === "rejected") throw dashResult.reason;
      setDashboard(dashResult.value);

      if (chatResult.status === "fulfilled") {
        const messages = chatResult.value.messages || [];
        setChat(
          messages.length
            ? messages.map((m) => ({
                role: m.sender_type === "user" ? "user" : "ai",
                text: m.content,
              }))
            : [
                {
                  role: "ai",
                  text: "Chào bạn, tôi có thể hỗ trợ tra cứu thông tin dòng họ, công việc được giao và lịch nhắc.",
                },
              ],
        );
      }

      if (postResult.status === "fulfilled") {
        setPosts(postResult.value.posts || []);
      } else {
        setPosts([]);
      }
    } catch (err) {
      setError(err?.message || "Không thể tải dữ liệu trang thành viên.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => loadDashboard(true), 30000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chat]);

  const profile = dashboard?.profile || {};
  const clan = dashboard?.clan || {};
  const treeMembers = dashboard?.treeMembers || [];
  const tasks = dashboard?.assignedTasks || [];
  const reminders = dashboard?.reminders || [];
  const notifications = dashboard?.notifications || [];

  const stats = useMemo(() => {
    const generations = new Set(
      treeMembers
        .map((m) => Number(m.generation))
        .filter((generation) => Number.isFinite(generation) && generation > 0),
    );
    const openTasks = tasks.filter((task) => task.status !== "completed").length;
    const unreadNotifications = notifications.filter((item) => !item.is_read).length;
    const profileFields = [
      profile.surname,
      profile.first_name,
      profile.email,
      profile.hometown,
      profile.generation,
      profile.bio,
      profile.avatar_url,
    ];
    const completeFields = profileFields.filter((value) => value !== null && value !== undefined && String(value).trim() !== "").length;

    return [
      {
        label: "Thành viên trong dòng họ",
        value: treeMembers.length,
        icon: "groups",
        tone: "green",
      },
      {
        label: "Số đời đã ghi nhận",
        value: generations.size || 0,
        icon: "account_tree",
        tone: "gold",
      },
      {
        label: "Công việc đang mở",
        value: openTasks,
        icon: "assignment",
        tone: "blue",
      },
      {
        label: "Hồ sơ hoàn thiện",
        value: `${Math.round((completeFields / profileFields.length) * 100)}%`,
        icon: "badge",
        tone: "red",
      },
      {
        label: "Thông báo chưa đọc",
        value: unreadNotifications,
        icon: "notifications",
        tone: "violet",
      },
    ];
  }, [notifications, profile, tasks, treeMembers]);

  const handleTaskStatus = async (taskId, status) => {
    setSavingTaskId(taskId);
    setError("");
    setNotice("");
    try {
      await updateMemberTaskStatus(taskId, status);
      setNotice(status === "completed" ? "Đã đánh dấu hoàn thành công việc." : "Đã cập nhật trạng thái công việc.");
      await loadDashboard(true);
    } catch (err) {
      setError(err?.message || "Không thể cập nhật công việc.");
    } finally {
      setSavingTaskId(null);
    }
  };

  const handleCreateReminder = async (event) => {
    event.preventDefault();
    if (!reminderForm.title.trim() || !reminderForm.date) {
      setError("Vui lòng nhập tiêu đề và ngày nhắc.");
      return;
    }

    setSavingReminder(true);
    setError("");
    setNotice("");
    try {
      await createMemberReminder({
        title: reminderForm.title.trim(),
        date: reminderForm.date,
        note: reminderForm.note.trim(),
      });
      setReminderForm({ title: "", date: "", note: "" });
      setNotice("Đã thêm nhắc việc vào lịch dòng họ.");
      await loadDashboard(true);
    } catch (err) {
      setError(err?.message || "Không thể tạo nhắc việc.");
    } finally {
      setSavingReminder(false);
    }
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || sendingChat) return;

    setSendingChat(true);
    setError("");
    setChat((current) => [...current, { role: "user", text }]);
    setChatInput("");

    try {
      await sendMemberChat(text);
      const response = await getMemberChat();
      setChat(
        (response.messages || []).map((m) => ({
          role: m.sender_type === "user" ? "user" : "ai",
          text: m.content,
        })),
      );
    } catch (err) {
      setError(err?.message || "Không thể gửi tin nhắn.");
    } finally {
      setSendingChat(false);
    }
  };

  if (loading) {
    return (
      <div className="member-portal-page">
        <section className="member-panel">
          <div className="member-empty">Đang tải dữ liệu thành viên...</div>
        </section>
      </div>
    );
  }

  return (
    <div className="member-portal-page">
      {(error || notice) && (
        <div className={`member-alert ${error ? "is-error" : "is-success"}`}>
          {error || notice}
        </div>
      )}

      <section className="member-hero-panel">
        <div>
          <span className="member-kicker">Trang thành viên</span>
          <h1>{buildDisplayName(profile)}</h1>
          <p>
            {clan.clan_name
              ? `Bạn đang xem dữ liệu của dòng họ ${clan.clan_name}.`
              : "Tài khoản chưa được gắn với dòng họ nào."}
          </p>
        </div>
        <div className="member-hero-actions">
          <Link to="/user/family-tree" className="member-btn member-btn-primary">
            <span className="material-symbols-outlined">account_tree</span>
            Xem cây gia phả
          </Link>
          <Link to="/user/profile" className="member-btn member-btn-ghost">
            <span className="material-symbols-outlined">manage_accounts</span>
            Cập nhật hồ sơ
          </Link>
        </div>
      </section>

      <section className="member-stats-grid" aria-label="Chỉ số thành viên">
        {stats.map((card) => (
          <article className={`member-stat-card tone-${card.tone}`} key={card.label}>
            <span className="material-symbols-outlined">{card.icon}</span>
            <div>
              <strong>{card.value}</strong>
              <p>{card.label}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="member-content-grid">
        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Công việc được giao</h2>
              <p>Theo dõi và cập nhật tiến độ cho quản lý dòng họ.</p>
            </div>
          </div>

          <div className="member-list">
            {tasks.length === 0 ? (
              <div className="member-empty">Bạn chưa có công việc được giao.</div>
            ) : (
              tasks.map((task) => (
                <article className="member-task-card" key={task.id}>
                  <div>
                    <div className="member-row-title">{task.title}</div>
                    {task.description && <p>{task.description}</p>}
                    <div className="member-meta">
                      <span>Người giao: {task.manager_name || "Manager"}</span>
                      <span>Hạn: {formatDate(task.due_date)}</span>
                      <span className={`member-status status-${task.status}`}>{getTaskLabel(task.status)}</span>
                    </div>
                  </div>
                  {task.status !== "completed" && (
                    <div className="member-task-actions">
                      <button
                        className="member-btn member-btn-ghost"
                        type="button"
                        disabled={savingTaskId === task.id || task.status === "in_progress"}
                        onClick={() => handleTaskStatus(task.id, "in_progress")}
                      >
                        Đang làm
                      </button>
                      <button
                        className="member-btn member-btn-primary"
                        type="button"
                        disabled={savingTaskId === task.id}
                        onClick={() => handleTaskStatus(task.id, "completed")}
                      >
                        Hoàn thành
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Nhắc việc và sự kiện</h2>
              <p>Thêm lịch nhắc chung cho dòng họ.</p>
            </div>
          </div>

          <form className="member-reminder-form" onSubmit={handleCreateReminder}>
            <input
              value={reminderForm.title}
              onChange={(event) => setReminderForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Tiêu đề nhắc việc"
            />
            <input
              type="date"
              value={reminderForm.date}
              onChange={(event) => setReminderForm((current) => ({ ...current, date: event.target.value }))}
            />
            <textarea
              value={reminderForm.note}
              onChange={(event) => setReminderForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="Ghi chú"
              rows={3}
            />
            <button className="member-btn member-btn-primary" type="submit" disabled={savingReminder}>
              Thêm nhắc việc
            </button>
          </form>

          <div className="member-list compact">
            {reminders.slice(0, 5).map((reminder) => (
              <article className="member-mini-row" key={reminder.id}>
                <strong>{reminder.title}</strong>
                <span>{formatDate(reminder.event_date)}</span>
              </article>
            ))}
            {reminders.length === 0 && <div className="member-empty">Chưa có sự kiện hoặc nhắc việc.</div>}
          </div>
        </section>
      </div>

      <div className="member-content-grid">
        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Bảng tin dòng họ</h2>
              <p>Các bài viết đã được quản lý phê duyệt.</p>
            </div>
            <Link to="/user/posts?compose=1" className="member-btn member-btn-ghost">
              Thêm bài đăng
            </Link>
          </div>

          <div className="member-feed">
            {posts.slice(0, 3).map((post) => (
              <article className="member-post-card" key={post.id}>
                {post.image_url && <img src={post.image_url} alt="" />}
                <div>
                  <strong>{post.author_name || "Thành viên"}</strong>
                  <span>{formatDate(post.created_at, true)}</span>
                  <p>{post.description || post.content || "Bài viết hình ảnh"}</p>
                </div>
              </article>
            ))}
            {posts.length === 0 && <div className="member-empty">Chưa có bài viết nào được phê duyệt.</div>}
          </div>
        </section>

        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <h2>Trợ lý AI</h2>
              <p>Hỏi nhanh về dữ liệu gia phả và thông tin dòng họ.</p>
            </div>
          </div>

          <div className="member-chat">
            <div className="member-chat-list" ref={chatListRef}>
              {chat.map((message, index) => (
                <div className={`member-chat-message ${message.role === "user" ? "is-user" : "is-ai"}`} key={`${message.role}-${index}`}>
                  <span>{message.text}</span>
                </div>
              ))}
            </div>
            <div className="member-chat-composer">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSendChat();
                }}
                placeholder="Nhập câu hỏi..."
              />
              <button className="member-btn member-btn-primary" type="button" disabled={sendingChat} onClick={handleSendChat}>
                Gửi
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="member-panel">
        <div className="member-panel-header">
          <div>
            <h2>Thông báo gần đây</h2>
            <p>Cập nhật từ quản lý và hệ thống.</p>
          </div>
        </div>
        <div className="member-list compact">
          {notifications.slice(0, 8).map((item) => (
            <article className="member-mini-row" key={item.id}>
              <strong>{item.title || "Thông báo"}</strong>
              <span>{item.message}</span>
              <small>{formatDate(item.created_at, true)}</small>
            </article>
          ))}
          {notifications.length === 0 && <div className="member-empty">Chưa có thông báo mới.</div>}
        </div>
      </section>
    </div>
  );
}
