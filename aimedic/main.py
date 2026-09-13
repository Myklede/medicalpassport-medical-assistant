#!/usr/bin/env python3
"""Script 5: local FastAPI adapter, tested with Python 3.14.

Run: python aimedic/main.py
Or:  python -m uvicorn aimedic.main:app --host 127.0.0.1 --port 8000

POST /api/analyze-wound as multipart/form-data:
  image: PNG/JPEG upload
  patient_data: JSON string with the baseline fields used by encode_profile()
  day: optional nonnegative relative day; default 0 is this capture's baseline
  include_pipeline_visuals: optional boolean; default false preserves the v1 brief

MEDIPASS_MODEL_PATH overrides the server-side checkpoint path.
MEDIPASS_VISUAL_MODEL_PATH overrides the supplied binary wound U-Net checkpoint.
MEDIPASS_TISSUE_MODEL_PATH overrides the separate synthetic tissue overlay model.
MEDIPASS_CORS_ORIGINS overrides the comma-separated local frontend origins.
Single-image requests cannot establish a trajectory. Wound-session routes retain
ordered captures locally in SQLite; /api/analyze-trajectory accepts metrics only.
"""
import base64
import hashlib
import json
import logging
import os
import pickle
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated

import cv2
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field

if __package__:
    from .inference_tracker import track_wound, format_clinical_brief
    from .trajectory_rules import validate_observations, validate_baseline_context
    from .multimodal_model import encode_profile, load_rgb_image
    from .visual_pipeline import DEFAULT_WOUND_CHECKPOINT
    from .session_store import WoundSessionStore, timestamp_utc
else:
    from inference_tracker import track_wound, format_clinical_brief
    from trajectory_rules import validate_observations, validate_baseline_context
    from multimodal_model import encode_profile, load_rgb_image
    from visual_pipeline import DEFAULT_WOUND_CHECKPOINT
    from session_store import WoundSessionStore, timestamp_utc

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHECKPOINT = ROOT / "outputs" / "pwc-run" / "best.pt"
DEFAULT_VISUAL_CHECKPOINT = DEFAULT_WOUND_CHECKPOINT
MAX_IMAGE_BYTES = 8 * 1024 * 1024
DEFAULT_ORIGINS = (
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:3001", "http://127.0.0.1:3001",
)
logger = logging.getLogger("medipass.wound_api")


def parse_patient_data(raw: str) -> dict:
    try:
        profile = json.loads(raw)
        if not isinstance(profile, dict):
            raise ValueError("patient_data must be a JSON object")
        encode_profile(profile)  # Reuse the model's bounds and strict boolean checks.
        validate_baseline_context(profile)
        json.dumps(profile, allow_nan=False)  # Reject NaN/Infinity in extra fields too.
        return profile
    except (ValueError, TypeError, RecursionError) as exc:
        # Do not echo the patient's JSON into error responses or logs.
        raise HTTPException(422, "Invalid patient_data: provide a JSON object with valid age, "
                            "hba1c_level, blood_type, has_diabetes_type_2 and hypertension.") from exc


def parse_observations(raw):
    try:
        return validate_observations(json.loads(raw) if raw is not None else None)
    except (ValueError, TypeError, RecursionError) as exc:
        raise HTTPException(422, "Invalid clinical_observations: use a reported source and boolean observation fields.") from exc


class TrajectoryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patient_data: dict
    visits: list[dict] = Field(min_length=1, max_length=30)


