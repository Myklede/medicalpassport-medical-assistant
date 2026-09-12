"""Local research sessions: atomic image + measurement storage in ignored SQLite.

Opaque session IDs are local access capabilities, not clinical user authentication.
No public patient listing, client filesystem paths, or dynamic SQL identifiers.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sqlite3
import uuid

from fastapi import HTTPException

if __package__:
    from .inference_tracker import format_clinical_brief
else:
    from inference_tracker import format_clinical_brief


def timestamp_utc(raw=None):
    if raw is None:
        return datetime.now(timezone.utc).isoformat()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("Timezone required")
        return parsed.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(422, "timestamp must be ISO 8601 with a timezone.") from None


def model_signature(brief):
    visit = brief["objective_measurements"]["visits"][0]
    segmentation = visit.get("segmentation_provenance", {})
    return [brief.get("provenance", {}).get("checkpoint_sha256"),
            (segmentation.get("binary") or {}).get("checkpoint_sha256"),
            (segmentation.get("tissue") or {}).get("checkpoint_sha256"), segmentation.get("processing_version")]


class WoundSessionStore:
    def __init__(self, path):
        self.path = Path(path)

    @contextmanager
    def connection(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            db.execute("PRAGMA foreign_keys = ON")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS wound_sessions (
                    id TEXT PRIMARY KEY, profile TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS wound_session_visits (
                    id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES wound_sessions(id) ON DELETE CASCADE,
                    day REAL NOT NULL, timestamp TEXT NOT NULL, image BLOB NOT NULL, mime TEXT NOT NULL,
                    measurement TEXT NOT NULL, provenance TEXT NOT NULL, signature TEXT NOT NULL,
                    UNIQUE(session_id, day));
            """)
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def session(db, session_id):
        if not re.fullmatch(r"[0-9a-f]{32}", session_id):
            raise HTTPException(404, "Wound session not found.")
        row = db.execute("SELECT * FROM wound_sessions WHERE id=?", (session_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Wound session not found.")
        return row

    def create(self, profile):
        session_id = uuid.uuid4().hex
        with self.connection() as db:
            db.execute("INSERT INTO wound_sessions VALUES (?,?,?)",
                       (session_id, json.dumps(profile, allow_nan=False), timestamp_utc()))
        return self.get(session_id)

    def get(self, session_id):
        with self.connection() as db:
            return self.snapshot(db, session_id)

    def snapshot(self, db, session_id):
        session = self.session(db, session_id)
        rows = db.execute("SELECT id,day,timestamp,measurement,provenance FROM wound_session_visits WHERE session_id=? ORDER BY day",
                          (session_id,)).fetchall()
        profile = json.loads(session["profile"])
        visits = [json.loads(row["measurement"]) for row in rows]
        brief = format_clinical_brief(visits, profile, json.loads(rows[-1]["provenance"])) if rows else None
        return {"session_id": session_id, "patient_id": profile["patient_id"], "patient_profile": profile,
                "created_at": session["created_at"], "storage_provider": "local_sqlite", "baseline_locked": True,
                "visits": [{"visit_id": row["id"], "day": row["day"], "timestamp": row["timestamp"],
                            "image_path": f"/api/wound-sessions/{session_id}/visits/{row['id']}/image"} for row in rows],
                "brief": brief}

    def append(self, session_id, patient_id, content, mime, brief, timestamp, timestamp_source):
        visit = dict(brief["objective_measurements"]["visits"][0])
        signature = model_signature(brief)
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            session = self.session(db, session_id)
            if json.loads(session["profile"])["patient_id"] != patient_id or brief["patient_id"] != patient_id:
                raise HTTPException(409, "Patient does not match the locked session baseline.")
            rows = db.execute("SELECT day,timestamp,measurement,signature FROM wound_session_visits WHERE session_id=? ORDER BY day",
                              (session_id,)).fetchall()
            if len(rows) >= 30:
                raise HTTPException(409, "This research session is limited to 30 visits.")
            if rows and (visit["day"] <= rows[-1]["day"] or timestamp <= rows[-1]["timestamp"]):
                raise HTTPException(409, "Visit day and timestamp must be later than the last stored visit.")
            for row in rows:
                saved = json.loads(row["measurement"])
                if saved["image_sha256"] == visit["image_sha256"]:
                    raise HTTPException(409, "This image is already stored in the session; upload a new capture.")
                if saved.get("measurement_status") == visit.get("measurement_status") == "available" and json.loads(row["signature"]) != signature:
                    raise HTTPException(409, "Model or preprocessing changed. Start a new session to keep comparisons consistent.")
            visit_id = uuid.uuid4().hex
            visit.update(timestamp=timestamp, timestamp_source=timestamp_source, visit_id=visit_id)
            db.execute("INSERT INTO wound_session_visits VALUES (?,?,?,?,?,?,?,?,?)",
                       (visit_id, session_id, visit["day"], timestamp, content, mime, json.dumps(visit, allow_nan=False),
                        json.dumps(brief["provenance"], allow_nan=False), json.dumps(signature),))
            result = self.snapshot(db, session_id)
        if "pipeline_visuals" in brief:
            result["brief"]["pipeline_visuals"] = brief["pipeline_visuals"]
        return result

    def image(self, session_id, visit_id):
        with self.connection() as db:
            self.session(db, session_id)
            row = db.execute("SELECT image,mime FROM wound_session_visits WHERE session_id=? AND id=?",
                             (session_id, visit_id)).fetchone()
            if row is None:
                raise HTTPException(404, "Visit image not found.")
            return row["image"], row["mime"]
