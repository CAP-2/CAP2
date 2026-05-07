import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../services/api";
import { formatDateTimeVN } from "../../utils/dateFormat";
import "./TimeCapsulePage.css";

const emptyForm = {
  title: "",
  content: "",
  media_id: null,
  media_url: "",
  media_type: "text",
  mime_type: "",
  original_filename: "",
};

function getStatusLabel(status) {
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Từ chối";
  return "Chờ duyệt";
}

function getMediaKind(fileOrMemory) {
  const mime = String(fileOrMemory?.type || fileOrMemory?.mime_type || "").toLowerCase();
  const explicit = String(fileOrMemory?.media_type || "").toLowerCase();
  if (explicit === "image" || mime.startsWith("image/")) return "image";
  if (explicit === "video" || mime.startsWith("video/")) return "video";
  if (explicit === "audio" || mime.startsWith("audio/")) return "audio";
  return "text";
}

function MemoryMedia({ memory }) {
  const url = memory.media_url || (memory.media_id ? `/api/media/${memory.media_id}` : "");
  if (!url) return null;
  const kind = getMediaKind(memory);
  if (kind === "image") return <img className="memory-media" src={url} alt={memory.title || "Kỉ niệm"} />;
  if (kind === "video") return <video className="memory-media" src={url} controls preload="metadata" />;
  if (kind === "audio") return <audio className="memory-audio" src={url} controls />;
  return (
    <a className="memory-file-link" href={url} target="_blank" rel="noreferrer">
      <span className="material-symbols-outlined">attach_file</span>
      {memory.original_filename || "Mở tệp đính kèm"}
    </a>
  );
}

