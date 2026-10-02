import csv
import json
import re
import subprocess
import time
import wave
from datetime import datetime
from pathlib import Path

ROOT = Path("/home/sorry/practice-2026")
OUT = ROOT / "results" / ("serena_candidate_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
TEXT = "Здравствуйте, Мария! Это компания Трайтэк. Баланс вашего лицевого счёта составляет восемьсот двадцать рублей. Спасибо!"
PROMPT = "An adult woman with a calm, warm, friendly voice. Clear natural Russian pronunciation. Moderate pace, no whispering, no exaggerated acting."


def main():
    OUT.mkdir(parents=True)
    render_group = subprocess.check_output(["stat", "-c", "%g", "/dev/dri/renderD128"], text=True).strip()
    video_group = subprocess.check_output(["stat", "-c", "%g", "/dev/dri/card1"], text=True).strip()
    conditions = dict(text=TEXT, prompt=PROMPT, seed=42,
                      model="qwen-talker-0.6b-customvoice-Q8_0.gguf", speaker="serena",
                      codec="qwen-tokenizer-12hz-Q8_0.gguf",
                      cpu_limit=4, memory_limit="6g", max_new=600,
                      runtime_commit=subprocess.check_output(["git", "-C", str(ROOT / "qwentts.cpp"), "rev-parse", "HEAD"], text=True).strip(),
                      timing_scope="Wall: container startup, model loading, generation, WAV; synthesis: runtime Perf Total")
    (OUT / "conditions.json").write_text(json.dumps(conditions, ensure_ascii=False, indent=2), encoding="utf-8")
    records = []
    # Interleave configurations to reduce bias from run order and temperature.
    for repeat in range(1, 4):
        for name, backend, no_fa in [("CPU", "CPU", True), ("GPU_FA", "Vulkan0", False)]:
            tag = f"{name}_{repeat}"
            wav_path = OUT / (tag + ".wav")
            log_path = OUT / (tag + ".log")
            container = "practice-gpu-bench-" + str(time.time_ns())
            args = ["docker", "run", "--rm", "--name", container, "-i", "--user", "1000:1000",
                    "--device=/dev/dri", "--group-add", render_group, "--group-add", video_group, "--cpus=4", "--memory=6g",
                    "-e", "GGML_BACKEND=" + backend,
                    "-e", "GGML_VK_VISIBLE_DEVICES=0", "-e", "GGML_VK_ALLOW_GRAPHICS_QUEUE=1",
                    "-e", "XDG_RUNTIME_DIR=/tmp", "-v", str(ROOT) + ":/work", "-w", "/work/qwentts.cpp",
                    "practice-qwen:vulkan", "./build-vulkan/qwen-tts",
                    "--model", "/work/models/" + conditions["model"],
                    "--codec", "/work/models/" + conditions["codec"],
                    "--lang", "Russian", "--speaker", "serena", "--instruct", PROMPT, "--seed", "42", "--max-new", "600",
                    "-o", "/work/" + str(wav_path.relative_to(ROOT))]
            if no_fa:
                args.append("--no-fa")
            print(f"{tag}: starting", flush=True)
            start = time.perf_counter()
            with log_path.open("wb") as log:
                try:
                    result = subprocess.run(args, input=TEXT.encode("utf-8"), stdout=log, stderr=log, timeout=240)
                except subprocess.TimeoutExpired:
                    subprocess.run(["docker", "stop", "-t", "5", container], stdout=log, stderr=log, timeout=20)
                    raise RuntimeError("Synthesis timeout; see " + str(log_path))
            wall = time.perf_counter() - start
            log = log_path.read_text(errors="replace")
            if result.returncode or not wav_path.exists():
                raise RuntimeError("Run failed; see " + str(log_path) + "\n" + log[-2000:])
            if "Talker backend: " + backend not in log or "EOS at step" not in log:
                raise RuntimeError("Requested backend not confirmed or output truncated; see " + str(log_path))
            if backend == "Vulkan0" and ("AMD Radeon RX 580" not in log or "Device type is CPU" in log):
                raise RuntimeError("Actual Radeon GPU not confirmed")
            perf = re.search(r"\[Perf\] Total ([0-9.]+) ms", log)
            if not perf:
                raise RuntimeError("Missing synthesis timing")
            with wave.open(str(wav_path)) as wav:
                duration = wav.getnframes() / wav.getframerate()
                if duration <= 0 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                    raise RuntimeError("Invalid WAV")
            synth = float(perf.group(1)) / 1000
            row = dict(configuration=name, run=repeat, synthesis_seconds=synth,
                       wall_seconds=wall, audio_seconds=duration, rtf=synth/duration,
                       wall_rtf=wall/duration, exit_code=result.returncode)
            records.append(row)
            with (OUT / "results.csv").open("w", newline="", encoding="utf-8-sig") as stream:
                writer = csv.DictWriter(stream, fieldnames=list(row), delimiter=";")
                writer.writeheader()
                writer.writerows(records)
            print(json.dumps(row), flush=True)
    print("RESULTS: " + str(OUT), flush=True)


if __name__ == "__main__":
    main()
