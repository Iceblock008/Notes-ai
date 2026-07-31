# Speed Optimization for Video Notes AI

## Methods to Reduce Processing Time

### 1. Audio Download Optimizations
- Lower audio quality (`--audio-quality 2` instead of `0`)
- Skip FFmpeg network transport (`--ignore-config`, `--format-check`)
- Use cheaper proxy for large videos

### 2. Transcription Optimizations
- Use faster AssemblyAI model (consider `basic-1` or `universal-1` for shorter videos)
- Enable `language_detection=True` only when necessary
- Use `enable_auto_highlights=False` to save time
- Implement sample rate reduction (16kHz vs 44.1kHz)

### 3. LLM Generation Optimizations
- Reduce `max_tokens` to 2048 (most video transcripts fit this)
- Increase `temperature` slightly for faster processing (0.5 instead of 0.3)
- Use faster Groq model (`llama-3.1-8b-instruct` instead of `llama-3.3-70b-versatile`)
- Add caching for repeated URLs

### 4. Smart Caching
```
def is_recent_cached(video_id, max_age_hours=24):
    cache_file = f"cache/{video_id}.json"
    if os.path.exists(cache_file):
        data = json.load(open(cache_file))
        if time.time() - data.get('timestamp', 0) < max_age_hours * 3600:
            return data
    return None
```

### 5. Frontend Optimizations (in web_app.py)
- Show "skip audio download" option for short videos (< 2 minutes)
- Provide "fast mode" for quick transcription (sacrifices accuracy for speed)
- Use WebAssembly acceleration if available

### 6. Architecture Changes
Consider implementing:
- Queue-based processing
- Batch processing for multiple videos
- Background processing with WebSockets
- Progressive transcription (start analysis while downloading continues)

## Config File Template (.env)

```
# Speed Settings
SPEED_MODE=balanced  # or "fast", "quality"
AUDIO_QUALITY=2      # 0=best, 2=balanced, 9=worst
TRANSCRIPTION_MODEL=universal-2  # or "universal-1" for speed
LLM_MODEL=llama-3.1-8b-instruct  # or llama-3.3-70b-versatile
MAX_TOKENS=2048

# Cache Settings
CACHE_ENABLED=true
CACHE_TTL=24h

# Progress Optimization
FAST_MODE=false  # Allow lower-quality transcripts for speed
```