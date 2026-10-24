"""Convert the video project's demo.json (+ question audio) into assets/demo/ for the website.

Usage: python tools/make_web_demo.py path/to/demo.json path/to/question.wav
Requires: numpy, soundfile; ffmpeg on PATH for the MP3.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf

root = Path(__file__).resolve().parent.parent
d = json.loads(Path(sys.argv[1]).read_text())
wav = sys.argv[2]
a, sr = sf.read(wav)
if a.ndim > 1:
    a = a.mean(1)
env = np.array([np.sqrt((c ** 2).mean()) for c in np.array_split(a, 160)])
env = (env / (env.max() + 1e-9)) ** .7
web = {"question": d["question_text"], "answer": d["answer_text"], "duration": round(len(a) / sr, 3),
       "tokens": [[t["token"], round(t["xy"][0], 3), round(t["xy"][1], 3)] for t in d["tokens"]],
       "positions": [[p["time"], [[c["index"], round(c["weight"], 4)] for c in p["candidates"]]] for p in d["positions"]],
       "landmarks": d["landmarks"], "focus": d["focus_position"], "envelope": [round(float(x), 3) for x in env]}
(root / "assets/demo/cgate-demo.json").write_text(json.dumps(web, ensure_ascii=False, separators=(",", ":")))
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "96k",
                str(root / "assets/demo/question.mp3")], check=True)
print("updated assets/demo/; now run: cd tools && node build.mjs")
