import os
import socket
import json
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
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


HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Video Notes AI</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0f0f0f;color:#e1e1e1;min-height:100vh;display:flex;flex-direction:column;align-items:center}
.container{width:100%;max-width:640px;padding:20px 16px}
header{text-align:center;padding:28px 0 20px}
header h1{font-size:28px;font-weight:700;background:linear-gradient(135deg,#a855f7,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
header p{color:#888;font-size:14px;margin-top:6px}
.card{background:#1a1a2e;border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid #2a2a3e}
.card-title{font-size:14px;font-weight:600;color:#a855f7;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px}
label{display:block;font-size:13px;color:#aaa;margin-bottom:8px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;background:#0f0f1e;border:1px solid #333;border-radius:10px;padding:14px 16px;color:#e1e1e1;font-size:16px;outline:none;transition:border-color .2s}
.input-row input:focus{border-color:#a855f7}
.input-row input::placeholder{color:#555}
.btn{background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;border:none;border-radius:10px;padding:14px 24px;font-size:16px;font-weight:600;cursor:pointer;white-space:nowrap;transition:opacity .2s,transform .1s;-webkit-tap-highlight-color:transparent}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.progress-section{display:none}
.progress-section.active{display:block}
.step{display:flex;align-items:center;gap:12px;padding:10px 0;opacity:.4;transition:opacity .3s}
.step.active{opacity:1}
.step.done{opacity:.7}
.step-icon{width:28px;height:28px;border-radius:50%;border:2px solid #444;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;transition:all .3s}
.step.active .step-icon{border-color:#a855f7;background:#a855f722}
.step.done .step-icon{border-color:#22c55e;background:#22c55e;color:#fff}
.step-label{font-size:14px;color:#ccc}
.step.active .step-label{color:#e1e1e1}
.spinner{display:none}
.step.active .spinner{display:inline-block;width:14px;height:14px;border:2px solid #a855f744;border-top-color:#a855f7;border-radius:50%;animation:spin .7s linear infinite;margin-left:auto}
@keyframes spin{to{transform:rotate(360deg)}}
.result-section{display:none}
.result-section.active{display:block}
.result-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px}
.result-title{font-size:20px;font-weight:700}
.type-badge{background:#a855f722;color:#a855f7;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.result-body{white-space:pre-wrap;font-size:15px;line-height:1.6;color:#ccc}
.result-body strong{color:#e1e1e1}
.error-section{display:none}
.error-section.active{display:block}
.error-box{background:#2e1a1a;border:1px solid #5c2a2a;border-radius:10px;padding:16px;color:#f87171;font-size:14px}
.history-item{background:#1a1a2e;border:1px solid #2a2a3e;border-radius:12px;padding:14px 16px;margin-bottom:8px;cursor:pointer;transition:border-color .2s}
.history-item:active{border-color:#a855f7}
.history-title{font-weight:600;font-size:14px}
.history-meta{font-size:12px;color:#666;margin-top:4px;display:flex;gap:8px}
.history-meta .tag{background:#a855f722;color:#a855f7;padding:1px 8px;border-radius:10px}
.server-info{text-align:center;padding:20px 0;color:#555;font-size:12px}
.server-info code{color:#a855f7;font-size:14px}
</style>
</head>
<body>
<div class="container">
<header>
<h1>Video Notes AI</h1>
<p>Paste a YouTube / Reels / video URL → get structured notes</p>
</header>

<div class="card" id="inputCard">
<div class="card-title">New Video</div>
<label for="url">Video URL</label>
<div class="input-row">
<input type="url" id="url" placeholder="https://youtube.com/watch?v=..." autocomplete="url" enterkeyhint="go">
<button class="btn" id="goBtn" onclick="process()">Go</button>
</div>
</div>

<div class="card progress-section" id="progressSection">
<div class="step" id="s1"><div class="step-icon">1</div><div class="step-label">Downloading audio</div><div class="spinner"></div></div>
<div class="step" id="s2"><div class="step-icon">2</div><div class="step-label">Transcribing</div><div class="spinner"></div></div>
<div class="step" id="s3"><div class="step-icon">3</div><div class="step-label">Generating notes</div><div class="spinner"></div></div>
<div class="step" id="s4"><div class="step-icon">4</div><div class="step-label">Saving</div><div class="spinner"></div></div>
</div>

<div class="card result-section" id="resultSection">
<div class="result-header">
<div class="result-title" id="resultTitle"></div>
<span class="type-badge" id="resultType"></span>
</div>
<div class="result-body" id="resultBody"></div>
</div>

<div class="card error-section" id="errorSection">
<div class="error-box" id="errorBody"></div>
<button class="btn" style="margin-top:12px;width:100%" onclick="resetUI()">Try Again</button>
</div>

<div id="historySection" style="display:none">
<div class="card-title" style="padding:0 0 12px;color:#888;font-size:13px">Recent Notes</div>
<div id="historyList"></div>
</div>

<div class="server-info" id="serverInfo">Open on phone: <code>SERVER_URL</code></div>
</div>

<script>
let clientId = 'client_' + Math.random().toString(36).substr(2, 9);
let ws = null;
let history = JSON.parse(localStorage.getItem('vn_history') || '[]');

function connectWS() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}/ws/${clientId}`);
  ws.onclose = () => setTimeout(connectWS, 1000);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'progress') updateStep(msg.step, msg.status);
    else if (msg.type === 'result') showResult(msg.data);
    else if (msg.type === 'error') showError(msg.error);
  };
}

function updateStep(step, state) {
  ['s1','s2','s3','s4'].forEach((s, i) => {
    const el = document.getElementById(s);
    el.classList.remove('active', 'done');
    if (i + 1 < step) el.classList.add('done');
    else if (i + 1 === step) el.classList.add(state);
  });
}

function setStep(id, state) {
  const el = document.getElementById(id);
  el.classList.remove('active', 'done');
  if (state) el.classList.add(state);
}

function resetUI() {
  document.getElementById('progressSection').classList.remove('active');
  document.getElementById('resultSection').classList.remove('active');
  document.getElementById('errorSection').classList.remove('active');
  document.getElementById('goBtn').disabled = false;
  document.getElementById('goBtn').textContent = 'Go';
  ['s1','s2','s3','s4'].forEach(s => setStep(s, null));
}

function showError(msg) {
  document.getElementById('errorBody').textContent = msg;
  document.getElementById('errorSection').classList.add('active');
  document.getElementById('goBtn').disabled = false;
  document.getElementById('goBtn').textContent = 'Go';
}

function showResult(data) {
  document.getElementById('resultTitle').textContent = data.title || 'Notes';
  document.getElementById('resultType').textContent = data.content_type || 'general';
  document.getElementById('resultBody').textContent = data.notes;
  document.getElementById('resultSection').classList.add('active');
  document.getElementById('goBtn').disabled = false;
  document.getElementById('goBtn').textContent = 'Go';

  history.unshift({
    id: data.id,
    title: data.title,
    type: data.content_type,
    output: data.notes,
    saved_at: new Date().toISOString()
  });
  if (history.length > 20) history.pop();
  localStorage.setItem('vn_history', JSON.stringify(history));
  renderHistory();
}

function esc(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

function renderHistory() {
  const el = document.getElementById('historySection');
  const list = document.getElementById('historyList');
  if (history.length === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  list.innerHTML = history.map((h, i) => `
    <div class="history-item" onclick="showHistory(${i})">
      <div class="history-title">${esc(h.title)}</div>
      <div class="history-meta"><span>${h.type}</span><span class="tag">${h.saved_at ? h.saved_at.slice(0,10) : ''}</span></div>
    </div>
  `).join('');
}

function showHistory(i) {
  const h = history[i];
  showResult({title: h.title, content_type: h.type, notes: h.output, id: h.id});
  document.getElementById('inputCard').scrollIntoView({behavior:'smooth'});
}

async function process() {
  const url = document.getElementById('url').value.trim();
  if (!url) { document.getElementById('url').focus(); return; }
  resetUI();
  document.getElementById('progressSection').classList.add('active');
  document.getElementById('goBtn').disabled = true;
  document.getElementById('goBtn').textContent = '...';
  setStep('s1', 'active');

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({type: 'process', url}));
    return;
  }

  try {
    const resp = await fetch('/api/process', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url, client_id: clientId})
    });
    setStep('s1', 'done'); setStep('s2', 'done'); setStep('s3', 'done'); setStep('s4', 'done');
    const data = await resp.json();
    if (data.status === 'error') { showError(data.error); return; }
    showResult(data);
  } catch (e) {
    showError('Network error — is the server running?');
    ['s1','s2','s3','s4'].forEach(s => setStep(s, null));
  }
}

document.getElementById('url').addEventListener('keydown', e => {
  if (e.key === 'Enter') process();
});

connectWS();
renderHistory();
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