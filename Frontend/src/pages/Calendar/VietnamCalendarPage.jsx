import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/api";
import { getStoredUser } from "../../utils/auth";
import "./VietnamCalendarPage.css";

const STORAGE_KEY = "gia_pha_viet_calendar_events_v1";
const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTH_NAMES = [
  "Tháng Một",
  "Tháng Hai",
  "Tháng Ba",
  "Tháng Tư",
  "Tháng Năm",
  "Tháng Sáu",
  "Tháng Bảy",
  "Tháng Tám",
  "Tháng Chín",
  "Tháng Mười",
  "Tháng Mười Một",
  "Tháng Mười Hai",
];

const SOLAR_HOLIDAYS = {
  "01-01": "Tết Dương lịch",
  "03-08": "Quốc tế Phụ nữ",
  "04-30": "Giải phóng miền Nam",
  "05-01": "Quốc tế Lao động",
  "06-01": "Quốc tế Thiếu nhi",
  "09-02": "Quốc khánh Việt Nam",
  "10-20": "Phụ nữ Việt Nam",
  "11-20": "Nhà giáo Việt Nam",
  "12-22": "Quân đội Nhân dân Việt Nam",
  "12-25": "Giáng sinh",
};

const LUNAR_HOLIDAYS = {
  "01-01": "Tết Nguyên Đán",
  "01-02": "Mùng 2 Tết",
  "01-03": "Mùng 3 Tết",
  "01-15": "Rằm tháng Giêng",
  "03-10": "Giỗ Tổ Hùng Vương",
  "04-15": "Phật Đản",
  "07-15": "Vu Lan",
  "08-15": "Tết Trung Thu",
  "12-23": "Ông Công Ông Táo",
};

