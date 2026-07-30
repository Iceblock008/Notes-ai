import os
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path("outputs") / "notes.db"

@contextmanager
def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                content_type TEXT NOT NULL,
                output TEXT NOT NULL,
                language TEXT DEFAULT 'en',
                created_at TEXT NOT NULL,
                updated_at TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC)")
        conn.commit()


def save_note(url: str, title: str, content_type: str, output: str, language: str = "en") -> int:
    init_db()
    now = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO notes (url, title, content_type, output, language, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (url, title, content_type, output, language, now)
        )
        conn.commit()
        return cursor.lastrowid


def get_all_notes(limit: int = 100) -> list[dict]:
    init_db()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM notes ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(row) for row in rows]


def get_note(note_id: int) -> dict | None:
    init_db()
    with get_db() as conn:
        row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
        return dict(row) if row else None


def delete_note(note_id: int) -> bool:
    init_db()
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        conn.commit()
        return cursor.rowcount > 0


def update_note(note_id: int, title: str = None, output: str = None) -> bool:
    init_db()
    with get_db() as conn:
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if output is not None:
            updates.append("output = ?")
            params.append(output)
        if not updates:
            return False
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(note_id)
        cursor = conn.execute(
            f"UPDATE notes SET {', '.join(updates)} WHERE id = ?", params
        )
        conn.commit()
        return cursor.rowcount > 0