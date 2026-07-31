import os
import socket
import json
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn

from notes_ai.agent import (
    extract_audio,
    transcribe_audio,
    generate_notes,
    save_output,
    run_agent,
)
from notes_ai.database import (
    init_db,
    save_note,
    get_all_notes,
    get_note,
    delete_note,
    update_note,
)

PORT = int(os.environ.get("PORT", 8080))

app = FastAPI(title="Video Notes AI", version="1.0.0")

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)

    async def send_progress(self, client_id: str, step: int, message: str, status: str):
        ws = self.active_connections.get(client_id)
        if ws:
            try:
                await ws.send_json({
                    "type": "progress",
                    "step": step,
                    "message": message,
                    "status": status
                })
            except Exception:
                self.disconnect(client_id)

    async def send_result(self, client_id: str, result: dict):
        ws = self.active_connections.get(client_id)
        if ws:
            try:
                await ws.send_json({"type": "result", "data": result})
            except Exception:
                self.disconnect(client_id)

    async def send_error(self, client_id: str, error: str):
        ws = self.active_connections.get(client_id)
        if ws:
            try:
                await ws.send_json({"type": "error", "error": error})
            except Exception:
                self.disconnect(client_id)


manager = ConnectionManager()


class ProcessRequest(BaseModel):
    url: str
    client_id: Optional[str] = None


class UpdateRequest(BaseModel):
    title: Optional[str] = None
    output: Optional[str] = None


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def parse_notes_output(notes: str) -> tuple[str, str]:
    content_type = "general"
    title = "Video Notes"
    for line in notes.strip().split("\n")[:5]:
        line_lower = line.lower().strip()
        if line_lower.startswith("type:"):
            content_type = line.split(":", 1)[1].strip()
        elif line_lower.startswith("title:"):
            title = line.split(":", 1)[1].strip()
    return content_type, title


async def process_video_with_progress(url: str, client_id: str) -> dict:
    try:
        await manager.send_progress(client_id, 1, "Downloading audio...", "active")
        audio_result = extract_audio(url)
        if audio_result["status"] == "error":
            return {"status": "error", "error": f"Download failed: {audio_result['error']}"}

        await manager.send_progress(client_id, 2, "Transcribing audio...", "active")
        transcript_result = transcribe_audio(audio_result["audio_path"])
        if transcript_result["status"] == "error":
            return {"status": "error", "error": f"Transcription failed: {transcript_result['error']}"}

        await manager.send_progress(client_id, 3, "Generating smart notes...", "active")
        detected_lang = transcript_result.get("detected_language", "en")
        notes_result = generate_notes(
            transcript=transcript_result["transcript"],
            detected_language=detected_lang,
            url=url
        )
        if notes_result["status"] == "error":
            return {"status": "error", "error": f"Note generation failed: {notes_result['error']}"}

        await manager.send_progress(client_id, 4, "Saving notes...", "active")
        save_result = save_output(
            title=notes_result["title"],
            content_type=notes_result["content_type"],
            output=notes_result["notes"],
            url=url
        )

        note_id = save_note(
            url=url,
            title=notes_result["title"],
            content_type=notes_result["content_type"],
            output=notes_result["notes"],
            language=detected_lang
        )

        result = {
            "status": "success",
            "id": note_id,
            "title": notes_result["title"],
            "content_type": notes_result["content_type"],
            "notes": notes_result["notes"],
            "language": detected_lang,
            "saved_file": save_result.get("txt_file") if save_result["status"] == "saved" else None
        }
        await manager.send_progress(client_id, 4, "Done!", "done")
        return result

    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "process":
                url = msg.get("url", "").strip()
                if url:
                    result = await process_video_with_progress(url, client_id)
                    await manager.send_result(client_id, result)
                else:
                    await manager.send_error(client_id, "No URL provided")
    except WebSocketDisconnect:
        manager.disconnect(client_id)


@app.post("/api/process")
async def api_process(request: ProcessRequest):
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="No URL provided")

    if request.client_id:
        result = await process_video_with_progress(url, request.client_id)
        return JSONResponse(result)

    result = run_agent(url)
    if result.startswith("[ERROR]"):
        raise HTTPException(status_code=500, detail=result[7:])

    content_type, title = parse_notes_output(result)
    save_result = save_output(title=title, content_type=content_type, output=result, url=url)

    detected_lang = "en"
    for line in result.split("\n")[:3]:
        if "language" in line.lower():
            detected_lang = line.split(":")[-1].strip().strip("'\"")

    note_id = save_note(url, title, content_type, result, detected_lang)

    return JSONResponse({
        "status": "success",
        "id": note_id,
        "title": title,
        "content_type": content_type,
        "notes": result,
        "language": detected_lang,
        "saved_file": save_result.get("txt_file") if save_result["status"] == "saved" else None
    })