const DEFAULT_EVENT_TEMPLATES = [
  { title: "Họp mặt dòng họ", type: "family", note: "Gợi ý: thêm lịch họp mặt, giỗ chạp, lễ tộc." },
  { title: "Lịch học / thi", type: "study", note: "Gợi ý: theo dõi lịch học, lịch thi, hạn nộp bài." },
  { title: "Ngày lễ quan trọng", type: "holiday", note: "Gợi ý: lưu các ngày lễ cần nhắc riêng." },
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatVietnamDate(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function parseDateKey(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getMonthMatrix(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function getWeekDates(date) {
  const start = addDays(date, -date.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getWeekRangeText(date) {
  const week = getWeekDates(date);
  return `${formatVietnamDate(week[0])} - ${formatVietnamDate(week[6])}`;
}

function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

function jdToDate(jd) {
  let a;
  let b;
  let c;
  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return [day, month, year];
}

function newMoon(k) {
  const t = k / 1236.85;
  const t2 = t * t;
  const t3 = t2 * t;
  const dr = Math.PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * dr);
  const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
  const mpr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
  const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
  let c1 = (0.1734 - 0.000393 * t) * Math.sin(m * dr) + 0.0021 * Math.sin(2 * dr * m);
  c1 -= 0.4068 * Math.sin(mpr * dr) + 0.0161 * Math.sin(2 * dr * mpr);
  c1 -= 0.0004 * Math.sin(3 * dr * mpr);
  c1 += 0.0104 * Math.sin(2 * dr * f) - 0.0051 * Math.sin((m + mpr) * dr);
  c1 -= 0.0074 * Math.sin((m - mpr) * dr) + 0.0004 * Math.sin((2 * f + m) * dr);
  c1 -= 0.0004 * Math.sin((2 * f - m) * dr) - 0.0006 * Math.sin((2 * f + mpr) * dr);
  c1 += 0.001 * Math.sin((2 * f - mpr) * dr) + 0.0005 * Math.sin((2 * mpr + m) * dr);
  let deltaT;
  if (t < -11) {
    deltaT = 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3;
  } else {
    deltaT = -0.000278 + 0.000265 * t + 0.000262 * t2;
  }
  return jd1 + c1 - deltaT;
}

function sunLongitude(jdn) {
  const t = (jdn - 2451545.0) / 36525;
  const t2 = t * t;
  const dr = Math.PI / 180;
  const m = 357.5291 + 35999.0503 * t - 0.0001559 * t2 - 0.00000048 * t * t2;
  const l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
  let dl = (1.9146 - 0.004817 * t - 0.000014 * t2) * Math.sin(dr * m);
  dl += (0.019993 - 0.000101 * t) * Math.sin(2 * dr * m) + 0.00029 * Math.sin(3 * dr * m);
  let l = l0 + dl;
  l *= dr;
  l -= Math.PI * 2 * Math.floor(l / (Math.PI * 2));
  return l;
}

function getNewMoonDay(k, timeZone) {
  return Math.floor(newMoon(k) + 0.5 + timeZone / 24);
}

function getSunLongitude(dayNumber, timeZone) {
  return Math.floor((sunLongitude(dayNumber - 0.5 - timeZone / 24) / Math.PI) * 6);
}

function getLunarMonth11(yy, timeZone) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}

function getLeapMonthOffset(a11, timeZone) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i += 1;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

function convertSolar2Lunar(dd, mm, yy, timeZone = 7) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone);
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) lunarLeap = 1;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

function convertLunar2Solar(lunarDay, lunarMonth, lunarYear, lunarLeap = 0, timeZone = 7) {
  let a11;
  let b11;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let off = lunarMonth - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (lunarLeap !== 0 && lunarMonth !== leapMonth) return null;
    if (lunarLeap !== 0 || off >= leapOff) off += 1;
  }
  const monthStart = getNewMoonDay(k + off, timeZone);
  const solar = jdToDate(monthStart + lunarDay - 1);
  return new Date(solar[2], solar[1] - 1, solar[0]);
}

function getLunarInfo(date) {
  return convertSolar2Lunar(date.getDate(), date.getMonth() + 1, date.getFullYear(), 7);
}

function loadSavedEvents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function buildHolidayEvents(date) {
  const solarKey = `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const lunar = getLunarInfo(date);
  const lunarKey = `${pad2(lunar.month)}-${pad2(lunar.day)}`;
  const events = [];

  if (SOLAR_HOLIDAYS[solarKey]) {
    events.push({ id: `solar-${solarKey}`, title: SOLAR_HOLIDAYS[solarKey], type: "holiday", source: "system" });
  }
  if (LUNAR_HOLIDAYS[lunarKey] && !lunar.leap) {
    events.push({ id: `lunar-${lunarKey}`, title: LUNAR_HOLIDAYS[lunarKey], type: "lunar", source: "system" });
  }
  return events;
}

function getTypeLabel(type) {
  if (type === "study") return "Lịch học";
  if (type === "holiday" || type === "lunar") return "Ngày lễ";
  if (type === "birthday") return "Sinh nhật";
  if (type === "death_anniversary") return "Ngày mất";
  if (type === "family") return "Dòng họ";
  return "Lịch trình";
}

function getDayEvents(date, savedEvents) {
  const key = toDateKey(date);
  return [
    ...buildHolidayEvents(date),
    ...savedEvents.filter((item) => item.date === key),
  ];
}

export default function VietnamCalendarPage() {
  const today = useMemo(() => new Date(), []);
  const currentUser = useMemo(() => getStoredUser() || {}, []);
  const currentRole = String(currentUser.role_name || currentUser.role || "").toLowerCase();
  const canCreateGlobal = currentRole === "manager" || currentRole === "admin";

  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState("month");
  const [savedEvents, setSavedEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState("");
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const emptyEventForm = useMemo(
    () => ({
      title: "",
      type: "holiday",
      time: "",
      note: "",
      visibility: canCreateGlobal ? "global" : "personal",
      reminder_days: "1",
    }),
    [canCreateGlobal]
  );
  const [eventForm, setEventForm] = useState(emptyEventForm);

  useEffect(() => {
    setEventForm((current) => ({
      ...current,
      visibility: canCreateGlobal ? current.visibility || "global" : "personal",
    }));
  }, [canCreateGlobal]);

  const visibleDays = useMemo(() => {
    if (viewMode === "week") return getWeekDates(selectedDate);
    return getMonthMatrix(selectedDate.getFullYear(), selectedDate.getMonth());
  }, [selectedDate, viewMode]);

  const range = useMemo(() => {
    const first = visibleDays[0] || selectedDate;
    const last = visibleDays[visibleDays.length - 1] || selectedDate;
    return { from: toDateKey(first), to: toDateKey(last) };
  }, [selectedDate, visibleDays]);

  const loadCalendarEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      const data = await apiRequest(`/api/calendar/events?from=${range.from}&to=${range.to}`);
      setSavedEvents(Array.isArray(data.events) ? data.events : []);
      setCalendarStatus("");
    } catch (error) {
      setCalendarStatus(error?.message || "Không thể tải lịch từ hệ thống.");
      setSavedEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  const selectedLunar = getLunarInfo(selectedDate);
  const selectedEvents = getDayEvents(selectedDate, savedEvents);

  const setDateByInput = (field, value) => {
    const current = selectedDate;
    const nextYear = field === "year" ? Number(value) : current.getFullYear();
    const nextMonth = field === "month" ? Number(value) : current.getMonth();
    const nextDay = field === "day" ? Number(value) : current.getDate();
    const maxDay = new Date(nextYear, nextMonth + 1, 0).getDate();
    setSelectedDate(new Date(nextYear, nextMonth, Math.min(nextDay, maxDay)));
  };

  const shiftPeriod = (amount) => {
    if (viewMode === "week") setSelectedDate(addDays(selectedDate, amount * 7));
    else setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + amount, 1));
  };

  const resetEventForm = () => {
    setEditingEvent(null);
    setEventForm({ ...emptyEventForm });
  };

  const openCreateForm = (template = null) => {
    setEditingEvent(null);
    setEventForm({
      ...emptyEventForm,
      ...(template || {}),
      visibility: canCreateGlobal ? template?.visibility || emptyEventForm.visibility : "personal",
    });
    setShowEventForm(true);
  };

  const openEditForm = (event) => {
    if (!event?.can_edit) {
      setCalendarStatus("Bạn không có quyền chỉnh sửa lịch này.");
      return;
    }

    setEditingEvent(event);
    setSelectedDate(new Date(event.date || event.event_date));
    setEventForm({
      title: event.title || "",
      type: event.type || "holiday",
      time: event.time || event.event_time || "",
      note: event.note || "",
      visibility: canCreateGlobal ? event.visibility || "global" : "personal",
      reminder_days: String(event.reminder_days ?? 1),
    });
    setShowEventForm(true);
  };

  const saveEvent = async (event) => {
    event.preventDefault();
    const title = eventForm.title.trim();
    if (!title) return;

    const payload = {
      date: editingEvent?.date || editingEvent?.event_date || toDateKey(selectedDate),
      title,
      type: eventForm.type,
      time: eventForm.time,
      note: eventForm.note.trim(),
      visibility: canCreateGlobal ? eventForm.visibility : "personal",
      reminder_days: Number(eventForm.reminder_days || 0),
    };

    try {
      setCalendarStatus(editingEvent ? "Đang cập nhật lịch..." : "Đang lưu lịch...");
      if (editingEvent?.id) {
        await apiRequest(`/api/calendar/events/${editingEvent.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/api/calendar/events", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setEventForm({ ...emptyEventForm });
      setEditingEvent(null);
      setShowEventForm(false);
      setCalendarStatus(
        payload.visibility === "global"
          ? "Đã lưu lịch tổng thể. Cả dòng họ sẽ thấy lịch này."
          : "Đã lưu lịch cá nhân. Chỉ tài khoản tạo lịch nhìn thấy lịch này."
      );
      await loadCalendarEvents();
    } catch (error) {
      setCalendarStatus(error?.message || "Không thể lưu lịch.");
    }
  };

  const deleteEvent = async (event) => {
    if (!event?.can_delete) {
      setCalendarStatus("Bạn không có quyền xóa lịch này.");
      return;
    }

    const label = event.visibility === "global" ? "lịch tổng thể" : "lịch cá nhân";
    if (!window.confirm(`Xóa ${label} này?`)) return;

    try {
      await apiRequest(`/api/calendar/events/${event.id}`, { method: "DELETE" });
      setCalendarStatus("Đã xóa lịch.");
      if (editingEvent?.id === event.id) resetEventForm();
      await loadCalendarEvents();
    } catch (error) {
      setCalendarStatus(error?.message || "Không thể xóa lịch.");
    }
  };

  const years = Array.from({ length: 41 }, (_, index) => today.getFullYear() - 20 + index);

  return (
    <div className="vn-calendar-page">
      <section className="vn-calendar-hero">
        <div>
          <span className="vn-eyebrow">Lịch Việt Nam</span>
          <h1>Lịch dương & âm</h1>
          <p>Theo dõi ngày âm, ngày dương, lễ quan trọng, lịch cá nhân và lịch tổng thể của dòng họ.</p>
        </div>
        <div className="vn-hero-date">
          <strong>{pad2(selectedDate.getDate())}</strong>
          <span>{MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}</span>
          <small>Âm lịch: {selectedLunar.day}/{selectedLunar.month}{selectedLunar.leap ? " nhuận" : ""}</small>
        </div>
      </section>

      <section className="vn-calendar-shell">
        <div className="vn-calendar-toolbar">
          <div className="vn-toolbar-left">
            <button type="button" onClick={() => shiftPeriod(-1)} aria-label="Trước">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <div>
              <h2>{viewMode === "week" ? getWeekRangeText(selectedDate) : `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}</h2>
              <p>Hôm nay: {formatVietnamDate(today)}</p>
            </div>
            <button type="button" onClick={() => shiftPeriod(1)} aria-label="Sau">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div className="vn-toolbar-actions">
            <button type="button" className="vn-today-btn" onClick={() => setSelectedDate(today)}>Hôm nay</button>
            <div className="vn-view-toggle" role="group" aria-label="Chọn kiểu xem">
              <button type="button" className={viewMode === "week" ? "active" : ""} onClick={() => setViewMode("week")}>Tuần</button>
              <button type="button" className={viewMode === "month" ? "active" : ""} onClick={() => setViewMode("month")}>Tháng</button>
            </div>
          </div>
        </div>

        <div className="vn-date-controls">
          <label>
            Ngày
            <select value={selectedDate.getDate()} onChange={(event) => setDateByInput("day", event.target.value)}>
              {Array.from({ length: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate() }, (_, index) => (
                <option key={index + 1} value={index + 1}>{index + 1}</option>
              ))}
            </select>
          </label>
          <label>
            Tháng
            <select value={selectedDate.getMonth()} onChange={(event) => setDateByInput("month", event.target.value)}>
              {MONTH_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
            </select>
          </label>
          <label>
            Năm
            <select value={selectedDate.getFullYear()} onChange={(event) => setDateByInput("year", event.target.value)}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>

        {calendarStatus ? <div className="vn-calendar-status">{calendarStatus}</div> : null}
        {loadingEvents ? <div className="vn-calendar-status is-loading">Đang đồng bộ lịch...</div> : null}

        <div className={`vn-calendar-grid ${viewMode === "week" ? "is-week" : ""}`}>
          {WEEKDAY_LABELS.map((label) => <div key={label} className="vn-weekday">{label}</div>)}
          {visibleDays.map((date) => {
            const lunar = getLunarInfo(date);
            const isOutsideMonth = date.getMonth() !== selectedDate.getMonth();
            const isToday = toDateKey(date) === toDateKey(today);
            const isSelected = toDateKey(date) === toDateKey(selectedDate);
            const dayEvents = getDayEvents(date, savedEvents);
            return (
              <button
                key={toDateKey(date)}
                type="button"
                className={`vn-day-cell ${isOutsideMonth ? "is-muted" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
                onClick={() => setSelectedDate(date)}
              >
                <span className="solar-day">{date.getDate()}</span>
                <span className="lunar-day">{lunar.day === 1 ? `${lunar.day}/${lunar.month}` : lunar.day}</span>
                <span className="event-dots">
                  {dayEvents.slice(0, 3).map((event) => <i key={event.id} className={`dot-${event.type}`} />)}
                </span>
                {dayEvents[0] ? <small>{dayEvents[0].title}</small> : null}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="vn-agenda-panel">
        <div className="vn-selected-card">
          <span className="vn-eyebrow">Ngày đang chọn</span>
          <h2>{formatVietnamDate(selectedDate)}</h2>
          <p>{WEEKDAY_LABELS[selectedDate.getDay()]}, âm lịch {selectedLunar.day}/{selectedLunar.month}/{selectedLunar.year}{selectedLunar.leap ? " nhuận" : ""}</p>
        </div>

        <div className="vn-template-row">
          {DEFAULT_EVENT_TEMPLATES.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => openCreateForm({ title: item.title, type: item.type, note: item.note })}
            >
              <span className="material-symbols-outlined">{item.type === "study" ? "school" : item.type === "holiday" ? "celebration" : "diversity_3"}</span>
              {item.title}
            </button>
          ))}
        </div>

        <div className="vn-agenda-header">
          <h3>Lịch trong ngày</h3>
          <button type="button" onClick={() => (showEventForm ? (setShowEventForm(false), resetEventForm()) : openCreateForm())}>
            <span className="material-symbols-outlined">add</span>
            {canCreateGlobal ? "Thêm lịch" : "Thêm lịch cá nhân"}
          </button>
        </div>

        {showEventForm ? (
          <form className="vn-event-form" onSubmit={saveEvent}>
            <div className="vn-form-heading">
              <strong>{editingEvent ? "Chỉnh sửa lịch" : "Tạo lịch mới"}</strong>
              <span>{canCreateGlobal ? "Manager có thể chọn cá nhân hoặc tổng thể" : "Member chỉ tạo lịch cá nhân"}</span>
            </div>
            <input value={eventForm.title} onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} placeholder="Tên ngày lễ / sự kiện quan trọng" />
            <div className="vn-event-form-row">
              <select value={eventForm.type} onChange={(event) => setEventForm((current) => ({ ...current, type: event.target.value }))}>
                <option value="holiday">Ngày lễ quan trọng</option>
                <option value="family">Dòng họ</option>
                <option value="study">Lịch học</option>
                <option value="personal">Lịch trình</option>
              </select>
              <input type="time" value={eventForm.time} onChange={(event) => setEventForm((current) => ({ ...current, time: event.target.value }))} />
            </div>

            <label className="vn-reminder-field">
              Kiểu hiển thị
              <select
                value={eventForm.visibility}
                disabled={!canCreateGlobal}
                onChange={(event) => setEventForm((current) => ({ ...current, visibility: event.target.value }))}
              >
                <option value="personal">Cá nhân - chỉ người tạo nhìn thấy</option>
                <option value="global">Tổng thể - cả dòng họ nhìn thấy</option>
              </select>
              <small>{canCreateGlobal ? "Lịch tổng thể sẽ hiện cho mọi thành viên cùng dòng họ." : "Tài khoản member chỉ được tạo lịch cá nhân của mình."}</small>
            </label>

            <label className="vn-reminder-field">
              Nhắc trước
              <select value={eventForm.reminder_days} onChange={(event) => setEventForm((current) => ({ ...current, reminder_days: event.target.value }))}>
                <option value="0">Đúng ngày</option>
                <option value="1">Trước 1 ngày</option>
                <option value="2">Trước 2 ngày</option>
                <option value="3">Trước 3 ngày</option>
                <option value="7">Trước 7 ngày</option>
                <option value="14">Trước 14 ngày</option>
                <option value="30">Trước 30 ngày</option>
              </select>
              <small>Đến hạn nhắc, hệ thống tạo thông báo trên web và gửi Gmail/SMTP cho người được thấy lịch nếu đã cấu hình email.</small>
            </label>
            <textarea value={eventForm.note} onChange={(event) => setEventForm((current) => ({ ...current, note: event.target.value }))} placeholder="Ghi chú" rows={3} />
            <div className="vn-event-actions">
              <button type="button" onClick={() => { setShowEventForm(false); resetEventForm(); }}>Hủy</button>
              <button type="submit">{editingEvent ? "Lưu chỉnh sửa" : "Lưu lịch"}</button>
            </div>
          </form>
        ) : null}

        <div className="vn-event-list">
          {selectedEvents.length === 0 ? (
            <p className="vn-empty">Ngày này chưa có lịch trình.</p>
          ) : (
            selectedEvents.map((event) => (
              <div key={event.id} className={`vn-event-item type-${event.type}`}>
                <div>
                  <span>{getTypeLabel(event.type)}{event.time ? ` • ${event.time}` : ""}</span>
                  <strong>{event.title}</strong>
                  {event.source !== "system" ? (
                    <span className={`vn-scope-badge ${event.visibility === "global" ? "is-global" : "is-personal"}`}>
                      {event.visibility === "global" ? "Tổng thể" : "Cá nhân"}
                    </span>
                  ) : null}
                  {event.type === "death_anniversary" && event.original_lunar_date ? (
                    <small>Ngày mất âm lịch gốc: {event.original_lunar_date}</small>
                  ) : null}
                  {event.type === "death_anniversary" && event.anniversary_lunar_date ? (
                    <small>Ngày giỗ âm lịch năm này: {event.anniversary_lunar_date}</small>
                  ) : null}
                  {event.type === "birthday" && event.lunar_date ? (
                    <small>Ngày sinh âm lịch năm này: {event.lunar_date}</small>
                  ) : null}
                  {event.reminder_days != null && event.source !== "system" ? <em>Nhắc trước {Number(event.reminder_days) === 0 ? "đúng ngày" : `${event.reminder_days} ngày`}</em> : null}
                  {event.creator_name ? <small>Người tạo: {event.creator_name}</small> : null}
                  {event.note ? <p>{event.note}</p> : null}
                </div>
                {event.source !== "system" && (event.can_edit || event.can_delete) ? (
                  <div className="vn-event-item-actions">
                    {event.can_edit ? (
                      <button type="button" onClick={() => openEditForm(event)} title="Sửa lịch">
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                    ) : null}
                    {event.can_delete ? (
                      <button type="button" onClick={() => deleteEvent(event)} title="Xóa lịch">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
