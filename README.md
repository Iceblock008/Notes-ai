# Video Notes AI

Turn any social media video URL into structured, AI-generated notes. Works on mobile, tablet, and desktop.

## Features

- **Any video URL** → YouTube, Twitter/X, Reddit, Vimeo, Instagram, TikTok, etc.
- **Smart content detection** → Tutorials become step-by-step guides, lectures become study notes, podcasts become key takeaways, news becomes summaries
- **Multi-language support** → Non-English videos are auto-translated to English before note generation
- **Real-time progress** → See download, transcription, and generation steps live
- **History management** → View, download, and delete past notes
- **Mobile-first** → Responsive dark theme works great on phones
- **WebSocket support** → Real-time updates during processing

## Quick Start (Local)

```bash
# Clone and install
git clone <repo>
cd notes-ai
pip install -e .

# Add your API keys to .env
cp .env.example .env
# Edit .env with your ASSEMBLYAI_API_KEY and GROQ_API_KEY

# Run CLI
notes-ai process "https://youtube.com/watch?v=..."

# Run web server (accessible from phone on same network)
notes-ai-web
```

## Deployment (Public URL)

### Option 1: Railway (Recommended - Easiest)

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login and deploy
railway login
railway init
railway up

# 3. Set environment variables in Railway dashboard:
#    ASSEMBLYAI_API_KEY=your_key
#    GROQ_API_KEY=your_key
```

### Option 2: Render (Free Tier)

```bash
# 1. Push to GitHub
git push origin main

# 2. Connect repo at render.com
# 3. Add environment variables in dashboard
```

### Option 3: Docker (Any Cloud)

```bash
docker build -t video-notes-ai .
docker run -p 8080:8080 \
  -e ASSEMBLYAI_API_KEY=your_key \
  -e GROQ_API_KEY=your_key \
  video-notes-ai
```

### Option 4: Fly.io

```bash
fly launch --name video-notes-ai
fly secrets set ASSEMBLYAI_API_KEY=your_key GROQ_API_KEY=your_key
fly deploy
```

## API Keys Required

| Service | Purpose | Get Key |
|---------|---------|---------|
| AssemblyAI | Transcription (best accuracy, multi-language) | https://www.assemblyai.com/ |
| Groq | LLM for note generation (Llama-3.3-70B) | https://console.groq.com/ |

## Usage

### CLI Commands
```bash
notes-ai process <url>        # Generate notes from video
notes-ai browse               # Interactive history browser
notes-ai list                 # List all saved notes
notes-ai serve                # Start web server
notes-ai --help               # Show help
```

### Web UI
Open the server URL on any device. Paste a video URL and click "Go". Progress shows 4 steps:
1. Downloading audio
2. Transcribing
3. Generating smart notes
4. Saving

History appears below - tap any note to re-view.

### API Endpoints
```
POST   /api/process           # Process video URL
GET    /api/history           # List all notes
GET    /api/history/{id}      # Get single note
DELETE /api/history/{id}      # Delete note
POST   /api/history/{id}      # Update note
GET    /api/history/{id}/download  # Download as .txt
GET    /api/health            # Health check
WS     /ws/{client_id}        # Real-time progress
```

## Architecture

```
src/notes_ai/
├── agent.py       # Core pipeline: yt-dlp → AssemblyAI → Groq → save
├── database.py    # SQLite persistence for history
├── web_app.py     # FastAPI + WebSocket server
├── cli.py         # Click CLI entry point
└── browse.py      # History browser
```

## Tech Stack

- **Backend**: FastAPI, Uvicorn, WebSockets
- **Transcription**: AssemblyAI (universal-2, multi-language)
- **LLM**: Groq (Llama-3.3-70B-versatile)
- **Download**: yt-dlp (1000+ sites)
- **Database**: SQLite (file-based, zero-config)
- **Frontend**: Vanilla HTML/CSS/JS (mobile-first, no framework)

## File Structure

```
notes-ai/
├── Dockerfile
├── railway.json
├── render.yaml
├── pyproject.toml
├── requirements.txt
├── .env.example
├── .dockerignore
├── src/notes_ai/
│   ├── __init__.py
│   ├── __main__.py
│   ├── agent.py
│   ├── database.py
│   ├── web_app.py
│   ├── cli.py
│   └── browse.py
└── outputs/       # Saved notes (JSON + TXT)
```

## License

MIT