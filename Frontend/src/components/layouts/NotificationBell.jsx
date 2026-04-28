import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import "./NotificationBell.css";

function normalizeLink(linkUrl, role) {
  if (!linkUrl) return role === "manager" ? "/manager/dashboard" : "/user/dashboard";
  if (linkUrl.startsWith("/member/tasks")) return "/user/dashboard";
  if (linkUrl.startsWith("/manager/tasks")) return "/manager/dashboard";
  return linkUrl;
}

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationBell({ role = "member", className = "", buttonClassName = "" }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/member/notifications");
      const list = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications(list);
      setUnreadCount(Number(data.unread_count ?? list.filter((item) => Number(item.is_read) === 0).length));
    } catch (error) {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const latestItems = useMemo(() => notifications.slice(0, 12), [notifications]);

  const toggleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) await loadNotifications();
  };

  const openNotification = async (item) => {
    if (!item) return;
    if (Number(item.is_read) === 0) {
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === item.id ? { ...notification, is_read: 1 } : notification
        )
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        await apiRequest(`/api/member/notifications/${item.id}/read`, { method: "PATCH" });
      } catch (error) {
        loadNotifications();
      }
    }
    setOpen(false);
    navigate(normalizeLink(item.link_url, role));
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })));
    setUnreadCount(0);
    try {
      await apiRequest("/api/member/notifications/read-all", { method: "PATCH" });
    } catch (error) {
      loadNotifications();
    }
  };

  return (
    <div className={`notification-bell ${className}`} ref={rootRef}>
      <button
        type="button"
        className={`notification-bell-button ${buttonClassName}`}
        title="Thông báo"
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Danh sách thông báo">
          <div className="notification-panel-head">
            <div>
              <strong>Thông báo</strong>
              <span>{unreadCount > 0 ? `${unreadCount} chưa đọc` : "Đã đọc hết"}</span>
            </div>
            <button type="button" onClick={markAllRead} disabled={unreadCount === 0}>
              Đọc hết
            </button>
          </div>

          <div className="notification-list">
            {loading && latestItems.length === 0 ? (
              <div className="notification-empty">Đang tải...</div>
            ) : latestItems.length === 0 ? (
              <div className="notification-empty">Chưa có thông báo.</div>
            ) : (
              latestItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`notification-item ${Number(item.is_read) === 0 ? "is-unread" : ""}`}
                  onClick={() => openNotification(item)}
                >
                  <span className="notification-dot" />
                  <span className="notification-content">
                    <strong>{item.title || "Thông báo"}</strong>
                    <span>{item.message || ""}</span>
                    <time>{formatNotificationTime(item.created_at)}</time>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
