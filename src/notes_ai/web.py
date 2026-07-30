import socket

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
import uvicorn

from notes_ai.agent import run_agent

PORT = 8081

HTML_PAGE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Video Notes</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #0f0f0f;
    color: #e1e1e1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .container {
    width: 100%;
    max-width: 640px;
    padding: 20px 16px;
  }
  header {
    text-align: center;
    padding: 28px 0 20px;
  }
  header h1 {
    font-size: 28px;
    font-weight: 700;
    background: linear-gradient(135deg, #a855f7, #6366f1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  header p {
    color: #888;
    font-size: 14px;
    margin-top: 6px;
  }
  .card {
    background: #1a1a2e;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 16px;
    border: 1px solid #2a2a3e;
  }
  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: #a855f7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  label {
    display: block;
    font-size: 13px;
    color: #aaa;
    margin-bottom: 8px;
  }
  .input-row {
    display: flex;
    gap: 8px;
  }
  .input-row input {
    flex: 1;
    background: #0f0f1e;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 14px 16px;
    color: #e1e1e1;
    font-size: 16px;
    outline: none;
    transition: border-color 0.2s;
  }
  .input-row input:focus {
    border-color: #a855f7;
  }
  .input-row input::placeholder {
    color: #555;
  }
  .btn {
    background: linear-gradient(135deg, #a855f7, #6366f1);
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 14px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.2s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .progress-section { display: none; }
  .progress-section.active { display: block; }
  .step {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    opacity: 0.4;
    transition: opacity 0.3s;
  }
  .step.active { opacity: 1; }
  .step.done { opacity: 0.7; }
  .step-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid #444;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
    transition: all 0.3s;
  }
  .step.active .step-icon {
    border-color: #a855f7;
    background: #a855f722;
  }
  .step.done .step-icon {
    border-color: #22c55e;
    background: #22c55e;
    color: #fff;
  }
  .step-label {
    font-size: 14px;
    color: #ccc;
  }
  .step.active .step-label { color: #e1e1e1; }
  .spinner { display: none; }
  .step.active .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid #a855f744;
    border-top-color: #a855f7;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin-left: auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .result-section { display: none; }
  .result-section.active { display: block; }
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .result-title { font-size: 20px; font-weight: 700; }
  .type-badge {
    background: #a855f722;
    color: #a855f7;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  .result-body {
    white-space: pre-wrap;
    font-size: 15px;
    line-height: 1.6;
    color: #ccc;
  }
  .result-body strong { color: #e1e1e1; }
  .error-section { display: none; }
  .error-section.active { display: block; }
  .error-box {
    background: #2e1a1a;
    border: 1px solid #5c2a2a;
    border-radius: 10px;
    padding: 16px;
    color: #f87171;
    font-size: 14px;
  }
  .server-info {
    text-align: center;
    padding: 20px 0;
    color: #555;
    font-size: 12px;
  }
  .server-info code {
    color: #a855f7;
    font-size: 14px;
  }
  .history-item {
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .history-item:active { border-color: #a855f7; }
  .history-title { font-weight: 600; font-size: 14px; }
  .history-meta {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
    display: flex;
    gap: 8px;
  }
  .history-meta .tag {
    background: #a855f722;
    color: #a855f7;
    padding: 1px 8px;
    border-radius: 10px;
  }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Video Notes</h1>
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
let history = JSON.parse(localStorage.getItem('vn_history') || '[]');

function renderHistory() {
  const el = document.getElementById('historySection');
  const list = document.getElementById('historyList');
  if (history.length === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  list.innerHTML = history.map((h, i) => `
    <div class="history-item" onclick="showHistory(${i})">
      <div class="history-title">${esc(h.title)}</div>
      <div class="history-meta">
        <span>${h.type}</span>
        <span class="tag">${h.saved_at ? h.saved_at.slice(0,10) : ''}</span>
      </div>
    </div>
  `).join('');
}

function showHistory(i) {
  const h = history[i];
  showResult(h.title, h.type, h.output);
  document.getElementById('inputCard').scrollIntoView({ behavior: 'smooth' });
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

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

function showResult(title, type, body) {
  document.getElementById('resultTitle').textContent = title || 'Notes';
  document.getElementById('resultType').textContent = type || 'general';
  document.getElementById('resultBody').textContent = body;
  document.getElementById('resultSection').classList.add('active');
  document.getElementById('goBtn').disabled = false;
  document.getElementById('goBtn').textContent = 'Go';
}

async function process() {
  const url = document.getElementById('url').value.trim();
  if (!url) { document.getElementById('url').focus(); return; }
  resetUI();
  document.getElementById('progressSection').classList.add('active');
  document.getElementById('goBtn').disabled = true;
  document.getElementById('goBtn').textContent = '...';
  setStep('s1', 'active');

  try {
    const resp = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    setStep('s1', 'done');
    setStep('s2', 'done');
    setStep('s3', 'done');
    setStep('s4', 'done');

    const data = await resp.json();

    if (data.status === 'error') {
      showError(data.error);
      return;
    }

    showResult(data.title, data.content_type, data.notes);

    history.unshift({
      title: data.title,
      type: data.content_type,
      output: data.notes,
      saved_at: new Date().toISOString()
    });
    if (history.length > 20) history.pop();
    localStorage.setItem('vn_history', JSON.stringify(history));
    renderHistory();

  } catch (e) {
    showError('Network error — is the server running?');
    ['s1','s2','s3','s4'].forEach(s => setStep(s, null));
  }
}

document.getElementById('url').addEventListener('keydown', e => {
  if (e.key === 'Enter') process();
});

renderHistory();
</script>
</body>
</html>
"""


def create_app():
    app = FastAPI(title="Video Notes")

    @app.get("/", response_class=HTMLResponse)
    def index():
        ip = get_local_ip()
        page = HTML_PAGE.replace("SERVER_URL", f"http://{ip}:{PORT}")
        return page

    @app.post("/api/process")
    async def api_process(request: Request):
        body = await request.json()
        url = body.get("url", "").strip()

        if not url:
            return {"status": "error", "error": "No URL provided"}

        try:
            result = run_agent(url)

            if result.startswith("[ERROR]"):
                return {"status": "error", "error": result[7:]}

            lines = result.strip().split("\n")
            content_type = "general"
            title = "Video Notes"

            for line in lines[:5]:
                if line.lower().startswith("type:"):
                    content_type = line.split(":", 1)[1].strip()
                elif line.lower().startswith("title:"):
                    title = line.split(":", 1)[1].strip()

            return {
                "status": "success",
                "title": title,
                "content_type": content_type,
                "notes": result
            }

        except Exception as e:
            return {"status": "error", "error": str(e)}

    return app


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


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
    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")


if __name__ == "__main__":
    run_server()