@app.get("/api/history")
async def api_history(limit: int = 50):
    notes = get_all_notes(limit)
    return JSONResponse({"notes": notes})


@app.get("/api/history/{note_id}")
async def api_get_note(note_id: int):
    note = get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return JSONResponse(note)


@app.delete("/api/history/{note_id}")
async def api_delete_note(note_id: int):
    if delete_note(note_id):
        return JSONResponse({"status": "deleted"})
    raise HTTPException(status_code=404, detail="Note not found")


@app.post("/api/history/{note_id}")
async def api_update_note(note_id: int, request: UpdateRequest):
    if update_note(note_id, title=request.title, output=request.output):
        return JSONResponse({"status": "updated"})
    raise HTTPException(status_code=404, detail="Note not found")


@app.get("/api/history/{note_id}/download")
async def api_download_note(note_id: int):
    note = get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    content = (
        f"Title: {note['title']}\n"
        f"Type: {note['content_type']}\n"
        f"URL: {note['url']}\n"
        f"Language: {note.get('language', 'en')}\n"
        f"Created: {note['created_at']}\n\n"
        f"{'='*60}\n\n"
        f"{note['output']}"
    )

    from io import BytesIO
    return StreamingResponse(
        BytesIO(content.encode("utf-8")),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={note['title'][:50]}.txt"}
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


HTML_PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Video Notes AI — turn any video into notes</title>
<meta name="description" content="Paste a YouTube, Instagram, Twitter/X or TikTok video URL and get smart structured notes in seconds.">
<meta name="theme-color" content="#0b0f17">
<style>
:root{
  --bg:#0b0f17; --bg-soft:#0e1420; --surface:#121a28; --surface-2:#172130; --surface-3:#1f2b3d;
  --border:rgba(255,255,255,.08); --border-strong:rgba(255,255,255,.15);
  --text:#e6edf3; --muted:#8b98a9; --faint:#5d6a7a;
  --accent-1:#a855f7; --accent-2:#6366f1; --accent-soft:rgba(139,92,246,.16);
  --success:#3fb950; --warning:#d29922; --danger:#f85149;
  --radius:18px; --radius-sm:11px;
  --shadow:0 12px 32px rgba(0,0,0,.4);
  --shadow-lg:0 20px 60px rgba(0,0,0,.55);
  --font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  --mono:ui-monospace,'SF Mono','Cascadia Code','Segoe UI Mono',Consolas,monospace;
}
html[data-theme="light"]{
  --bg:#f3f5f9; --bg-soft:#eceff5; --surface:#ffffff; --surface-2:#f4f6fa; --surface-3:#e9edf4;
  --border:rgba(17,24,39,.09); --border-strong:rgba(17,24,39,.18);
  --text:#1f2430; --muted:#57606f; --faint:#8a919d;
  --accent-soft:rgba(124,58,237,.12);
  --shadow:0 10px 28px rgba(17,24,39,.1);
  --shadow-lg:0 24px 60px rgba(17,24,39,.18);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{color-scheme:dark;scroll-behavior:smooth}
html[data-theme="light"]{color-scheme:light}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased;line-height:1.55}
[hidden]{display:none !important}
button{font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
input{font-family:inherit}
::selection{background:rgba(139,92,246,.35)}
.app{max-width:1180px;margin:0 auto;padding:18px 16px 40px}

/* ---------- Top bar ---------- */
.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 2px 22px}
.brand{display:flex;align-items:center;gap:13px;min-width:0}
.logo{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--accent-1),var(--accent-2));display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(124,58,237,.45);flex-shrink:0}
.logo svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.brand h1{font-size:20px;font-weight:700;letter-spacing:-.02em;white-space:nowrap}
.brand .tagline{font-size:12.5px;color:var(--muted)}
.top-actions{display:flex;gap:8px;flex-shrink:0}
.icon-btn{width:40px;height:40px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);color:var(--muted);display:flex;align-items:center;justify-content:center;transition:all .18s}
.icon-btn:hover{color:var(--text);border-color:var(--border-strong);transform:translateY(-1px)}
.icon-btn:active{transform:scale(.94)}
.icon-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}

