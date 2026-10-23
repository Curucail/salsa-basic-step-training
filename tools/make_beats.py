"""Regenerate beats.js from the annotation csv.

    python tools/make_beats.py                      # data/tu-con-el.csv -> beats.js
    python tools/make_beats.py path/to/other.csv    # another annotation (time,position columns)

The csv comes from the beat annotator: `time` in seconds, `position` the count 1-8 (1 = downbeat).
"""
import csv
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "data" / "tu-con-el.csv"

with open(source, encoding="utf-8", newline="") as f:
    beats = [[round(float(r["time"]), 3), int(r["position"])] for r in csv.DictReader(f) if r["position"].strip()]
beats.sort()

(root / "beats.js").write_text(
    f'// [time in seconds, count 1-8] for every beat of "Tu Con Él" (generated from {source.name})\n'
    f"window.BEATS = {json.dumps(beats, separators=(',', ':'))};\n",
    encoding="utf-8",
)
print(f"{len(beats)} beats from {source} -> beats.js")
