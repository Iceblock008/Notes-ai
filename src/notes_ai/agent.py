import os
import re
import subprocess
import json
import sys
from collections import Counter
from pathlib import Path
from datetime import datetime

import assemblyai as aai
from groq import Groq
from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(ENV_FILE, override=True)

# Anchor all storage to the project root so notes are never lost in a
# different folder when the app is launched from another directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
AUDIO_DIR = PROJECT_ROOT / "audio"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"

aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")

MODEL = "llama-3.3-70b-versatile"

def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")
    return Groq(api_key=api_key)


def extract_audio(video_url: str, cookies_from_browser: str = None, cookies_file: str = None) -> dict:
    try:
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)

        def run_ytdlp(args):
            cmd = [sys.executable, "-m", "yt_dlp", "--no-update",
                   "--socket-timeout", "15", "--retries", "2", "--no-warnings"]
            if cookies_from_browser:
                cmd += ["--cookies-from-browser", cookies_from_browser]
            elif cookies_file:
                cmd += ["--cookies", cookies_file]
            cmd += args
            return subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        id_result = run_ytdlp(["--get-id", video_url])
        video_id = id_result.stdout.strip()
        if not video_id:
            return {"status": "error", "error": f"Could not extract video ID. {id_result.stderr}"}

        audio_path = str(AUDIO_DIR / f"{video_id}.mp3")

        run_ytdlp([
            "-x", "--audio-format", "mp3", "--audio-quality", "0",
            "-o", str(AUDIO_DIR / f"{video_id}.%(ext)s"), video_url
        ])

        if not os.path.exists(audio_path):
            files = sorted(AUDIO_DIR.glob("*.mp3"), key=os.path.getmtime, reverse=True)
            if not files:
                return {"status": "error", "error": "Audio file not found after download."}
            audio_path = str(files[0])

        return {"audio_path": audio_path, "status": "success"}

    except subprocess.TimeoutExpired:
        return {"status": "error", "error": "Download timed out (300s). Your network to YouTube may be slow or throttled — try again or deploy to the cloud."}
    except subprocess.CalledProcessError as e:
        return {"status": "error", "error": f"yt-dlp failed: {e.stderr}"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def transcribe_audio(audio_path: str) -> dict:
    try:
        config = aai.TranscriptionConfig(
            language_detection=True,
            speech_models=["universal-2"]
        )
        transcriber = aai.Transcriber(config=config)
        transcript = transcriber.transcribe(audio_path)

        if transcript.status == aai.TranscriptStatus.error:
            return {"status": "error", "error": transcript.error}

        return {
            "transcript": transcript.text,
            "detected_language": transcript.language_code,
            "status": "success"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def estimate_video_minutes(transcript: str) -> int:
    """Rough duration from transcript length (~150 words per minute of speech)."""
    words = len(transcript.split())
    minutes = max(1, round(words / 150))
    return minutes


def _length_guide(est_minutes: int) -> str:
    if est_minutes < 3:
        return (
            "This is a very short clip. Keep the notes EXTREMELY concise: "
            "3-6 tight bullet points, no more than ~80-120 words total."
        )
    if est_minutes < 8:
        return (
            "This is a short video. Keep the notes compact: "
            "5-9 tight bullet points or 2 short sections, no more than ~150-250 words."
        )
    if est_minutes < 20:
        return (
            "This is a medium-length video. Structure the notes as 2-4 short sections "
            "with tight bullets, no more than ~300-450 words."
        )
    return (
        "This is a long video. Structure the notes as 4-6 sections with tight bullets. "
        "Keep it scannable and skip filler — aim for at most ~600-700 words. "
        "Cover the key ideas, not every sentence."
    )


def generate_notes(transcript: str, detected_language: str, url: str) -> dict:
    try:
        lang_note = ""
        if detected_language and detected_language != "en":
            lang_note = f"Note: The transcript is in language '{detected_language}'. Translate it to English first, then generate the notes.\n\n"

        est_minutes = estimate_video_minutes(transcript)
        length_guide = _length_guide(est_minutes)

        prompt = f"""{lang_note}You are a personal knowledge assistant. Read the transcript below and:

1. Identify the content type:
   - tutorial/how-to       → numbered step-by-step guide
   - lecture/educational   → study notes with key concepts and definitions
   - podcast/interview     → key insights, themes, top takeaways
   - news                  → what happened, context, why it matters
   - meeting/discussion    → decisions, action items, follow-ups
   - motivational/talk     -> core message, key lessons, practical actions
   - general               → summary with key points

2. Generate the most useful structured output for that type.

IMPORTANT LENGTH RULE:
{length_guide}

The transcript is roughly {est_minutes} minute(s) of speech — scale your notes to that.
Always prefer short bullets over long paragraphs. No filler, no repetition, no pleasantries.

Start your response with these two lines exactly:
Type: <content type>
Title: <short descriptive title>

Then write the structured notes below.

Transcript:
{transcript}
"""

        response = get_groq_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are a personal knowledge assistant that generates structured, concise notes from video transcripts. Be brief and high-signal."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2048,
            temperature=0.3
        )

        notes = response.choices[0].message.content

        content_type = "general"
        title = "Video Notes"
        for line in notes.strip().split("\n")[:5]:
            if line.lower().startswith("type:"):
                content_type = line.split(":", 1)[1].strip()
            elif line.lower().startswith("title:"):
                title = line.split(":", 1)[1].strip()

        return {
            "status": "success",
            "notes": notes,
            "content_type": content_type,
            "title": title
        }

    except Exception as e:
        err = str(e)
        if "401" in err or "Invalid API Key" in err:
            return {"status": "error", "error": "GROQ_API_KEY is invalid or revoked. Regenerate it at https://console.groq.com/keys and update your .env file."}
        return {"status": "error", "error": err}


STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "of", "in", "on", "to", "for", "with", "at", "by",
    "from", "is", "are", "was", "were", "be", "been", "this", "that", "these", "those",
    "what", "which", "who", "whom", "how", "why", "when", "where", "it", "its", "as",
    "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them", "my", "your",
    "our", "their", "his", "hers", "do", "does", "did", "can", "could", "will", "would",
    "should", "have", "has", "had", "about", "into", "over", "under", "than", "then", "so",
    "if", "not", "no", "yes", "just", "like", "get", "got", "make", "also", "there", "here",
}