/* ---------- Layout grid ---------- */
.grid{display:grid;grid-template-columns:1fr;gap:16px;align-items:start}
@media(min-width:1024px){
  .grid{grid-template-columns:minmax(0,1fr) 360px}
  .col-side{position:sticky;top:16px}
}

/* ---------- Cards ---------- */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow);animation:rise .5s cubic-bezier(.22,1,.36,1) both}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px}
.card-head h2{font-size:13px;font-weight:650;letter-spacing:.03em;text-transform:uppercase;color:var(--muted)}
.pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--surface-3);color:var(--muted);white-space:nowrap}
.pill.accent{background:var(--accent-soft);color:#c9a7ff}
.pill.type{background:var(--accent-soft);color:#c9a7ff;text-transform:capitalize}
html[data-theme="light"] .pill.accent,html[data-theme="light"] .pill.type{color:#7c3aed}
.pill.success{background:rgba(63,185,80,.14);color:var(--success)}
.pill.ghost{background:transparent;border:1px solid var(--border)}

/* ---------- Input ---------- */
.field-label{display:block;font-size:13px;color:var(--muted);margin-bottom:9px;font-weight:500}
.url-row{display:flex;gap:9px}
.url-row input{flex:1;min-width:0;background:var(--bg-soft);border:1px solid var(--border);border-radius:var(--radius-sm);padding:13px 15px;color:var(--text);font-size:15px;outline:none;transition:border-color .18s,box-shadow .18s}
.url-row input::placeholder{color:var(--faint)}
.url-row input:focus{border-color:rgba(139,92,246,.7);box-shadow:0 0 0 3px var(--accent-soft)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:var(--radius-sm);padding:13px 18px;font-size:14.5px;font-weight:650;transition:all .18s}
.btn:active{transform:scale(.96)}
.btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
.btn-primary{background:linear-gradient(135deg,var(--accent-1),var(--accent-2));color:#fff;box-shadow:0 6px 18px rgba(124,58,237,.4)}
.btn-primary:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}
.btn-danger{background:var(--surface-3);color:var(--danger);border:1px solid var(--border)}
.btn-danger:hover{background:rgba(248,81,73,.12);border-color:rgba(248,81,73,.4)}
.hint-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}
.text-btn{background:none;border:none;color:var(--accent-1);font-size:13px;font-weight:600;padding:4px 2px}
.text-btn:hover{text-decoration:underline}
.hint{font-size:12px;color:var(--faint)}

/* ---------- Progress steps ---------- */
.steps{display:flex;flex-direction:column}
.step{display:flex;align-items:flex-start;gap:14px;padding:11px 0;position:relative}
.step+.step::before{content:"";position:absolute;left:17px;top:-6px;width:2px;height:26px;background:var(--border)}
.step-ico{width:36px;height:36px;border-radius:50%;background:var(--surface-3);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .3s;position:relative;z-index:1}
.step-ico .num{font-size:13px;font-weight:700;color:var(--faint)}
.step-ico .check{display:none;width:16px;height:16px;fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.step-body{min-width:0;padding-top:6px}
.step-name{font-size:14.5px;font-weight:600;color:var(--muted);transition:color .25s}
.step-desc{font-size:12.5px;color:var(--faint);margin-top:1px}
.step.active .step-ico{border-color:var(--accent-1);background:var(--accent-soft);box-shadow:0 0 0 4px rgba(139,92,246,.14);animation:breath 1.6s ease-in-out infinite}
.step.active .step-name{color:var(--text)}
.step.done .step-ico{border-color:var(--success);background:var(--success)}
.step.done .step-ico .num{display:none}
.step.done .step-ico .check{display:block}
.step.done .step-name{color:var(--success)}
.step.done .step-desc{color:var(--muted)}
.step .spin{margin-left:auto;margin-top:9px;width:15px;height:15px;border:2px solid rgba(139,92,246,.25);border-top-color:var(--accent-1);border-radius:50%;animation:spin .75s linear infinite;opacity:0;flex-shrink:0}
.step.active .spin{opacity:1}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes breath{0%,100%{box-shadow:0 0 0 4px rgba(139,92,246,.12)}50%{box-shadow:0 0 0 7px rgba(139,92,246,.05)}}

/* ---------- Result ---------- */
.result-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
.result-head h2{font-size:19px;font-weight:700;letter-spacing:-.02em;line-height:1.3}
.result-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px}
.result-actions{display:flex;gap:7px;flex-shrink:0}
.markdown{font-size:14.5px;line-height:1.7;color:var(--text);word-break:break-word}
.markdown p{margin:0 0 12px}
.markdown h1,.markdown h2,.markdown h3,.markdown h4{margin:20px 0 8px;line-height:1.3;letter-spacing:-.01em}
.markdown h1{font-size:20px}.markdown h2{font-size:17px}.markdown h3{font-size:15.5px}.markdown h4{font-size:14.5px}
.markdown ul,.markdown ol{margin:0 0 12px;padding-left:22px}
.markdown li{margin:4px 0}
.markdown strong{font-weight:650}
.markdown em{color:var(--muted)}
.markdown code{font-family:var(--mono);font-size:.9em;background:var(--surface-3);padding:2px 6px;border-radius:6px;color:#d2a8ff}
html[data-theme="light"] .markdown code{color:#7c3aed}
.markdown pre{background:var(--bg-soft);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;overflow-x:auto;margin:0 0 12px}
.markdown pre code{background:none;padding:0;color:var(--text);font-size:13px;line-height:1.6}
.markdown hr{border:none;border-top:1px solid var(--border);margin:16px 0}
.markdown a{color:#8b8cf7;text-decoration:none;border-bottom:1px solid rgba(139,140,247,.4)}
.markdown a:hover{border-bottom-color:#8b8cf7}

/* ---------- Error ---------- */
.error-card{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-color:rgba(248,81,73,.3);background:linear-gradient(180deg,var(--surface),rgba(248,81,73,.05))}
.error-ico{width:40px;height:40px;border-radius:50%;background:rgba(248,81,73,.14);color:var(--danger);display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;flex-shrink:0}
.error-card h2{font-size:15px;font-weight:700}
.error-card p{font-size:13px;color:var(--muted);margin-top:2px;word-break:break-word}
.error-card .btn{margin-left:auto}

/* ---------- History ---------- */
.search-row{display:flex;align-items:center;gap:9px;background:var(--bg-soft);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0 12px;margin-bottom:14px;transition:border-color .18s,box-shadow .18s}
.search-row:focus-within{border-color:rgba(139,92,246,.7);box-shadow:0 0 0 3px var(--accent-soft)}
.search-row svg{width:15px;height:15px;fill:none;stroke:var(--faint);stroke-width:2;stroke-linecap:round;flex-shrink:0}
.search-row input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--text);padding:11px 0;font-size:13.5px}
.search-row input::placeholder{color:var(--faint)}
.history-list{display:flex;flex-direction:column;gap:8px;max-height:520px;overflow-y:auto;padding-right:2px}
.history-list::-webkit-scrollbar{width:6px}
.history-list::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:99px}
.h-item{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;cursor:pointer;transition:all .16s;text-align:left;width:100%}
.h-item:hover{border-color:rgba(139,92,246,.5);transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.18)}
html[data-theme="light"] .h-item:hover{box-shadow:0 6px 16px rgba(17,24,39,.08)}
.h-item:active{transform:scale(.985)}
.h-item h3{font-size:13.5px;font-weight:600;line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.h-item .h-meta{display:flex;align-items:center;gap:8px;margin-top:7px;font-size:11px;color:var(--faint)}
.h-item .h-type{background:var(--accent-soft);color:#c9a7ff;padding:2px 8px;border-radius:99px;font-weight:600;text-transform:capitalize}
html[data-theme="light"] .h-item .h-type{color:#7c3aed}
.h-item .h-date{margin-left:auto}
.empty{text-align:center;color:var(--faint);font-size:13px;padding:26px 10px}

/* ---------- Footer ---------- */
.footer{text-align:center;color:var(--faint);font-size:12px;padding:24px 0 6px}
.footer code{font-family:var(--mono);color:var(--muted)}

/* ---------- Toasts ---------- */
.toasts{position:fixed;top:16px;right:16px;z-index:100;display:flex;flex-direction:column;gap:8px;max-width:calc(100vw - 32px)}
.toast{display:flex;align-items:center;gap:9px;background:var(--surface-2);border:1px solid var(--border-strong);color:var(--text);padding:11px 15px;border-radius:var(--radius-sm);font-size:13.5px;font-weight:550;box-shadow:var(--shadow-lg);animation:toastIn .28s cubic-bezier(.22,1,.36,1) both}
.toast.error{border-left:3px solid var(--danger)}
.toast.out{animation:toastOut .25s ease both}
@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
@keyframes toastOut{to{opacity:0;transform:translateX(20px)}}

/* ---------- Modal ---------- */
.modal-backdrop{position:fixed;inset:0;background:rgba(5,8,14,.7);backdrop-filter:blur(6px);z-index:90;display:flex;align-items:center;justify-content:center;padding:16px;animation:fade .2s ease both}
.modal{background:var(--surface);border:1px solid var(--border-strong);border-radius:20px;max-width:760px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);animation:pop .28s cubic-bezier(.22,1,.36,1) both}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes pop{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 22px 12px}
.modal-head h2{font-size:17px;font-weight:700;letter-spacing:-.01em;line-height:1.35}
.modal-meta{padding:0 22px 12px}
.modal-meta a{font-size:12.5px;color:var(--accent-1);word-break:break-all;text-decoration:none}
.modal-meta a:hover{text-decoration:underline}
.modal .markdown{flex:1;overflow-y:auto;padding:4px 22px 16px}
.modal-actions{display:flex;gap:8px;padding:14px 22px 20px;border-top:1px solid var(--border);flex-wrap:wrap}
.modal-actions .btn{flex:1;min-width:110px;background:var(--surface-2);border:1px solid var(--border);color:var(--text)}

/* ---------- Reduced motion ---------- */
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important}
  html{scroll-behavior:auto}
}
</style>
</head>
<body>
<div class="app">
  <header class="topbar">
    <div class="brand">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>
      </div>
      <div>
        <h1>Video Notes AI</h1>
        <p class="tagline">Turn any video URL into smart notes</p>
      </div>
    </div>
    <div class="top-actions">
      <button class="icon-btn" id="themeBtn" title="Toggle theme" aria-label="Toggle color theme">
        <svg class="ico-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
        <svg class="ico-sun" viewBox="0 0 24 24" hidden><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
    </div>
  </header>

  <main class="grid">
    <section class="col-main">
      <div class="card" id="inputCard">
        <div class="card-head">
          <h2>New video</h2>
          <span class="pill success" id="statusPill">Ready</span>
        </div>
        <label class="field-label" for="url">Video URL</label>
        <div class="url-row">
          <input type="url" id="url" inputmode="url" placeholder="https://youtube.com/watch?v=..." autocomplete="url" spellcheck="false" enterkeyhint="go">
          <button class="btn btn-primary" id="goBtn">Generate</button>
        </div>
        <div class="hint-row">
          <button class="text-btn" id="pasteBtn">Paste</button>
          <span class="hint">YouTube · Instagram · Twitter/X · TikTok</span>
        </div>
      </div>

      <div class="card" id="progressCard" hidden>
        <div class="card-head">
          <h2>Processing</h2>
          <span class="pill accent" id="progressMsg">Starting…</span>
        </div>
        <div class="steps" id="steps">
          <div class="step" data-step="1">
            <div class="step-ico"><span class="num">1</span><svg class="check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>
            <div class="step-body"><div class="step-name">Download audio</div><div class="step-desc">Fetching the video track</div></div>
            <div class="spin"></div>
          </div>
          <div class="step" data-step="2">
            <div class="step-ico"><span class="num">2</span><svg class="check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>
            <div class="step-body"><div class="step-name">Transcribe</div><div class="step-desc">Speech to text</div></div>
            <div class="spin"></div>
          </div>
          <div class="step" data-step="3">
            <div class="step-ico"><span class="num">3</span><svg class="check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>
            <div class="step-body"><div class="step-name">Generate notes</div><div class="step-desc">Summarizing key points</div></div>
            <div class="spin"></div>
          </div>
          <div class="step" data-step="4">
            <div class="step-ico"><span class="num">4</span><svg class="check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>
            <div class="step-body"><div class="step-name">Save</div><div class="step-desc">Stored to history</div></div>
            <div class="spin"></div>
          </div>
        </div>
      </div>

      <div class="card" id="resultCard" hidden>
        <div class="result-head">
          <div style="min-width:0">
            <div class="result-meta">
              <span class="pill type" id="resultType"></span>
              <span class="pill ghost" id="resultLang"></span>
              <span class="pill ghost" id="resultDate"></span>
            </div>
            <h2 id="resultTitle"></h2>
          </div>
          <div class="result-actions">
            <button class="icon-btn" id="copyBtn" title="Copy" aria-label="Copy notes">
              <svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="icon-btn" id="downloadBtn" title="Download" aria-label="Download notes">
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
            <button class="icon-btn" id="shareBtn" title="Share" aria-label="Share notes">
              <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
            </button>
            <button class="icon-btn" id="deleteBtn" title="Delete" aria-label="Delete note">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
            </button>
          </div>
        </div>
        <div class="markdown" id="resultBody"></div>
      </div>

      <div class="card error-card" id="errorCard" hidden>
        <div class="error-ico">!</div>
        <div style="min-width:0">
          <h2>Something went wrong</h2>
          <p id="errorBody"></p>
        </div>
        <button class="btn btn-primary" id="retryBtn">Try again</button>
      </div>
    </section>

    <aside class="col-side">
      <div class="card history-card">
        <div class="card-head">
          <h2>History</h2>
          <span class="pill ghost" id="historyCount">0</span>
        </div>
        <div class="search-row">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="searchInput" placeholder="Search notes…" aria-label="Search notes">
        </div>
        <div class="history-list" id="historyList"></div>
        <div class="empty" id="historyEmpty" hidden>No notes yet — generate your first one above.</div>
      </div>
    </aside>
  </main>

  <footer class="footer">Server: <code>SERVER_URL</code></footer>
</div>

<div class="toasts" id="toasts" aria-live="polite"></div>

<div class="modal-backdrop" id="modal" hidden>
  <div class="modal">
    <div class="modal-head">
      <h2 id="modalTitle"></h2>
      <button class="icon-btn" id="modalClose" title="Close" aria-label="Close">
        <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-meta"><a id="modalUrl" target="_blank" rel="noopener"></a></div>
    <div class="markdown" id="modalBody"></div>
    <div class="modal-actions">
      <button class="btn" id="modalCopy">Copy</button>
      <button class="btn" id="modalDownload">Download</button>
      <button class="btn btn-danger" id="modalDelete">Delete</button>
      <button class="btn" id="modalShare">Share</button>
    </div>
  </div>
</div>

<script>
const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };

/* ---------- Theme ---------- */
const savedTheme = localStorage.getItem('vn_theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.dataset.theme = savedTheme || (prefersDark ? 'dark' : 'light');
function applyThemeUI(){
  document.querySelector('.ico-moon').hidden = document.documentElement.dataset.theme !== 'light';
  document.querySelector('.ico-sun').hidden = document.documentElement.dataset.theme === 'light';
}
applyThemeUI();
$('themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('vn_theme', next);
  applyThemeUI();
});

/* ---------- State ---------- */
const state = {
  clientId: 'client_' + Math.random().toString(36).substr(2, 9),
  ws: null,
  notes: [],
  current: null,
  processing: false,
  search: ''
};

/* ---------- Toast ---------- */
function toast(msg, kind = 'success'){
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 2600);
}