def analyze_upload(content: bytes, suffix: str, profile: dict, day: float, checkpoint: Path,
                   include_pipeline_visuals: bool = False, visual_checkpoint: Path | None = None,
                   pixels_per_cm: float | None = None, clinical_observations=None) -> dict:
    """Synchronous disk/decoder/PyTorch work; called in FastAPI's worker thread."""
    with TemporaryDirectory(prefix="medipass-wound-") as temporary:
        folder = Path(temporary)
        # Never use the uploaded filename as a filesystem path.
        image_path = folder / f"capture{suffix}"
        profile_path = folder / "patient_profile.json"
        image_path.write_bytes(content)
        profile_path.write_text(json.dumps(profile, allow_nan=False), encoding="utf-8")
        try:
            load_rgb_image(image_path)  # Verify that the image really decodes.
        except (ValueError, OSError, cv2.error) as exc:
            raise HTTPException(422, "The uploaded image is corrupt or cannot be decoded.") from exc
        if not checkpoint.is_file():
            raise HTTPException(503, "Model checkpoint unavailable. Train the model or set MEDIPASS_MODEL_PATH.")
        try:
            return track_wound(
                image_paths=[image_path], patient_profile_path=profile_path,
                checkpoint_path=checkpoint, days=[day], device="cpu",
                include_pipeline_visuals=include_pipeline_visuals, visual_checkpoint_path=visual_checkpoint,
                segmented_measurements=True, pixels_per_cm=[pixels_per_cm],
                clinical_observations=[clinical_observations],
            )
        except (ValueError, KeyError, OSError, RuntimeError, pickle.UnpicklingError) as exc:
            logger.error("Model inference unavailable (%s)", type(exc).__name__)
            raise HTTPException(503, "Model inference unavailable; verify the trained checkpoint and its compatibility.") from exc
        # TemporaryDirectory cleans up on success AND exception, including on Windows.


async def read_upload(image):
    if image.content_type not in ("image/png", "image/jpeg"):
        raise HTTPException(415, "Upload a PNG or JPEG image.")
    content = await image.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image exceeds the 8 MiB upload limit.")
    if not content:
        raise HTTPException(422, "The uploaded image is empty.")
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        suffix, detected_type = ".png", "image/png"
    elif content.startswith(b"\xff\xd8\xff"):
        suffix, detected_type = ".jpg", "image/jpeg"
    else:
        raise HTTPException(415, "File contents are not a PNG or JPEG image.")
    if image.content_type != detected_type:
        raise HTTPException(415, "Image contents do not match the declared content type.")
    return content, suffix


def pending_capture_brief(content, mime, profile, day, pixels_per_cm, observations):
    """Retain a decoded capture without substituting an invented model result."""
    message = "Image saved. The model is unavailable or incompatible; no visual analysis has been completed. Retry this saved capture after the model is configured."
    visit = {"day": day, "image_sha256": hashlib.sha256(content).hexdigest(),
             "analysis_status": "pending_model", "analysis_message": message,
             "measurement_source": "pending_model", "measurement_status": "unavailable",
             "tissue_percentages": None, "risk_deterioration_score": None,
             "area_cm2": None, "wound_area_pixels": None, "unclassified_percentage": None,
             "pixels_per_cm": pixels_per_cm, "clinical_observations": observations,
             "quality": {"assessment_status": "not_assessed", "issues": ["Model analysis unavailable; the image file decoded successfully."]}}
    brief = format_clinical_brief([visit], profile, {"input_source": "stored_capture_awaiting_model",
                                                  "model_inference_completed": False})
    brief["pipeline_visuals"] = {"schema_version": "pwc-pipeline-visuals-v1", "day": day,
        "original_image": base64.b64encode(content).decode("ascii"), "original_mime_type": mime,
        "unet_segmentation_mask": None, "tissue_analysis_overlay": None, "derived_mime_type": "image/png",
        "status": "unavailable", "reason": message, "clinical_validation": False,
        "relationship": "capture_saved_without_model_inference"}
    return brief


