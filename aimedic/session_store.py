"""Local research sessions: atomic image + measurement storage in ignored SQLite.

Opaque session IDs are local access capabilities, not clinical user authentication.
Listings require a patient identity; explicit deletion is the only removal path.
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
                    pipeline_visuals TEXT,
                    UNIQUE(session_id, day));
            """)
            # Additive migration preserves every existing image and measurement.
            columns = {row["name"] for row in db.execute("PRAGMA table_info(wound_session_visits)")}
            if "pipeline_visuals" not in columns:
                db.execute("ALTER TABLE wound_session_visits ADD COLUMN pipeline_visuals TEXT")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def session(db, session_id, patient_id=None):
        if not re.fullmatch(r"[0-9a-f]{32}", session_id):
            raise HTTPException(404, "Wound session not found.")
        row = db.execute("SELECT * FROM wound_sessions WHERE id=?", (session_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Wound session not found.")
        if patient_id is not None and json.loads(row["profile"])["patient_id"] != patient_id:
            raise HTTPException(404, "Wound session not found for this patient.")
        return row

    def create(self, profile):
        session_id = uuid.uuid4().hex
        with self.connection() as db:
            db.execute("INSERT INTO wound_sessions VALUES (?,?,?)",
                       (session_id, json.dumps(profile, allow_nan=False), timestamp_utc()))
        return self.get(session_id)

    def list(self, patient_id):
        with self.connection() as db:
            rows = db.execute("""SELECT s.id,s.profile,s.created_at,
                COUNT(v.id) AS visit_count,MAX(v.day) AS latest_day,
                COALESCE(MAX(v.timestamp),s.created_at) AS updated_at
                FROM wound_sessions s LEFT JOIN wound_session_visits v ON v.session_id=s.id
                WHERE json_extract(s.profile,'$.patient_id')=?
                GROUP BY s.id ORDER BY updated_at DESC,s.created_at DESC""", (patient_id,)).fetchall()
            return {"storage_provider": "local_sqlite", "sessions": [
                {"session_id": row["id"], "patient_id": patient_id, "created_at": row["created_at"],
                 "updated_at": row["updated_at"], "visit_count": row["visit_count"],
                 "latest_day": row["latest_day"], "storage_provider": "local_sqlite",
                 "baseline_locked": True} for row in rows]}

    def get(self, session_id, patient_id=None):
        with self.connection() as db:
            return self.snapshot(db, session_id, patient_id)

    def snapshot(self, db, session_id, patient_id=None):
        session = self.session(db, session_id, patient_id)
        rows = db.execute("SELECT id,day,timestamp,measurement,provenance FROM wound_session_visits WHERE session_id=? ORDER BY day",
                          (session_id,)).fetchall()
        profile = json.loads(session["profile"])
        visits = [json.loads(row["measurement"]) for row in rows]
        brief = format_clinical_brief(visits, profile, json.loads(rows[-1]["provenance"])) if rows else None
        return {"session_id": session_id, "patient_id": profile["patient_id"], "patient_profile": profile,
                "created_at": session["created_at"], "storage_provider": "local_sqlite", "baseline_locked": True,
                "visits": [{"visit_id": row["id"], "day": row["day"], "timestamp": row["timestamp"],
                            "analysis_status": visits[index].get("analysis_status", "completed"),
                            "analysis_message": visits[index].get("analysis_message"),
                            "image_path": f"/api/wound-sessions/{session_id}/visits/{row['id']}/image"} for index, row in enumerate(rows)],
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
            if len(rows) >= 1000:
                raise HTTPException(409, "This episode has reached 1,000 visits. Existing visits remain saved; start another episode to continue.")
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
            db.execute("""INSERT INTO wound_session_visits
                       (id,session_id,day,timestamp,image,mime,measurement,provenance,signature,pipeline_visuals)
                       VALUES (?,?,?,?,?,?,?,?,?,?)""",
                       (visit_id, session_id, visit["day"], timestamp, content, mime, json.dumps(visit, allow_nan=False),
                        json.dumps(brief["provenance"], allow_nan=False), json.dumps(signature),
                        json.dumps(brief["pipeline_visuals"], allow_nan=False) if "pipeline_visuals" in brief else None))
            result = self.snapshot(db, session_id)
        if "pipeline_visuals" in brief:
            result["brief"]["pipeline_visuals"] = brief["pipeline_visuals"]
        return result

    def pending_input(self, session_id, visit_id, patient_id):
        with self.connection() as db:
            session = self.session(db, session_id, patient_id)
            row = db.execute("SELECT image,mime,measurement FROM wound_session_visits WHERE session_id=? AND id=?",
                             (session_id, visit_id)).fetchone()
            if row is None:
                raise HTTPException(404, "Wound visit not found.")
            measurement = json.loads(row["measurement"])
            if measurement.get("analysis_status") != "pending_model":
                raise HTTPException(409, "This visit already has an analysis. Saved measurements are not silently replaced.")
            return {"profile": json.loads(session["profile"]), "measurement": measurement,
                    "image": row["image"], "mime": row["mime"], "measurement_version": row["measurement"]}

    def complete_pending(self, session_id, visit_id, patient_id, brief, expected_measurement):
        """Atomic retry: capture identity/timing remain fixed and images never move."""
        visit = dict(brief["objective_measurements"]["visits"][0])
        signature = model_signature(brief)
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            self.session(db, session_id, patient_id)
            row = db.execute("SELECT measurement FROM wound_session_visits WHERE session_id=? AND id=?",
                             (session_id, visit_id)).fetchone()
            if row is None:
                raise HTTPException(404, "Wound visit not found.")
            saved = json.loads(row["measurement"])
            if row["measurement"] != expected_measurement or saved.get("analysis_status") != "pending_model":
                raise HTTPException(409, "This capture changed while analysis was running. Reload the saved visit.")
            if (brief["patient_id"] != patient_id or visit["day"] != saved["day"]
                    or visit["image_sha256"] != saved["image_sha256"]):
                raise HTTPException(409, "Analysis does not match the saved patient and capture.")
            peers = db.execute("SELECT measurement,signature FROM wound_session_visits WHERE session_id=? AND id<>?",
                               (session_id, visit_id)).fetchall()
            for peer in peers:
                other = json.loads(peer["measurement"])
                if other.get("measurement_status") == visit.get("measurement_status") == "available" and json.loads(peer["signature"]) != signature:
                    raise HTTPException(409, "Model or preprocessing differs from completed visits. Restore the matching model before retrying this capture.")
            visit.update(timestamp=saved["timestamp"], timestamp_source=saved["timestamp_source"], visit_id=visit_id,
                         pixels_per_cm=saved.get("pixels_per_cm"),
                         capture_conditions_consistent=saved.get("capture_conditions_consistent", False),
                         clinical_observations=saved.get("clinical_observations", {}),
                         analysis_status="completed", analysis_updated_at=timestamp_utc())
            db.execute("""UPDATE wound_session_visits SET measurement=?,provenance=?,signature=?,pipeline_visuals=?
                          WHERE session_id=? AND id=?""",
                       (json.dumps(visit, allow_nan=False), json.dumps(brief["provenance"], allow_nan=False),
                        json.dumps(signature), json.dumps(brief["pipeline_visuals"], allow_nan=False) if "pipeline_visuals" in brief else None,
                        session_id, visit_id))
            result = self.snapshot(db, session_id, patient_id)
        return result

    def visit(self, session_id, visit_id, patient_id=None):
        with self.connection() as db:
            session = self.session(db, session_id, patient_id)
            row = db.execute("SELECT * FROM wound_session_visits WHERE session_id=? AND id=?",
                             (session_id, visit_id)).fetchone()
            if row is None:
                raise HTTPException(404, "Wound visit not found.")
            rows = db.execute("SELECT measurement FROM wound_session_visits WHERE session_id=? AND day<=? ORDER BY day",
                              (session_id, row["day"])).fetchall()
            profile = json.loads(session["profile"])
            brief = format_clinical_brief([json.loads(item["measurement"]) for item in rows], profile,
                                          json.loads(row["provenance"]))
            if row["pipeline_visuals"]:
                brief["pipeline_visuals"] = json.loads(row["pipeline_visuals"])
            return {"session_id": session_id, "patient_id": profile["patient_id"],
                    "visit_id": visit_id, "brief": brief}

    def delete(self, session_id, patient_id):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            self.session(db, session_id, patient_id)
            count = db.execute("SELECT COUNT(*) FROM wound_session_visits WHERE session_id=?", (session_id,)).fetchone()[0]
            db.execute("DELETE FROM wound_sessions WHERE id=?", (session_id,))
            return {"deleted": True, "session_id": session_id, "deleted_visit_count": count}

    def delete_visit(self, session_id, visit_id, patient_id):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            self.session(db, session_id, patient_id)
            removed = db.execute("DELETE FROM wound_session_visits WHERE session_id=? AND id=?", (session_id, visit_id))
            if removed.rowcount != 1:
                raise HTTPException(404, "Wound visit not found.")
            return self.snapshot(db, session_id, patient_id)

    def image(self, session_id, visit_id, patient_id=None):
        with self.connection() as db:
            self.session(db, session_id, patient_id)
            row = db.execute("SELECT image,mime FROM wound_session_visits WHERE session_id=? AND id=?",
                             (session_id, visit_id)).fetchone()
            if row is None:
                raise HTTPException(404, "Visit image not found.")
            return row["image"], row["mime"]
