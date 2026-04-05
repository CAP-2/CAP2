import React, { useState, useRef } from "react";
import { uploadImage } from "../../api/memberService";
import "./ImageUpload.css";

const ImageUpload = ({ onUploadSuccess, label = "Tải ảnh lên" }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn tệp hình ảnh (.jpg, .png, ...)");
      return;
    }

    setLoading(true);
    setError("");
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUrlInput(""); // Clear URL input if file is picked

    try {
      const result = await uploadImage(file);
      if (result.success) {
        onUploadSuccess(result.url);
      } else {
        setError(result.message || "Tải ảnh thất bại");
      }
    } catch (err) {
      setError(err.message || "Lỗi khi tải ảnh lên");
    } finally {
      setLoading(false);
    }
  };

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setUrlInput(val);
    if (val.trim()) {
      setPreview(val.trim());
      onUploadSuccess(val.trim());
    } else {
      setPreview(null);
      onUploadSuccess("");
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div className="image-upload-container">
      <div className="upload-options">
        <div
          className={`upload-dropzone ${isDragging ? "dragging" : ""} ${preview ? "has-preview" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={(e) => handleFile(e.target.files[0])}
            accept="image/*"
          />
          {preview ? (
            <div className="preview-container">
              <img src={preview} alt="Preview" className="image-preview" onError={() => setError("URL ảnh không hợp lệ")} />
              <div className="preview-overlay">
                <span>Thay đổi ảnh</span>
              </div>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="upload-icon">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
                </svg>
              </div>
              <p>{label}</p>
              <span className="upload-hint">Kéo thả hoặc nhấp để chọn</span>
            </div>
          )}
          {loading && <div className="upload-loader">Đang tải...</div>}
        </div>
        
        <div className="url-input-wrapper">
          <span className="url-sep">hoặc dán URL:</span>
          <input 
            type="text" 
            className="url-field" 
            placeholder="https://example.com/image.jpg"
            value={urlInput}
            onChange={handleUrlChange}
          />
        </div>
      </div>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
};

export default ImageUpload;
