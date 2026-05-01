import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getVoiceRecordingAudioUrl,
  getVoiceRecordings,
  retryVoiceRecording,
  updateVoiceTranscript,
  uploadVoiceRecording,
} from "../../api/voiceService";
import "./TimeCapsulePage.css";

const MAX_SECONDS = 180;

function pickMimeType() {
  if (!window.MediaRecorder) return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
}

function formatDate(value) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function getStatusLabel(status) {
  if (status === "completed") return "Đã lưu ký ức";
  if (status === "transcribing") return "Đang chuyển chữ";
  if (status === "failed") return "Cần xử lý lại";
  return "Đã nhận ghi âm";
}

export default function TimeCapsulePage({ role = "member" }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [recorderState, setRecorderState] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [savingTranscriptId, setSavingTranscriptId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);

  const loadRecordings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const result = await getVoiceRecordings(80);
      setRecordings(result.recordings || []);
    } catch (err) {
      setError(err?.message || "Không thể tải danh sách viên nang thời gian.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  useEffect(() => {
    const hasPending = recordings.some((item) => item.status === "uploaded" || item.status === "transcribing");
    if (!hasPending) return undefined;
    const poller = window.setInterval(() => loadRecordings(true), 3000);
    return () => window.clearInterval(poller);
  }, [loadRecordings, recordings]);

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stats = useMemo(() => {
    const completed = recordings.filter((item) => item.status === "completed").length;
    const processing = recordings.filter((item) => item.status === "uploaded" || item.status === "transcribing").length;
    const totalSeconds = recordings.reduce((sum, item) => sum + (Number(item.duration_seconds) || 0), 0);
    return { completed, processing, totalSeconds };
  }, [recordings]);

  const stopTimer = () => {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const uploadBlob = async (blob) => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    setRecorderState("uploading");
    setStatus("Đang gửi viên nang thời gian...");
    setError("");

    await uploadVoiceRecording(blob, {
      durationSeconds,
      filename: `vien-nang-thoi-gian-${Date.now()}.webm`,
    });

    setRecorderState("idle");
    setSeconds(0);
    setStatus("Đã nhận ghi âm. Worker sẽ chuyển thành transcript trong ít phút.");
    await loadRecordings(true);
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("Trình duyệt này chưa hỗ trợ ghi âm trực tiếp.");
      }

      setStatus("");
      setError("");
      setSeconds(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stopTimer();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size <= 0) {
          setRecorderState("idle");
          setError("Không có dữ liệu ghi âm.");
          return;
        }

        uploadBlob(blob).catch((err) => {
          setRecorderState("idle");
          setError(err?.message || "Không thể lưu viên nang thời gian.");
        });
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setRecorderState("recording");

      timerRef.current = window.setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS && recorder.state === "recording") {
          recorder.stop();
        }
      }, 500);
    } catch (err) {
      setRecorderState("idle");
      setError(err?.message || "Không thể bắt đầu ghi âm.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const startEditTranscript = (recording) => {
    setEditingId(recording.id);
    setTranscriptDraft(recording.transcript || "");
    setError("");
    setStatus("");
  };

  const cancelEditTranscript = () => {
    setEditingId(null);
    setTranscriptDraft("");
  };

  const saveTranscript = async (recordingId) => {
    const nextTranscript = transcriptDraft.trim();
    if (!nextTranscript) {
      setError("Transcript không được để trống.");
      return;
    }

    try {
      setSavingTranscriptId(recordingId);
      setError("");
      const result = await updateVoiceTranscript(recordingId, nextTranscript);
      setRecordings((items) =>
        items.map((item) => (item.id === recordingId ? { ...item, ...(result.recording || {}) } : item))
      );
      setStatus("Đã lưu transcript.");
      cancelEditTranscript();
    } catch (err) {
      setError(err?.message || "Không thể lưu transcript.");
    } finally {
      setSavingTranscriptId(null);
    }
  };

  const retryRecording = async (recordingId) => {
    try {
      setRetryingId(recordingId);
      setError("");
      const result = await retryVoiceRecording(recordingId);
      setRecordings((items) =>
        items.map((item) => (item.id === recordingId ? { ...item, ...(result.recording || {}) } : item))
      );
      setStatus("Đã đưa bản ghi vào hàng đợi xử lý lại.");
      await loadRecordings(true);
    } catch (err) {
      setError(err?.message || "Không thể xử lý lại ghi âm.");
    } finally {
      setRetryingId(null);
    }
  };

  const busy = recorderState === "recording" || recorderState === "uploading";
  const isManager = role === "manager";

  return (
    <div className="time-capsule-page">
      <section className="time-capsule-header">
        <div>
          <span className="time-capsule-kicker">Viên nang thời gian</span>
          <h2>Lưu lại ký ức bằng giọng nói</h2>
          <p>
            {isManager
              ? "Quản lý có thể theo dõi các bản ghi trong dòng họ và dùng transcript để lưu giữ tư liệu."
              : "Ghi lại lời kể, kỷ niệm, gia thoại hoặc lời nhắn cho thế hệ sau."}
          </p>
        </div>
        <button type="button" className="time-capsule-refresh" onClick={() => loadRecordings()} disabled={loading}>
          <span className="material-symbols-outlined">refresh</span>
          Tải lại
        </button>
      </section>

      {(error || status) && <div className={`time-capsule-alert ${error ? "is-error" : "is-success"}`}>{error || status}</div>}

      <section className="time-capsule-workbench">
        <div className="time-capsule-recorder">
          <div className={`time-capsule-orb is-${recorderState}`}>
            <span className="material-symbols-outlined">{recorderState === "recording" ? "graphic_eq" : "mic"}</span>
          </div>
          <div>
            <h3>{recorderState === "recording" ? "Đang ghi âm" : "Tạo viên nang mới"}</h3>
            <p>{recorderState === "recording" ? `${formatDuration(seconds)} / ${formatDuration(MAX_SECONDS)}` : "Mỗi bản ghi tối đa 3 phút."}</p>
          </div>
          <div className="time-capsule-actions">
            {recorderState === "recording" ? (
              <button type="button" className="time-capsule-danger" onClick={stopRecording}>
                <span className="material-symbols-outlined">stop_circle</span>
                Dừng và lưu
              </button>
            ) : (
              <button type="button" className="time-capsule-primary" onClick={startRecording} disabled={busy}>
                <span className="material-symbols-outlined">radio_button_checked</span>
                {recorderState === "uploading" ? "Đang lưu..." : "Bắt đầu ghi"}
              </button>
            )}
          </div>
        </div>

        <div className="time-capsule-stats">
          <div>
            <strong>{recordings.length}</strong>
            <span>Tổng viên nang</span>
          </div>
          <div>
            <strong>{stats.completed}</strong>
            <span>Đã có transcript</span>
          </div>
          <div>
            <strong>{stats.processing}</strong>
            <span>Đang xử lý</span>
          </div>
          <div>
            <strong>{formatDuration(stats.totalSeconds)}</strong>
            <span>Thời lượng</span>
          </div>
        </div>
      </section>

      <section className="time-capsule-list">
        <div className="time-capsule-list-head">
          <h3>{isManager ? "Viên nang trong dòng họ" : "Viên nang của tôi"}</h3>
          <span>{loading ? "Đang tải..." : `${recordings.length} bản ghi`}</span>
        </div>

        {recordings.length === 0 && !loading ? (
          <div className="time-capsule-empty">
            <span className="material-symbols-outlined">history_edu</span>
            <p>Chưa có viên nang thời gian nào.</p>
          </div>
        ) : (
          <div className="time-capsule-items">
            {recordings.map((item) => (
              <article className="time-capsule-item" key={item.id}>
                <div className="time-capsule-item-main">
                  <div className={`time-capsule-status-dot is-${item.status}`} />
                  <div>
                    <h4>Viên nang #{item.id}</h4>
                    <p>{formatDate(item.created_at)}</p>
                  </div>
                </div>
                <div className="time-capsule-item-meta">
                  <span className={`time-capsule-badge is-${item.status}`}>{getStatusLabel(item.status)}</span>
                  <span>{formatDuration(item.duration_seconds)}</span>
                  {item.transcript_edited ? <span>Đã sửa transcript</span> : null}
                </div>
                {item.status === "failed" && <p className="time-capsule-error">{item.error_message || "Worker xử lý thất bại."}</p>}
                <audio className="time-capsule-audio" controls src={getVoiceRecordingAudioUrl(item.id)} />
                {editingId === item.id ? (
                  <div className="time-capsule-editor">
                    <textarea
                      value={transcriptDraft}
                      onChange={(event) => setTranscriptDraft(event.target.value)}
                      maxLength={50000}
                    />
                    <div className="time-capsule-inline-actions">
                      <button
                        type="button"
                        className="time-capsule-primary"
                        onClick={() => saveTranscript(item.id)}
                        disabled={savingTranscriptId === item.id}
                      >
                        Lưu
                      </button>
                      <button type="button" className="time-capsule-secondary" onClick={cancelEditTranscript}>
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  item.transcript && <div className="time-capsule-transcript">{item.transcript}</div>
                )}
                <div className="time-capsule-inline-actions">
                  {item.transcript && editingId !== item.id ? (
                    <button type="button" className="time-capsule-secondary" onClick={() => startEditTranscript(item)}>
                      Sửa transcript
                    </button>
                  ) : null}
                  {item.status === "failed" ? (
                    <button
                      type="button"
                      className="time-capsule-secondary"
                      onClick={() => retryRecording(item.id)}
                      disabled={retryingId === item.id}
                    >
                      {retryingId === item.id ? "Đang đưa vào hàng đợi..." : "Xử lý lại"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
