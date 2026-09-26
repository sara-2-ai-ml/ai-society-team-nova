"""Small SQLite-backed conversation memory for the Bashkia 360 assistant."""

import sqlite3
from pathlib import Path


DEFAULT_MEMORY_DB_PATH = Path(__file__).resolve().parents[1] / "bashkia360_memory.db"
ALLOWED_ROLES = {"user", "assistant"}


def initialize_memory_db(db_path: str | Path = DEFAULT_MEMORY_DB_PATH) -> Path:
    """Create the conversation table when it does not already exist."""
    path = Path(db_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS conversation_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_conversation_memory_session
            ON conversation_memory (session_id, id)
            """
        )
    return path


def save_message(
    session_id: str,
    role: str,
    content: str,
    db_path: str | Path = DEFAULT_MEMORY_DB_PATH,
) -> None:
    """Persist one user or final assistant message using parameterized SQL."""
    if role not in ALLOWED_ROLES:
        raise ValueError("Memory role must be 'user' or 'assistant'.")
    if not session_id.strip():
        raise ValueError("session_id must not be empty.")
    if not content.strip():
        raise ValueError("Message content must not be empty.")

    path = initialize_memory_db(db_path)
    with sqlite3.connect(path) as connection:
        connection.execute(
            """
            INSERT INTO conversation_memory (session_id, role, content)
            VALUES (?, ?, ?)
            """,
            (session_id, role, content),
        )


def get_conversation_history(
    session_id: str,
    limit: int = 10,
    db_path: str | Path = DEFAULT_MEMORY_DB_PATH,
) -> list[dict[str, str]]:
    """Return the most recent messages in chronological order."""
    if limit <= 0:
        return []
    path = initialize_memory_db(db_path)
    with sqlite3.connect(path) as connection:
        rows = connection.execute(
            """
            SELECT role, content, created_at
            FROM (
                SELECT id, role, content, created_at
                FROM conversation_memory
                WHERE session_id = ?
                ORDER BY id DESC
                LIMIT ?
            )
            ORDER BY id ASC
            """,
            (session_id, limit),
        ).fetchall()
    return [
        {"role": role, "content": content, "created_at": created_at}
        for role, content, created_at in rows
    ]


def clear_session_memory(
    session_id: str,
    db_path: str | Path = DEFAULT_MEMORY_DB_PATH,
) -> None:
    """Delete messages for one session without affecting other sessions."""
    path = initialize_memory_db(db_path)
    with sqlite3.connect(path) as connection:
        connection.execute(
            "DELETE FROM conversation_memory WHERE session_id = ?",
            (session_id,),
        )
