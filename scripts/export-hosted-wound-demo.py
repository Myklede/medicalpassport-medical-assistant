#!/usr/bin/env python3
"""Export the synthetic Wound Lab fixture for the hosted, no-Python demo.

This runs the repository's verified checkpoints locally once. The hosted Worker
then serves the saved result only when the uploaded bytes match the bundled
synthetic image exactly; arbitrary uploads are never assigned fabricated output.
"""

import base64
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from aimedic.main import analyze_upload  # noqa: E402


SAMPLE = ROOT / "public" / "wound-demo" / "day_007_rgb.png"
DEMO_DIR = SAMPLE.parent
BRIEF_PATH = ROOT / "lib" / "hosted-wound-demo.json"

PROFILE = {
    "patient_id": "SYN000014",
    "age": 20,
    "blood_type": "A-",
    "hba1c_level": 9.6,
    "has_diabetes_type_2": True,
    "hypertension": False,
    "fpg_mg_dl": 218,
    "peripheral_vascular_status": "impaired",
    "neuropathy_status": "present",
}


def main() -> None:
    content = SAMPLE.read_bytes()
    brief = analyze_upload(
        content,
        ".png",
        PROFILE,
        0.0,
        ROOT / "outputs" / "pwc-run" / "best.pt",
        True,
        ROOT / "outputs" / "wound_unet_fusd.pt",
    )
    visuals = brief["pipeline_visuals"]
    derived = {
        "unet_segmentation_mask": "day_007_mask.png",
        "tissue_analysis_overlay": "day_007_overlay.png",
    }
    for field, filename in derived.items():
        (DEMO_DIR / filename).write_bytes(base64.b64decode(visuals[field]))
        visuals[field] = f"/wound-demo/{filename}"
    visuals["original_image"] = "/wound-demo/day_007_rgb.png"
    BRIEF_PATH.write_text(
        json.dumps(brief, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    print(f"Exported hosted fixture to {BRIEF_PATH}")


if __name__ == "__main__":
    main()