/* ---------- Markdown ---------- */
function md2html(src){
  if(!src) return '';
  const escS = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function inline(s){
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/https?:\/\/[^\s<]+/g, m => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`);
  }
  const lines = escS(src).split('\n');
  let out = '', inCode = false, inList = null;
  const close = () => { if(inList){ out += '</' + inList + '>'; inList = null; } };
  for(const raw of lines){
    if(/^```/.test(raw)){ close(); if(inCode){ out += '</code></pre>'; inCode = false; } else { out += '<pre><code>'; inCode = true; } continue; }
    if(inCode){ out += raw + '\n'; continue; }
    const h = raw.match(/^(#{1,4})\s+(.*)/);
    if(h){ close(); const n = h[1].length; out += '<h' + n + '>' + inline(h[2]) + '</h' + n + '>'; continue; }
    if(/^\s*([-*+])\s+/.test(raw)){ if(inList !== 'ul'){ close(); out += '<ul>'; inList = 'ul'; } out += '<li>' + inline(raw.replace(/^\s*[-*+]\s+/, '')) + '</li>'; continue; }
    if(/^\s*\d+[.)]\s+/.test(raw)){ if(inList !== 'ol'){ close(); out += '<ol>'; inList = 'ol'; } out += '<li>' + inline(raw.replace(/^\s*\d+[.)]\s+/, '')) + '</li>'; continue; }
    if(/^\s*(---|\*\*\*|___)\s*$/.test(raw)){ close(); out += '<hr>'; continue; }
    if(!raw.trim()){ close(); continue; }
    close();
    out += '<p>' + inline(raw) + '</p>';
  }
  if(inCode) out += '</code></pre>';
  close();
  return out;
}

