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
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_conversations_user
            ON conversations (user_id, updated_at DESC)
            """
        )
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


def ensure_conversation(
    conversation_id: str,
    user_id: str,
    title: str,
    db_path: str | Path = DEFAULT_MEMORY_DB_PATH,
) -> None:
    """Create a user-owned conversation or verify ownership of an existing one."""
    path = initialize_memory_db(db_path)
    with sqlite3.connect(path) as connection:
        row = connection.execute(
            "SELECT user_id FROM conversations WHERE id = ?", (conversation_id,)
        ).fetchone()
        if row and row[0] != user_id:
            raise PermissionError("Conversation does not belong to this user.")
        if not row:
            clean_title = " ".join(title.split())[:80] or "New conversation"
            connection.execute(
                "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
                (conversation_id, user_id, clean_title),
            )


def touch_conversation(
    conversation_id: str, db_path: str | Path = DEFAULT_MEMORY_DB_PATH
) -> None:
    path = initialize_memory_db(db_path)
    with sqlite3.connect(path) as connection:
        connection.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (conversation_id,),
        )


def list_user_conversations(
    user_id: str, db_path: str | Path = DEFAULT_MEMORY_DB_PATH
) -> list[dict[str, str]]:
    path = initialize_memory_db(db_path)
    with sqlite3.connect(path) as connection:
        rows = connection.execute(
            """
            SELECT id, title, created_at, updated_at
            FROM conversations
            WHERE user_id = ?
            ORDER BY updated_at DESC, id DESC
            """,
            (user_id,),
        ).fetchall()
    return [
        {"id": row[0], "title": row[1], "created_at": row[2], "updated_at": row[3]}
        for row in rows
    ]


def get_user_conversation(
    conversation_id: str,
    user_id: str,
    db_path: str | Path = DEFAULT_MEMORY_DB_PATH,
) -> dict:
    path = initialize_memory_db(db_path)
    with sqlite3.connect(path) as connection:
        row = connection.execute(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, user_id),
        ).fetchone()
    if not row:
        raise LookupError("Conversation not found.")
    return {
        "id": row[0],
        "title": row[1],
        "created_at": row[2],
        "updated_at": row[3],
        "messages": get_conversation_history(conversation_id, limit=500, db_path=path),
    }


def delete_user_conversation(
    conversation_id: str,
    user_id: str,
    db_path: str | Path = DEFAULT_MEMORY_DB_PATH,
) -> None:
    path = initialize_memory_db(db_path)
    with sqlite3.connect(path) as connection:
        deleted = connection.execute(
            "DELETE FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, user_id),
        ).rowcount
        if not deleted:
            raise LookupError("Conversation not found.")
        connection.execute(
            "DELETE FROM conversation_memory WHERE session_id = ?", (conversation_id,)
        )


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