def _tokenize(text: str) -> Counter:
    words = re.findall(r"[a-z0-9']+", text.lower())
    return Counter(w for w in words if w not in STOPWORDS and len(w) > 1)


def search_memory(query: str, notes: list[dict], top_k: int = 6) -> list[dict]:
    """Rank saved notes by relevance to the query (title weighted higher)."""
    q = _tokenize(query)
    if not q:
        return notes[:top_k]

    scored = []
    for note in notes:
        title = _tokenize(note.get("title", ""))
        body = _tokenize(note.get("output", ""))
        score = 0.0
        for term, count in q.items():
            score += title.get(term, 0) * 3.0 + body.get(term, 0) * 1.0
        if score > 0:
            scored.append((score, note))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [note for _, note in scored[:top_k]]


def chat_with_memory(query: str, history: list[dict], notes: list[dict], max_context_chars: int = 22000) -> dict:
    """Answer a question using the user's whole saved-note memory as context."""
    try:
        relevant = search_memory(query, notes)
        if not relevant:
            return {"status": "success", "reply": "I couldn't find anything in your saved notes that matches that. Try asking about something you've generated notes for."}

        blocks = []
        for i, note in enumerate(relevant, 1):
            title = note.get("title", "Untitled")
            ctype = note.get("content_type", "general")
            output = (note.get("output") or "")[:6000]
            blocks.append(f"[Note {i}] Title: {title} ({ctype})\n{output}")
        context = "\n\n---\n\n".join(blocks)
        context = context[:max_context_chars]

        system_prompt = (
            "You are a personal memory assistant. The user has generated notes from various videos "
            "and stored them as memory. Answer the user's question using ONLY the notes below. "
            "Be concise and cite which note(s) you used (by title). If the notes don't contain the "
            "answer, say so plainly instead of guessing.\n\n"
            f"=== USER'S SAVED NOTES (most relevant first) ===\n{context}"
        )
        response = get_groq_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": system_prompt}, *history[-10:]],
            max_tokens=1024,
            temperature=0.3
        )
        return {"status": "success", "reply": response.choices[0].message.content}
    except Exception as e:
        err = str(e)
        if "401" in err or "Invalid API Key" in err:
            return {"status": "error", "error": "GROQ_API_KEY is invalid or revoked. Regenerate it at https://console.groq.com/keys and update your .env file."}
        return {"status": "error", "error": err}