/* ---------- Formatting helpers ---------- */
function shortDate(iso){
  if(!iso) return '';
  try{ const d = new Date(iso); return d.toLocaleDateString(undefined, {month:'short', day:'numeric'}) + ', ' + d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'}); }catch(e){ return ''; }
}
function langLabel(code){
  try{ return new Intl.DisplayNames(['en'], {type:'language'}).of(code) || (code || 'en').toUpperCase(); }catch(e){ return (code || 'en').toUpperCase(); }
}

/* ---------- Progress ---------- */
function resetSteps(){ document.querySelectorAll('#steps .step').forEach(el => el.classList.remove('active', 'done')); }
function setProgress(step, status, message){
  $('progressCard').hidden = false;
  if(message) $('progressMsg').textContent = message;
  document.querySelectorAll('#steps .step').forEach((el, i) => {
    const s = i + 1;
    el.classList.remove('active', 'done');
    if(s < step || (s === step && status === 'done')) el.classList.add('done');
    else if(s === step) el.classList.add('active');
  });
}
function setStatusPill(mode){
  const p = $('statusPill');
  p.classList.toggle('success', mode === 'ready');
  p.classList.toggle('accent', mode === 'working');
  p.textContent = mode === 'ready' ? 'Ready' : 'Working…';
}

/* ---------- WebSocket ---------- */
function connectWS(){
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  state.ws = new WebSocket(`${proto}//${location.host}/ws/${state.clientId}`);
  state.ws.onclose = () => { if(!state.processing) setTimeout(connectWS, 1200); };
  state.ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if(m.type === 'progress') setProgress(m.step, m.status, m.message);
    else if(m.type === 'result') onResult(m.data);
    else if(m.type === 'error') onError(m.error);
  };
}

