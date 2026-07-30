# ─── FILE: agent.py ──────────────────────────────────────────────────────────

import os
import subprocess
import json
import sys
from pathlib import Path
from datetime import datetime

import assemblyai as aai
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MODEL = "llama-3.3-70b-versatile"


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Extract Audio
# ─────────────────────────────────────────────────────────────────────────────
def extract_audio(video_url: str) -> dict:
    try:
        os.makedirs("audio", exist_ok=True)

        id_result = subprocess.run(
            [sys.executable, "-m", "yt_dlp", "--no-update", "--get-id", video_url],
            capture_output=True, text=True
        )
        video_id = id_result.stdout.strip()
        if not video_id:
            return {"status": "error", "error": "Could not extract video ID."}

        audio_path = f"audio/{video_id}.mp3"

        subprocess.run([
            sys.executable, "-m", "yt_dlp", "--no-update", "-x",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "-o", f"audio/{video_id}.%(ext)s",
            video_url
        ], check=True)

        if not os.path.exists(audio_path):
            files = sorted(Path("audio").glob("*.mp3"), key=os.path.getmtime, reverse=True)
            if not files:
                return {"status": "error", "error": "Audio file not found after download."}
            audio_path = str(files[0])

        return {"audio_path": audio_path, "status": "success"}

    except subprocess.CalledProcessError as e:
        return {"status": "error", "error": f"yt-dlp failed: {str(e)}"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Transcribe Audio
# ─────────────────────────────────────────────────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Generate Notes using Groq (no tool use, just plain chat)
# ─────────────────────────────────────────────────────────────────────────────
def generate_notes(transcript: str, detected_language: str, url: str) -> dict:
    try:
        lang_note = ""
        if detected_language and detected_language != "en":
            lang_note = f"Note: The transcript is in language '{detected_language}'. Translate it to English first, then generate the notes.\n\n"

        prompt = f"""{lang_note}You are a personal knowledge assistant. Read the transcript below and:

1. Identify the content type:
   - tutorial/how-to       → numbered step-by-step guide
   - lecture/educational   → study notes with key concepts and definitions
   - podcast/interview     → key insights, themes, top takeaways
   - news                  → what happened, context, why it matters
   - meeting/discussion    → decisions, action items, follow-ups
   - motivational/talk     -> core message, key lessons, practical actions
   - general               → full summary with key points

2. Generate the most useful structured output for that type.

Start your response with these two lines exactly:
Type: <content type>
Title: <short descriptive title>

Then write the full structured notes below.

Transcript:
{transcript}
"""

        response = groq_client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are a personal knowledge assistant that generates structured, useful notes from video transcripts."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=4096,
            temperature=0.3
        )

        notes = response.choices[0].message.content

        # Parse type and title from first lines
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
        return {"status": "error", "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Save Output
# ─────────────────────────────────────────────────────────────────────────────
def save_output(title: str, content_type: str, output: str, url: str) -> dict:
    try:
        os.makedirs("outputs", exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_type = content_type.replace(" ", "_").replace("/", "_")
        base_name = f"outputs/{timestamp}_{safe_type}"

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


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE — runs all steps in sequence, no tool use needed
# ─────────────────────────────────────────────────────────────────────────────
def run_agent(url: str) -> str:

    # Step 1
    print("  [1/4] Downloading audio...")
    audio_result = extract_audio(url)
    if audio_result["status"] == "error":
        return f"[ERROR] Download failed: {audio_result['error']}"

    # Step 2
    print("  [2/4] Transcribing...")
    transcript_result = transcribe_audio(audio_result["audio_path"])
    if transcript_result["status"] == "error":
        return f"[ERROR] Transcription failed: {transcript_result['error']}"

    # Step 3
    print("  [3/4] Generating notes...")
    notes_result = generate_notes(
        transcript=transcript_result["transcript"],
        detected_language=transcript_result.get("detected_language", "en"),
        url=url
    )
    if notes_result["status"] == "error":
        return f"[ERROR] Note generation failed: {notes_result['error']}"

    # Step 4
    print("  [4/4] Saving...")
    save_result = save_output(
        title=notes_result["title"],
        content_type=notes_result["content_type"],
        output=notes_result["notes"],
        url=url
    )

    output = notes_result["notes"]
    if save_result["status"] == "saved":
        output += f"\n\n{"-" * 29}\n"
        output += f"Saved to: {save_result['txt_file']}"

    return output