function MemoryCard({ memory, isManagerView = false }) {
  return (
    <article className={`memory-card is-${memory.status || "approved"}`}>
      <div className="memory-card-head">
        <div className="memory-author-avatar">
          {(memory.author_name || "K").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h3>{memory.title || "Kỉ niệm dòng họ"}</h3>
          <p>
            {memory.author_name || "Thành viên dòng họ"} • {memory.created_at ? formatDateTimeVN(memory.created_at) : "Chưa cập nhật"}
          </p>
        </div>
        <span className={`memory-status is-${memory.status || "approved"}`}>{getStatusLabel(memory.status)}</span>
      </div>
      {memory.content && <p className="memory-content">{memory.content}</p>}
      <MemoryMedia memory={memory} />
      {memory.status === "pending" && !isManagerView && (
        <div className="memory-note">Kỉ niệm này đang chờ trưởng họ duyệt trước khi hiển thị công khai.</div>
      )}
      {memory.status === "rejected" && memory.rejection_reason && (
        <div className="memory-note is-rejected">Lý do từ chối: {memory.rejection_reason}</div>
      )}
    </article>
  );
}

export default function TimeCapsulePage({ role = "member" }) {
  const isManager = role === "manager" || role === "admin";
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [filePreview, setFilePreview] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [captureMode, setCaptureMode] = useState("none");
  const [cameraStream, setCameraStream] = useState(null);
  const [recorderState, setRecorderState] = useState("idle");
  const [cameraError, setCameraError] = useState("");
  const liveVideoRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/api/member/memories?includeOwnPending=1");
      setMemories(result.memories || []);
    } catch (err) {
      setError(err?.message || "Không thể tải kỉ niệm dòng họ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  useEffect(() => {
    if (liveVideoRef.current && cameraStream) {
      liveVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, captureMode]);

  useEffect(() => {
    return () => {
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
      if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, [filePreview?.url, cameraStream]);

  const stats = useMemo(() => {
    const approved = memories.filter((item) => item.status === "approved").length;
    const pending = memories.filter((item) => item.status === "pending").length;
    const media = memories.filter((item) => item.media_id || item.media_url).length;
    return { approved, pending, media };
  }, [memories]);

  const visibleMemories = useMemo(() => {
    if (filter === "all") return memories;
    return memories.filter((item) => item.status === filter);
  }, [filter, memories]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setMessage("");
  };

  const uploadMemoryBlob = async (blob, filename) => {
    if (!blob) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const file = blob instanceof File ? blob : new File([blob], filename, { type: blob.type || "application/octet-stream" });
      const data = new FormData();
      data.append("file", file);
      const result = await apiRequest("/api/upload-memory-media", {
        method: "POST",
        body: data,
      });
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
      const previewUrl = URL.createObjectURL(file);
      setFilePreview({ url: previewUrl, kind: getMediaKind(file), name: file.name });
      setForm((prev) => ({
        ...prev,
        media_id: result.media_id || result.mediaId,
        media_url: result.url || result.mediaUrl || "",
        media_type: getMediaKind(file),
        mime_type: file.type,
        original_filename: file.name,
      }));
      setMessage("Đã lưu tệp kỉ niệm vào database. Bạn có thể gửi kỉ niệm để chờ duyệt.");
    } catch (err) {
      setError(err?.message || "Không thể tải tệp kỉ niệm.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadMemoryBlob(file, file.name);
    event.target.value = "";
  };

  const stopCameraStream = () => {
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCaptureMode("none");
    setRecorderState("idle");
    setCameraError("");
  };

  const openCamera = async (mode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Trình duyệt hoặc thiết bị này chưa hỗ trợ mở camera/micro trực tiếp.");
      return;
    }
    try {
      if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
      setCameraError("");
      const constraints = mode === "photo"
        ? { video: { facingMode: "environment" }, audio: false }
        : { video: { facingMode: "environment" }, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setCaptureMode(mode);
      setRecorderState("idle");
    } catch (err) {
      setCameraError("Không thể mở camera. Hãy kiểm tra quyền camera/micro của trình duyệt.");
    }
  };

  const capturePhoto = async () => {
    const video = liveVideoRef.current;
    if (!video) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, width, height);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError("Không thể chụp ảnh từ camera.");
        return;
      }
      await uploadMemoryBlob(blob, `ky-niem-${Date.now()}.jpg`);
      stopCameraStream();
    }, "image/jpeg", 0.92);
  };

  const pickRecorderMimeType = (mode) => {
    const candidates = mode === "audio"
      ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  };

  const startRecordingWithStream = (stream, mode) => {
    if (!window.MediaRecorder) {
      setCameraError("Trình duyệt chưa hỗ trợ ghi âm/quay video trực tiếp.");
      return;
    }
    recordedChunksRef.current = [];
    const mimeType = pickRecorderMimeType(mode);
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      const blobType = recorder.mimeType || (mode === "audio" ? "audio/webm" : "video/webm");
      const blob = new Blob(recordedChunksRef.current, { type: blobType });
      const extension = blobType.includes("mp4") ? "mp4" : "webm";
      await uploadMemoryBlob(blob, `ky-niem-${mode === "audio" ? "ghi-am" : "video"}-${Date.now()}.${extension}`);
      stream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setCaptureMode("none");
      setRecorderState("idle");
    };
    recorder.start();
    setRecorderState("recording");
  };

  const startVideoRecording = () => {
    if (!cameraStream) return;
    startRecordingWithStream(cameraStream, "video");
  };

  const startAudioRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Trình duyệt hoặc thiết bị này chưa hỗ trợ ghi âm trực tiếp.");
      return;
    }
    try {
      if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setCameraStream(stream);
      setCaptureMode("audio");
      startRecordingWithStream(stream, "audio");
    } catch (err) {
      setCameraError("Không thể mở micro. Hãy kiểm tra quyền micro của trình duyệt.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      setRecorderState("stopping");
    }
  };

  const removeAttachedMedia = () => {
    if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
    setFilePreview(null);
    setForm((prev) => ({
      ...prev,
      media_id: null,
      media_url: "",
      media_type: "text",
      mime_type: "",
      original_filename: "",
    }));
    setMessage("");
    setError("");
  };

  const resetForm = () => {
    setForm(emptyForm);
    removeAttachedMedia();
    stopCameraStream();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const hasText = form.title.trim() || form.content.trim();
    if (!hasText && !form.media_id && !form.media_url) {
      setError("Vui lòng nhập nội dung hoặc tải ảnh/video/ghi âm.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest("/api/member/memories", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMessage(result.message || "Đã gửi kỉ niệm dòng họ.");
      resetForm();
      await loadMemories();
    } catch (err) {
      setError(err?.message || "Không thể gửi kỉ niệm dòng họ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="time-capsule-page memory-page">
      <section className="time-capsule-header memory-hero">
        <div>
          <span className="time-capsule-kicker">Kỉ niệm dòng họ</span>
          <h2>Kỉ niệm dòng họ</h2>
          <p>
            Lưu giữ câu chuyện, hình ảnh, video và ghi âm của dòng họ. Thành viên gửi kỉ niệm sẽ chờ trưởng họ duyệt trước khi đăng công khai.
          </p>
        </div>
        <button type="button" className="time-capsule-refresh" onClick={loadMemories} disabled={loading}>
          <span className="material-symbols-outlined">refresh</span>
          Tải lại
        </button>
      </section>

      {(error || message) && <div className={`time-capsule-alert ${error ? "is-error" : "is-success"}`}>{error || message}</div>}

      <section className="memory-workbench">
        <form className="memory-form" onSubmit={handleSubmit}>
          <div className="memory-form-head">
            <div>
              <h3>Đăng kỉ niệm</h3>
              <p>{isManager ? "Kỉ niệm của trưởng họ được đăng ngay." : "Kỉ niệm của thành viên sẽ gửi vào hàng chờ duyệt."}</p>
            </div>
            <span className="memory-form-badge">Ảnh • Video • Ghi âm</span>
          </div>

          <label className="memory-field">
            <span>Tiêu đề</span>
            <input value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="Ví dụ: Họp mặt đầu xuân, kỉ niệm gia đình..." />
          </label>

          <label className="memory-field">
            <span>Nội dung</span>
            <textarea rows={5} value={form.content} onChange={(event) => updateField("content", event.target.value)} placeholder="Chia sẻ câu chuyện hoặc lời nhắn đi kèm kỉ niệm..." />
          </label>

          <div className="memory-capture-tools">
            <label className="memory-upload-box">
              <input type="file" accept="image/*,video/*,audio/*" onChange={handleFileChange} disabled={uploading || submitting} />
              <span className="material-symbols-outlined">upload_file</span>
              <strong>{uploading ? "Đang tải lên..." : "Tải tệp từ máy"}</strong>
              <small>Chọn ảnh, video hoặc audio đã có sẵn.</small>
            </label>

            <button type="button" className="memory-capture-button" onClick={() => openCamera("photo")} disabled={uploading || submitting || recorderState === "recording"}>
              <span className="material-symbols-outlined">photo_camera</span>
              <strong>Chụp ảnh</strong>
              <small>Mở camera thiết bị để chụp trực tiếp.</small>
            </button>

            <button type="button" className="memory-capture-button" onClick={() => openCamera("video")} disabled={uploading || submitting || recorderState === "recording"}>
              <span className="material-symbols-outlined">videocam</span>
              <strong>Quay video</strong>
              <small>Quay video trực tiếp từ camera.</small>
            </button>

            <button type="button" className={`memory-capture-button ${recorderState === "recording" && captureMode === "audio" ? "is-recording" : ""}`} onClick={recorderState === "recording" && captureMode === "audio" ? stopRecording : startAudioRecording} disabled={uploading || submitting || recorderState === "stopping" || (recorderState === "recording" && captureMode !== "audio")}>
              <span className="material-symbols-outlined">mic</span>
              <strong>{recorderState === "recording" && captureMode === "audio" ? "Dừng ghi âm" : "Ghi âm trực tiếp"}</strong>
              <small>Chỉ lưu file âm thanh, không chuyển giọng nói thành văn bản.</small>
            </button>
          </div>

          {(captureMode === "photo" || captureMode === "video") && cameraStream ? (
            <div className="memory-live-capture">
              <video ref={liveVideoRef} autoPlay muted playsInline />
              <div className="memory-live-actions">
                {captureMode === "photo" ? (
                  <button type="button" className="time-capsule-primary" onClick={capturePhoto} disabled={uploading || submitting}>Chụp ảnh này</button>
                ) : recorderState === "recording" ? (
                  <button type="button" className="time-capsule-danger" onClick={stopRecording}>Dừng quay video</button>
                ) : (
                  <button type="button" className="time-capsule-primary" onClick={startVideoRecording} disabled={uploading || submitting}>Bắt đầu quay</button>
                )}
                <button type="button" className="time-capsule-secondary" onClick={stopCameraStream} disabled={uploading || recorderState === "stopping"}>Đóng camera</button>
              </div>
            </div>
          ) : null}

          {captureMode === "audio" && recorderState === "recording" ? (
            <div className="memory-recording-strip">
              <span className="memory-recording-dot" />
              Đang ghi âm trực tiếp từ micro...
            </div>
          ) : null}

          {cameraError ? <div className="memory-camera-error">{cameraError}</div> : null}

          {filePreview && (
            <div className="memory-preview">
              {filePreview.kind === "image" && <img src={filePreview.url} alt="Xem trước" />}
              {filePreview.kind === "video" && <video src={filePreview.url} controls />}
              {filePreview.kind === "audio" && <audio src={filePreview.url} controls />}
              <div className="memory-preview-footer">
                <span>{filePreview.name}</span>
                <button type="button" onClick={removeAttachedMedia} disabled={submitting || uploading}>Xóa tệp</button>
              </div>
            </div>
          )}

          <div className="memory-actions">
            <button type="button" className="time-capsule-secondary" onClick={resetForm} disabled={submitting || uploading}>Xóa form</button>
            <button type="submit" className="time-capsule-primary" disabled={submitting || uploading}>{submitting ? "Đang gửi..." : "Gửi kỉ niệm"}</button>
          </div>
        </form>

        <aside className="memory-stats-panel">
          <div><strong>{stats.approved}</strong><span>Kỉ niệm đã duyệt</span></div>
          <div><strong>{stats.pending}</strong><span>Đang chờ duyệt</span></div>
          <div><strong>{stats.media}</strong><span>Có tệp đính kèm</span></div>
        </aside>
      </section>

      <section className="time-capsule-list memory-list-section">
        <div className="time-capsule-list-head">
          <div>
            <h3>Kỉ niệm đã lưu</h3>
            <span>Hiển thị kỉ niệm đã duyệt và kỉ niệm của chính bạn đang chờ duyệt.</span>
          </div>
          <div className="memory-filter-group">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tất cả</button>
            <button className={filter === "approved" ? "active" : ""} onClick={() => setFilter("approved")}>Đã duyệt</button>
            <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Chờ duyệt</button>
          </div>
        </div>

        {loading ? (
          <div className="time-capsule-empty">Đang tải kỉ niệm...</div>
        ) : visibleMemories.length === 0 ? (
          <div className="time-capsule-empty">Chưa có kỉ niệm nào.</div>
        ) : (
          <div className="memory-feed">
            {visibleMemories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}
          </div>
        )}
      </section>
    </div>
  );
}