/* ---------- Flow ---------- */
function process(){
  const input = $('url');
  const url = input.value.trim();
  if(!url){ input.focus(); toast('Paste a video URL first', 'error'); return; }
  if(state.processing) return;

  state.processing = true;
  $('resultCard').hidden = true;
  $('errorCard').hidden = true;
  $('goBtn').disabled = true;
  $('goBtn').textContent = 'Working…';
  setStatusPill('working');
  resetSteps();
  setProgress(1, 'active', 'Starting…');

  if(state.ws && state.ws.readyState === WebSocket.OPEN){
    state.ws.send(JSON.stringify({type: 'process', url}));
    return;
  }

  fetch('/api/process', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({url, client_id: state.clientId})
  })
  .then(r => r.json())
  .then(data => {
    if(data.status === 'error') onError(data.error);
    else onResult(data);
  })
  .catch(() => onError('Network error — is the server running?'));
}

function onResult(data){
  state.processing = false;
  $('goBtn').disabled = false;
  $('goBtn').textContent = 'Generate';
  setStatusPill('ready');

  state.current = {
    id: data.id,
    url: data.url || '',
    title: data.title || 'Untitled',
    content_type: data.content_type || 'general',
    output: data.notes || '',
    language: data.language || 'en',
    created_at: data.created_at || new Date().toISOString()
  };
  const n = state.current;

  document.querySelectorAll('#steps .step').forEach(el => el.classList.add('done'));
  $('progressMsg').textContent = 'Done!';
  $('resultType').textContent = n.content_type;
  $('resultLang').textContent = langLabel(n.language);
  $('resultDate').textContent = shortDate(n.created_at);
  $('resultTitle').textContent = n.title;
  $('resultBody').innerHTML = md2html(n.output);
  $('resultCard').hidden = false;

  setTimeout(() => $('resultCard').scrollIntoView({behavior: 'smooth', block: 'nearest'}), 60);
  toast('Notes ready');
  loadHistory();
}