def create_app(checkpoint_path: Path | None = None, visual_checkpoint_path: Path | None = None,
               session_db_path: Path | None = None) -> FastAPI:
    api = FastAPI(
        title="MediPass Wound Research API", version="1.1.0",
        description="Local adapter for the synthetic-trained wound tracker. Research use only.",
    )
    configured = Path(checkpoint_path or os.getenv("MEDIPASS_MODEL_PATH", str(DEFAULT_CHECKPOINT)))
    api.state.checkpoint_path = (ROOT / configured).resolve() if not configured.is_absolute() else configured.resolve()
    visual_path = Path(visual_checkpoint_path or os.getenv("MEDIPASS_VISUAL_MODEL_PATH", str(DEFAULT_VISUAL_CHECKPOINT)))
    api.state.visual_checkpoint_path = (ROOT / visual_path).resolve() if not visual_path.is_absolute() else visual_path.resolve()
    database = Path(session_db_path or os.getenv("MEDIPASS_WOUND_SESSION_DB", str(ROOT / "outputs" / "wound-sessions.sqlite3")))
    api.state.sessions = WoundSessionStore(database if database.is_absolute() else ROOT / database)
    origins = [origin.strip() for origin in os.getenv("MEDIPASS_CORS_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",") if origin.strip()]
    api.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type"],
    )

    @api.post("/api/analyze-wound", summary="Analyze one wound image and patient baseline",
              responses={413: {"description": "Image exceeds 8 MiB"},
                         415: {"description": "Unsupported image format"},
                         422: {"description": "Invalid baseline or image"},
                         503: {"description": "Trained model unavailable"}})
    async def analyze_wound(
        image: Annotated[UploadFile, File(description="PNG or JPEG, at most 8 MiB")],
        patient_data: Annotated[str, Form(max_length=16384, description="Patient baseline as a JSON string")],
        day: Annotated[float, Form(ge=0, allow_inf_nan=False, description="Relative observation day; 0 means this capture is the baseline")] = 0.0,
        include_pipeline_visuals: Annotated[bool, Form(description="Developer view: include optional Base64 input/U-Net/overlay images")] = False,
        pixels_per_cm: Annotated[float | None, Form(gt=0, le=100000, allow_inf_nan=False)] = None,
        clinical_observations: Annotated[str | None, Form(max_length=4096)] = None,
    ) -> JSONResponse:
        try:
            profile = parse_patient_data(patient_data)
            observations = parse_observations(clinical_observations)
            content, suffix = await read_upload(image)
            brief = await run_in_threadpool(
                analyze_upload, content, suffix, profile, day, api.state.checkpoint_path,
                include_pipeline_visuals, api.state.visual_checkpoint_path, pixels_per_cm, observations,
            )
            return JSONResponse(content=brief, headers={"Cache-Control": "no-store"})
        finally:
            await image.close()

    @api.post("/api/analyze-trajectory", summary="Review ordered caller-supplied metrics with a fixed baseline")
    async def analyze_metrics(payload: TrajectoryRequest):
        try:
            profile = parse_patient_data(json.dumps(payload.patient_data, allow_nan=False))
            # A caller cannot promote reported numbers to verified model outputs.
            visits = [{**v, "measurement_source": "caller_reported_metrics"} for v in payload.visits]
            brief = await run_in_threadpool(format_clinical_brief, visits, profile,
                {"input_source": "caller_reported_metrics", "independently_verified": False})
        except (ValueError, TypeError, KeyError, RecursionError) as exc:
            raise HTTPException(422, "Invalid trajectory: use increasing days, valid percentages summing to 100 including unclassified, and finite nonnegative areas.") from exc
        return JSONResponse(brief, headers={"Cache-Control": "no-store"})

    @api.post("/api/wound-sessions", status_code=201)
    async def create_session(patient_data: Annotated[str, Form(max_length=16384)]):
        profile = parse_patient_data(patient_data)
        if not isinstance(profile.get("patient_id"), str) or not profile["patient_id"].strip() or len(profile["patient_id"]) > 128:
            raise HTTPException(422, "A nonempty patient_id of at most 128 characters is required.")
        result = await run_in_threadpool(api.state.sessions.create, profile)
        return JSONResponse(result, status_code=201, headers={"Cache-Control": "no-store"})

    @api.get("/api/wound-sessions/{session_id}")
    async def get_session(session_id: str, patient_id: Annotated[str | None, Query(min_length=1, max_length=128)] = None):
        result = await run_in_threadpool(api.state.sessions.get, session_id, patient_id)
        return JSONResponse(result, headers={"Cache-Control": "no-store"})

    @api.get("/api/wound-sessions")
    async def list_sessions(patient_id: Annotated[str, Query(min_length=1, max_length=128)]):
        result = await run_in_threadpool(api.state.sessions.list, patient_id)
        return JSONResponse(result, headers={"Cache-Control": "no-store"})

    @api.delete("/api/wound-sessions/{session_id}")
    async def delete_session(session_id: str, patient_id: Annotated[str, Query(min_length=1, max_length=128)]):
        result = await run_in_threadpool(api.state.sessions.delete, session_id, patient_id)
        return JSONResponse(result, headers={"Cache-Control": "no-store"})

    @api.get("/api/wound-sessions/{session_id}/visits/{visit_id}")
    async def get_visit(session_id: str, visit_id: str, patient_id: Annotated[str, Query(min_length=1, max_length=128)]):
        result = await run_in_threadpool(api.state.sessions.visit, session_id, visit_id, patient_id)
        return JSONResponse(result, headers={"Cache-Control": "no-store"})

    @api.delete("/api/wound-sessions/{session_id}/visits/{visit_id}")
    async def delete_visit(session_id: str, visit_id: str, patient_id: Annotated[str, Query(min_length=1, max_length=128)]):
        result = await run_in_threadpool(api.state.sessions.delete_visit, session_id, visit_id, patient_id)
        return JSONResponse(result, headers={"Cache-Control": "no-store"})

    @api.post("/api/wound-sessions/{session_id}/visits/{visit_id}/analyze")
    async def retry_visit(session_id: str, visit_id: str, patient_id: Annotated[str, Query(min_length=1, max_length=128)]):
        saved = await run_in_threadpool(api.state.sessions.pending_input, session_id, visit_id, patient_id)
        measurement = saved["measurement"]
        brief = await run_in_threadpool(analyze_upload, saved["image"], ".png" if saved["mime"] == "image/png" else ".jpg",
            saved["profile"], measurement["day"], api.state.checkpoint_path, True, api.state.visual_checkpoint_path,
            measurement.get("pixels_per_cm"), measurement.get("clinical_observations"))
        result = await run_in_threadpool(api.state.sessions.complete_pending, session_id, visit_id, patient_id,
                                        brief, saved["measurement_version"])
        return JSONResponse(result, headers={"Cache-Control": "no-store"})

    @api.post("/api/wound-sessions/{session_id}/visits", status_code=201)
    async def add_visit(
        session_id: str,
        image: Annotated[UploadFile, File()],
        patient_id: Annotated[str, Form(max_length=128)],
        day: Annotated[float, Form(ge=0, allow_inf_nan=False)],
        timestamp: Annotated[str | None, Form(max_length=64)] = None,
        pixels_per_cm: Annotated[float | None, Form(gt=0, le=100000, allow_inf_nan=False)] = None,
        capture_conditions_consistent: Annotated[bool, Form(description="Caller confirms comparable lighting, framing, distance and camera scale")] = False,
        include_pipeline_visuals: Annotated[bool, Form()] = False,
        preserve_on_model_unavailable: Annotated[bool, Form(description="Retain a pending capture if model inference returns 503; no estimates are fabricated")] = False,
        clinical_observations: Annotated[str | None, Form(max_length=4096)] = None,
    ):
        try:
            captured_at = timestamp_utc(timestamp)
            observations = parse_observations(clinical_observations)
            session = await run_in_threadpool(api.state.sessions.get, session_id)
            if session["patient_id"] != patient_id:
                raise HTTPException(409, "Patient does not match the locked session baseline.")
            content, suffix = await read_upload(image)
            # Retain the acquisition-time pipeline for future Developer Mode,
            # even when a capture was first uploaded in Patient Mode.
            try:
                brief = await run_in_threadpool(analyze_upload, content, suffix, session["patient_profile"], day,
                    api.state.checkpoint_path, True, api.state.visual_checkpoint_path, pixels_per_cm, observations)
            except HTTPException as exc:
                if not preserve_on_model_unavailable or exc.status_code != 503:
                    raise
                brief = await run_in_threadpool(pending_capture_brief, content, image.content_type,
                                               session["patient_profile"], day, pixels_per_cm, observations)
            measurement = brief["objective_measurements"]["visits"][0]
            measurement["capture_conditions_consistent"] = capture_conditions_consistent
            measurement["pixels_per_cm"] = pixels_per_cm
            measurement.setdefault("analysis_status", "completed")
            result = await run_in_threadpool(api.state.sessions.append, session_id, patient_id, content,
                image.content_type, brief, captured_at, "caller_capture" if timestamp else "server_received")
            if not include_pipeline_visuals and result["brief"]:
                result["brief"].pop("pipeline_visuals", None)
            return JSONResponse(result, status_code=201, headers={"Cache-Control": "no-store"})
        finally:
            await image.close()

    @api.get("/api/wound-sessions/{session_id}/visits/{visit_id}/image")
    async def visit_image(session_id: str, visit_id: str, patient_id: Annotated[str | None, Query(min_length=1, max_length=128)] = None):
        content, mime = await run_in_threadpool(api.state.sessions.image, session_id, visit_id, patient_id)
        return Response(content, media_type=mime, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

    return api


app = create_app()


if __name__ == "__main__":
    import torch
    import uvicorn

    torch.set_num_threads(2)
    uvicorn.run(app, host="127.0.0.1", port=8000)
