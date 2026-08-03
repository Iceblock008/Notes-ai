FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

RUN mkdir -p outputs audio data

ENV PORT=8080
ENV HOST=0.0.0.0
ENV PYTHONPATH=/app/src

EXPOSE 8080

CMD ["python", "-c", "from notes_ai.web_app import run_server; run_server()"]