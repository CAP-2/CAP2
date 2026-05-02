const crypto = require("crypto");
const fs = require("fs");
const { createRequire } = require("module");
const path = require("path");

const db = require("../Backend/src/config/db");
const { verifyToken, checkRole } = require("../Backend/src/middleware/authMiddleware");

const backendRequire = createRequire(path.resolve(__dirname, "..", "Backend", "package.json"));
const express = backendRequire("express");
const multer = backendRequire("multer");

const router = express.Router();

const BACKEND_DIR = path.resolve(__dirname, "..", "Backend");
const STORAGE_ROOT = process.env.VOICE_STORAGE_ROOT
  ? path.resolve(process.env.VOICE_STORAGE_ROOT)
  : path.join(BACKEND_DIR, "storage");
const RECORDINGS_DIR = path.join(STORAGE_ROOT, "recordings");
const MAX_DURATION_SECONDS = Number(process.env.VOICE_MAX_DURATION_SECONDS || 180);
const MAX_FILE_MB = Number(process.env.VOICE_MAX_FILE_MB || 25);
const MAX_FILE_BYTES = Math.max(1, MAX_FILE_MB) * 1024 * 1024;
let schemaReadyPromise = null;

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

const MIME_TO_EXT = {
  "audio/webm": ".webm",
  "video/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
};

const getSafeExtension = (file) => {
  const originalExt = path.extname(file.originalname || "").toLowerCase();
  const allowedExts = new Set([".webm", ".ogg", ".wav", ".mp3", ".m4a", ".aac"]);
  if (allowedExts.has(originalExt)) return originalExt;
  return MIME_TO_EXT[file.mimetype] || ".webm";
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RECORDINGS_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${getSafeExtension(file)}`),
  }),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    if (MIME_TO_EXT[mime] || mime.startsWith("audio/")) {
      cb(null, true);
      return;
    }
    cb(new Error("File ghi am khong dung dinh dang audio."));
  },
});

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
};

const ensureVoiceSchema = () => {
  if (!schemaReadyPromise) {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    schemaReadyPromise = (async () => {
      await db.query(schemaSql);
      const [columns] = await db.query("SHOW COLUMNS FROM recordings");
      const existingColumns = new Set(columns.map((column) => column.Field));
      const migrations = [
        ["processing_started_at", "ALTER TABLE recordings ADD COLUMN processing_started_at TIMESTAMP NULL AFTER status"],
        ["transcript_edited", "ALTER TABLE recordings ADD COLUMN transcript_edited TINYINT(1) NOT NULL DEFAULT 0 AFTER transcript"],
        ["transcript_edited_at", "ALTER TABLE recordings ADD COLUMN transcript_edited_at TIMESTAMP NULL AFTER transcript_edited"],
        ["transcribed_at", "ALTER TABLE recordings ADD COLUMN transcribed_at TIMESTAMP NULL AFTER transcript_edited_at"],
      ];

      for (const [columnName, statement] of migrations) {
        if (!existingColumns.has(columnName)) {
          await db.query(statement);
        }
      }
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
};

const resolveStoragePath = (storagePath) => {
  const resolved = path.isAbsolute(storagePath)
    ? path.resolve(storagePath)
    : path.resolve(STORAGE_ROOT, storagePath);
  const storageRootWithSep = STORAGE_ROOT.endsWith(path.sep) ? STORAGE_ROOT : `${STORAGE_ROOT}${path.sep}`;
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(storageRootWithSep)) {
    throw new Error("Duong dan file ghi am khong hop le.");
  }
  return resolved;
};

const getRecordingById = async (id) => {
  const [rows] = await db.query(
    `
      SELECT id, account_id, person_id, clan_id, original_filename, storage_path, mime_type,
             duration_seconds, file_size_bytes, status, transcript, transcript_edited,
             transcript_edited_at, transcribed_at, processing_started_at, error_message,
             created_at, updated_at
      FROM recordings
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
};

