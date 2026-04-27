import { useEffect, useRef, useState } from "react";
import { uploadImage } from "../../api/memberService";
import "./ImageUpload.css";

const ImageUpload = ({ onUploadSuccess, label = "Tai anh len", value = "", disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    const nextValue = String(value || "").trim();
    setUrlInput(nextValue);
    setPreview(nextValue || null);
  }, [value]);

  const handleFile = async (file) => {
    if (!file || disabled) return;
    if (!file.type.startsWith("image/")) {
      setError("Vui long chon tep hinh anh (.jpg, .png, ...)");
      return;
    }

    setLoading(true);
    setError("");
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUrlInput("");

    try {
      const result = await uploadImage(file);
      if (result.success) {
        onUploadSuccess?.(result.url || result.imageUrl || "");
      } else {
        setError(result.message || "Tai anh that bai");
      }
    } catch (err) {
      setError(err.message || "Loi khi tai anh len");
    } finally {
      setLoading(false);
    }
  };

  const handleUrlChange = (event) => {
    const nextValue = event.target.value;
    setUrlInput(nextValue);
    if (nextValue.trim()) {
      setPreview(nextValue.trim());
      onUploadSuccess?.(nextValue.trim());
    } else {
      setPreview(null);
      onUploadSuccess?.("");
    }
  };

  const clearImage = (event) => {
    event.stopPropagation();
    setPreview(null);
    setUrlInput("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onUploadSuccess?.("");
  };

  return (
    <div className="image-upload-container">
      <div className="upload-options">
        <div
          className={`upload-dropzone ${isDragging ? "dragging" : ""} ${preview ? "has-preview" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFile(event.dataTransfer.files[0]);
          }}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={(event) => handleFile(event.target.files[0])}
            accept="image/*"
            disabled={disabled || loading}
          />

          {preview ? (
            <div className="preview-container">
              <img src={preview} alt="" className="image-preview" onError={() => setError("URL anh khong hop le")} />
              <div className="preview-overlay">
                <span>Thay doi anh</span>
              </div>
              <button className="preview-clear" type="button" onClick={clearImage} disabled={disabled || loading}>
                Xoa
              </button>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="upload-icon">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
                </svg>
              </div>
              <p>{label}</p>
              <span className="upload-hint">Keo tha hoac nhap de chon file</span>
            </div>
          )}

          {loading && <div className="upload-loader">Dang tai...</div>}
        </div>

        <div className="url-input-wrapper">
          <span className="url-sep">hoac dan URL:</span>
          <input
            type="text"
            className="url-field"
            placeholder="https://example.com/image.jpg"
            value={urlInput}
            onChange={handleUrlChange}
            disabled={disabled || loading}
          />
        </div>
      </div>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
};

export default ImageUpload;