function onError(msg){
  state.processing = false;
  $('goBtn').disabled = false;
  $('goBtn').textContent = 'Generate';
  setStatusPill('ready');
  $('progressMsg').textContent = 'Failed';
  $('errorBody').textContent = msg || 'Unknown error';
  $('errorCard').hidden = false;
  document.querySelectorAll('#steps .step').forEach(el => el.classList.remove('active'));
  toast('Something went wrong', 'error');
}

/* ---------- History ---------- */
async function loadHistory(){
  try{
    const r = await fetch('/api/history?limit=50');
    const d = await r.json();
    state.notes = d.notes || [];
    renderHistory();
  }catch(e){}
}

function renderHistory(){
  const list = $('historyList');
  const q = state.search.toLowerCase();
  const filtered = state.notes.filter(n =>
    !q || (n.title + ' ' + n.content_type + ' ' + (n.language || '')).toLowerCase().includes(q)
  );
  $('historyCount').textContent = state.notes.length;
  $('historyEmpty').hidden = state.notes.length > 0;
  list.innerHTML = filtered.map(n => `
    <button class="h-item" data-id="${n.id}">
      <h3>${esc(n.title)}</h3>
      <div class="h-meta">
        <span class="h-type">${esc(n.content_type || 'general')}</span>
        <span>${esc((n.language || 'en').toUpperCase())}</span>
        <span class="h-date">${esc(shortDate(n.created_at))}</span>
      </div>
    </button>
  `).join('');
  list.querySelectorAll('.h-item').forEach(b => b.addEventListener('click', () => openNote(Number(b.dataset.id))));
}