const getAccountContext = async (accountId) => {
  await ensureVoiceSchema();
  const [rows] = await db.query(
    `
      SELECT
        a.id AS account_id,
        a.person_id,
        a.role_id,
        COALESCE(p.clan_id, ac.clan_id) AS clan_id
      FROM accounts a
      LEFT JOIN people p ON p.id = a.person_id
      LEFT JOIN account_clans ac ON ac.account_id = a.id AND ac.status = 'active'
      WHERE a.id = ?
      ORDER BY ac.id ASC
      LIMIT 1
    `,
    [accountId]
  );
  return rows[0] || null;
};

const canReadRecording = async (req, recording) => {
  if (!recording) return false;
  if (Number(req.user?.role_id) === 1 || req.user?.role_name === "admin") return true;
  if (Number(recording.account_id) === Number(req.user?.id)) return true;

  if (req.user?.role_name === "manager" && recording.clan_id) {
    const ctx = await getAccountContext(req.user.id);
    return Number(ctx?.clan_id) === Number(recording.clan_id);
  }

  return false;
};

router.use((req, _res, next) => {
  const token = typeof req.query?.token === "string" ? req.query.token : "";
  if (req.method === "GET" && /\/recordings\/\d+\/audio$/.test(req.path) && token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${token}`;
  }
  next();
});

router.use(verifyToken, checkRole(["admin", "manager", "member"]));

router.post("/recordings", upload.single("audio"), async (req, res) => {
  try {
    await ensureVoiceSchema();

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Khong co file ghi am." });
    }

    const durationSeconds = parsePositiveInt(req.body?.duration_seconds);
    if (durationSeconds && durationSeconds > MAX_DURATION_SECONDS) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: `Ban ghi am vuot qua gioi han ${MAX_DURATION_SECONDS} giay.`,
      });
    }

    const context = await getAccountContext(req.user.id);
    const storagePath = path.posix.join("recordings", req.file.filename);

    const [result] = await db.query(
      `
        INSERT INTO recordings (
          account_id, person_id, clan_id, original_filename, stored_filename,
          storage_path, mime_type, duration_seconds, file_size_bytes, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded')
      `,
      [
        req.user.id,
        context?.person_id || null,
        context?.clan_id || null,
        req.file.originalname || null,
        req.file.filename,
        storagePath,
        req.file.mimetype || "application/octet-stream",
        durationSeconds,
        req.file.size,
      ]
    );

    return res.status(201).json({
      success: true,
      recording: {
        id: result.insertId,
        status: "uploaded",
        duration_seconds: durationSeconds,
        file_size_bytes: req.file.size,
      },
    });
  } catch (error) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error("voice upload error:", error);
    return res.status(500).json({ success: false, message: "Khong the luu ghi am." });
  }
});

router.get("/recordings", async (req, res) => {
  try {
    await ensureVoiceSchema();

    const limit = Math.min(parsePositiveInt(req.query.limit) || 20, 100);
    const ctx = await getAccountContext(req.user.id);
    const isAdmin = Number(req.user?.role_id) === 1 || req.user?.role_name === "admin";
    const isManager = req.user?.role_name === "manager";

    let sql = `
      SELECT id, account_id, person_id, clan_id, original_filename, mime_type,
             duration_seconds, file_size_bytes, status, transcript, transcript_edited,
             transcript_edited_at, transcribed_at, processing_started_at, error_message,
             created_at, updated_at
      FROM recordings
    `;
    const params = [];

    if (!isAdmin && isManager && ctx?.clan_id) {
      sql += " WHERE clan_id = ?";
      params.push(ctx.clan_id);
    } else if (!isAdmin) {
      sql += " WHERE account_id = ?";
      params.push(req.user.id);
    }

    sql += " ORDER BY created_at DESC, id DESC LIMIT ?";
    params.push(limit);

    const [rows] = await db.query(sql, params);
    return res.json({ success: true, recordings: rows });
  } catch (error) {
    console.error("voice list error:", error);
    return res.status(500).json({ success: false, message: "Khong the tai danh sach ghi am." });
  }
});

router.get("/recordings/:id", async (req, res) => {
  try {
    await ensureVoiceSchema();

    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "ID ghi am khong hop le." });

    const recording = await getRecordingById(id);
    if (!recording) return res.status(404).json({ success: false, message: "Khong tim thay ghi am." });

    if (!(await canReadRecording(req, recording))) {
      return res.status(403).json({ success: false, message: "Ban khong co quyen xem ghi am nay." });
    }

    return res.json({ success: true, recording });
  } catch (error) {
    console.error("voice detail error:", error);
    return res.status(500).json({ success: false, message: "Khong the tai ghi am." });
  }
});

router.get("/recordings/:id/audio", async (req, res) => {
  try {
    await ensureVoiceSchema();

    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "ID ghi am khong hop le." });

    const recording = await getRecordingById(id);
    if (!recording) return res.status(404).json({ success: false, message: "Khong tim thay ghi am." });

    if (!(await canReadRecording(req, recording))) {
      return res.status(403).json({ success: false, message: "Ban khong co quyen nghe ghi am nay." });
    }

    const audioPath = resolveStoragePath(recording.storage_path);
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ success: false, message: "File ghi am khong ton tai." });
    }

    const stat = fs.statSync(audioPath);
    res.setHeader("Content-Type", recording.mime_type || "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Cache-Control", "private, max-age=0, no-cache");
    return fs.createReadStream(audioPath).pipe(res);
  } catch (error) {
    console.error("voice audio stream error:", error);
    return res.status(500).json({ success: false, message: "Khong the phat file ghi am." });
  }
});

router.patch("/recordings/:id/transcript", async (req, res) => {
  try {
    await ensureVoiceSchema();

    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "ID ghi am khong hop le." });

    const transcript = String(req.body?.transcript || "").trim();
    if (!transcript) {
      return res.status(400).json({ success: false, message: "Transcript khong duoc de trong." });
    }
    if (transcript.length > 50000) {
      return res.status(400).json({ success: false, message: "Transcript toi da 50.000 ky tu." });
    }

    const recording = await getRecordingById(id);
    if (!recording) return res.status(404).json({ success: false, message: "Khong tim thay ghi am." });

    if (!(await canReadRecording(req, recording))) {
      return res.status(403).json({ success: false, message: "Ban khong co quyen sua transcript nay." });
    }

    await db.query(
      `
        UPDATE recordings
        SET transcript = ?,
            transcript_edited = 1,
            transcript_edited_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [transcript, id]
    );

    const updated = await getRecordingById(id);
    return res.json({ success: true, recording: updated });
  } catch (error) {
    console.error("voice transcript update error:", error);
    return res.status(500).json({ success: false, message: "Khong the cap nhat transcript." });
  }
});

router.post("/recordings/:id/retry", async (req, res) => {
  try {
    await ensureVoiceSchema();

    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "ID ghi am khong hop le." });

    const recording = await getRecordingById(id);
    if (!recording) return res.status(404).json({ success: false, message: "Khong tim thay ghi am." });

    if (!(await canReadRecording(req, recording))) {
      return res.status(403).json({ success: false, message: "Ban khong co quyen xu ly lai ghi am nay." });
    }

    await db.query(
      `
        UPDATE recordings
        SET status = 'uploaded',
            error_message = NULL,
            processing_started_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [id]
    );

    const updated = await getRecordingById(id);
    return res.json({ success: true, recording: updated });
  } catch (error) {
    console.error("voice retry error:", error);
    return res.status(500).json({ success: false, message: "Khong the dua ghi am ve hang doi." });
  }
});

router.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: `File ghi am toi da ${MAX_FILE_MB}MB.` });
  }
  return res.status(400).json({ success: false, message: error?.message || "Upload ghi am that bai." });
});

module.exports = router;
