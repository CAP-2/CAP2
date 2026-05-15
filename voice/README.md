# Voice / Local STT

Module `voice/` xu ly upload ghi am va speech-to-text local. Backend mount router vao `/api/voice`; worker Python poll MySQL, convert audio bang FFmpeg, transcribe bang faster-whisper va cap nhat transcript.

## Cau truc

```text
voice/
├── backend/
│   └── backendRoutes.js       # Express router mount vao /api/voice
├── worker/
│   └── worker.py              # Python worker poll DB, convert, transcribe
├── schema/
│   └── voice.schema.sql       # recordings va voice_recording_recipients
├── requirements.txt
└── README.md
```

File lien quan:

```text
Backend/server.js
Backend/storage/recordings/
Frontend/src/api/voiceService.js
Frontend/src/features/voice/components/VoiceRecorder.jsx
scripts/run_voice_worker.ps1
.venv-whisper/
```

## Chay worker

Voice worker khong dung chung virtual environment voi `AI-server`.

```powershell
cd D:\cap2
py -3.12 -m venv .venv-whisper
.\.venv-whisper\Scripts\python.exe -m pip install --upgrade pip
.\.venv-whisper\Scripts\python.exe -m pip install -r .\voice\requirements.txt
.\scripts\run_voice_worker.ps1
```

Chay truc tiep:

```powershell
D:\cap2\.venv-whisper\Scripts\python.exe D:\cap2\voice\worker\worker.py
```

## Schema

`voice/backend/backendRoutes.js` va `voice/worker/worker.py` doc schema tai:

```text
voice/schema/voice.schema.sql
```

Neu DB user khong co quyen `CREATE TABLE`/`ALTER TABLE`, chay SQL nay thu cong truoc.