function openNote(id){
  const n = state.notes.find(x => x.id === id);
  if(!n) return;
  state.current = n;
  $('modalTitle').textContent = n.title;
  $('modalUrl').textContent = n.url || '';
  $('modalUrl').hidden = !n.url;
  $('modalBody').innerHTML = md2html(n.output);
  $('modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

/* ---------- Actions ---------- */
async function copyNote(){
  if(!state.current) return;
  try{
    await navigator.clipboard.writeText(state.current.output);
    toast('Copied to clipboard');
  }catch(e){
    const ta = document.createElement('textarea');
    ta.value = state.current.output;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand('copy'); toast('Copied to clipboard'); }catch(e2){ toast('Copy failed', 'error'); }
    ta.remove();
  }
}

function downloadNote(){
  if(!state.current) return;
  const n = state.current;
  const content = 'Title: ' + n.title + '\nType: ' + n.content_type + '\nURL: ' + (n.url || '') + '\nCreated: ' + (n.created_at || '') + '\n\n' + '='.repeat(60) + '\n\n' + n.output;
  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (n.title || 'notes').replace(/[^\w\- ]+/g, '').slice(0, 60) + '.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
  toast('Downloaded');
}

async function shareNote(){
  const n = state.current;
  if(!n) return;
  if(navigator.share){
    try{ await navigator.share({title: n.title, text: n.output.slice(0, 4000)}); return; }catch(e){ if(e.name !== 'AbortError') toast('Sharing unavailable', 'error'); }
  }
  await copyNote();
}

async function deleteNote(){
  const n = state.current;
  if(!n) return;
  if(!confirm('Delete this note?')) return;
  try{
    if(n.id != null){
      const r = await fetch('/api/history/' + n.id, {method: 'DELETE'});
      if(!r.ok) throw new Error();
    }
    closeModal();
    $('resultCard').hidden = true;
    state.current = null;
    toast('Note deleted');
    loadHistory();
  }catch(e){ toast('Delete failed', 'error'); }
}

function closeModal(){
  $('modal').hidden = true;
  document.body.style.overflow = '';
}

/* ---------- Wiring ---------- */
$('goBtn').addEventListener('click', () => process());
$('copyBtn').addEventListener('click', copyNote);
$('downloadBtn').addEventListener('click', downloadNote);
$('shareBtn').addEventListener('click', shareNote);
$('deleteBtn').addEventListener('click', deleteNote);
$('modalCopy').addEventListener('click', copyNote);
$('modalDownload').addEventListener('click', downloadNote);
$('modalShare').addEventListener('click', shareNote);
$('modalDelete').addEventListener('click', deleteNote);
$('modalClose').addEventListener('click', closeModal);
$('modal').addEventListener('click', e => { if(e.target === $('modal')) closeModal(); });
$('retryBtn').addEventListener('click', () => { $('errorCard').hidden = true; $('url').focus(); });

$('pasteBtn').addEventListener('click', async () => {
  try{
    const t = await navigator.clipboard.readText();
    $('url').value = t.trim();
    $('url').focus();
    toast('Pasted');
  }catch(e){ toast('Clipboard access blocked', 'error'); }
});

$('searchInput').addEventListener('input', e => { state.search = e.target.value; renderHistory(); });

$('url').addEventListener('keydown', e => {
  if(e.key === 'Enter' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) process();
});

document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    if(!$('modal').hidden) closeModal();
    else $('url').focus();
  } else if(e.key === '/' && !state.processing && document.activeElement !== $('url') && document.activeElement !== $('searchInput')){
    e.preventDefault();
    $('url').focus();
  }
});

connectWS();
loadHistory();
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def index():
    ip = get_local_ip()
    page = HTML_PAGE.replace("SERVER_URL", f"http://{ip}:{PORT}")
    return page


def run_server():
    ip = get_local_ip()
    print()
    print("=" * 50)
    print("  Video Notes Web Server")
    print("=" * 50)
    print()
    print(f"  Local:    http://127.0.0.1:{PORT}")
    print(f"  Network:  http://{ip}:{PORT}")
    print()
    print("  Open the Network URL on your phone")
    print("  to paste video URLs and get notes.")
    print()
    print("  Press Ctrl+C to stop.")
    print("=" * 50)
    print()
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")


if __name__ == "__main__":
    run_server()