def chat_with_notes(notes: str, messages: list[dict], max_context_chars: int = 16000) -> dict:
    """Answer questions about a video using ONLY the generated notes as context."""
    try:
        context = notes[:max_context_chars]
        system_prompt = (
            "You are a helpful study assistant. The user is asking questions about the notes "
            "below, which were generated from a video. Answer ONLY using the provided notes. "
            "Be concise and friendly. If the answer is not in the notes, say so plainly "
            "instead of guessing. Format short lists with bullet points when useful.\n\n"
            f"=== VIDEO NOTES ===\n{context}"
        )
        response = get_groq_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": system_prompt}, *messages[-12:]],
            max_tokens=1024,
            temperature=0.3
        )
        return {"status": "success", "reply": response.choices[0].message.content}
    except Exception as e:
        err = str(e)
        if "401" in err or "Invalid API Key" in err:
            return {"status": "error", "error": "GROQ_API_KEY is invalid or revoked. Regenerate it at https://console.groq.com/keys and update your .env file."}
        return {"status": "error", "error": err}


def save_output(title: str, content_type: str, output: str, url: str) -> dict:
    try:
        OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_type = content_type.replace(" ", "_").replace("/", "_")
        base_name = str(OUTPUTS_DIR / f"{timestamp}_{safe_type}")

        record = {
            "url": url,
            "title": title,
            "type": content_type,
            "output": output,
            "saved_at": datetime.now().isoformat()
        }

        json_file = f"{base_name}.json"
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2, ensure_ascii=False)

        txt_file = f"{base_name}.txt"
        with open(txt_file, "w", encoding="utf-8") as f:
            f.write(f"Title   : {title}\n")
            f.write(f"Type    : {content_type}\n")
            f.write(f"URL     : {url}\n")
            f.write(f"Saved   : {record['saved_at']}\n")
            f.write("\n" + "=" * 60 + "\n\n")
            f.write(output)

        return {"status": "saved", "json_file": json_file, "txt_file": txt_file}

    except Exception as e:
        return {"status": "error", "error": str(e)}


def process_video_sync(url: str, save: bool = True) -> dict:
    """Run the full pipeline synchronously and return a structured result dict
    that includes the saved note id, so callers can respond without re-querying."""
    cookies_browser = os.environ.get("YTDLP_COOKIES_BROWSER")
    cookies_file = os.environ.get("YTDLP_COOKIES_FILE")
    print("  [1/4] Downloading audio...")
    audio_result = extract_audio(url, cookies_from_browser=cookies_browser, cookies_file=cookies_file)
    if audio_result["status"] == "error":
        return {"status": "error", "error": f"Download failed: {audio_result['error']}"}

    print("  [2/4] Transcribing...")
    transcript_result = transcribe_audio(audio_result["audio_path"])
    if transcript_result["status"] == "error":
        return {"status": "error", "error": f"Transcription failed: {transcript_result['error']}"}

    print("  [3/4] Generating notes...")
    notes_result = generate_notes(
        transcript=transcript_result["transcript"],
        detected_language=transcript_result.get("detected_language", "en"),
        url=url
    )
    if notes_result["status"] == "error":
        return {"status": "error", "error": f"Note generation failed: {notes_result['error']}"}

    print("  [4/4] Saving...")
    # Persist every generated note: a .txt/.json copy in outputs/ AND a row in
    # the history database so it shows up in History, Memory chat and search.
    note_id = None
    txt_file = None
    if save:
        save_result = save_output(
            title=notes_result["title"],
            content_type=notes_result["content_type"],
            output=notes_result["notes"],
            url=url
        )
        if save_result["status"] == "saved":
            txt_file = save_result["txt_file"]
        try:
            from notes_ai.database import save_note
            note_id = save_note(
                url=url,
                title=notes_result["title"],
                content_type=notes_result["content_type"],
                output=notes_result["notes"],
                language=transcript_result.get("detected_language", "en"),
            )
        except Exception as e:
            return {"status": "error", "error": f"Notes were generated but could not be saved to memory: {e}"}

    return {
        "status": "success",
        "note_id": note_id,
        "title": notes_result["title"],
        "content_type": notes_result["content_type"],
        "notes": notes_result["notes"],
        "language": transcript_result.get("detected_language", "en"),
        "txt_file": txt_file,
    }


def run_agent(url: str, save: bool = True) -> str:
    """Full pipeline; returns the notes as a string (or an [ERROR] line)."""
    result = process_video_sync(url, save=save)
    if result["status"] == "error":
        return f"[ERROR] {result['error']}"

    output = result["notes"]
    if result.get("txt_file"):
        output += f"\n\n{'-' * 29}\n"
        output += f"Saved to: {result['txt_file']}"

    return output
