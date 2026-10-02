import csv
import io
import json
import time
import urllib.request
import wave
from datetime import datetime
from pathlib import Path

text = (
    "Здравствуйте, Мария! Это компания Трайтэк. "
    "Баланс вашего лицевого счёта составляет "
    "восемьсот двадцать рублей. Спасибо!"
)

folder = Path.home() / "qwen3-tts" / "benchmarks"
folder = folder / ("gpu_service_retest_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
folder.mkdir(parents=True)
  
(folder / "conditions.json").write_text(
    json.dumps({
        "text": text,
        "model": "qwen-talker-0.6b-customvoice-Q8_0.gguf",
        "speaker": "Serena",
        "device": "RX580 Vulkan0 Q8_0",
        "threads": 4,
        "measurement": "Полное время ответа API на самом сервере",
    }, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

rows = []
for run in range(4):
    print("Прогрев..." if run == 0 else f"Замер {run}/3...", flush=True)
    request = urllib.request.Request(
        "http://127.0.0.1:8020/tts",
        data=json.dumps({"text": text}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = time.perf_counter()
    with urllib.request.urlopen(request, timeout=300) as response:
        audio = response.read()
    elapsed = time.perf_counter() - start

    with wave.open(io.BytesIO(audio), "rb") as wav:
        duration = wav.getnframes() / wav.getframerate()

    if duration <= 0:
        raise RuntimeError("Получено пустое аудио")

    (folder / f"run_{run}.wav").write_bytes(audio)

    if run:
        rows.append([run, elapsed, duration, elapsed / duration])
        print(
            f"Ответ API: {elapsed:.2f} с; "
            f"аудио: {duration:.2f} с; RTF: {elapsed / duration:.2f}",
            flush=True,
        )

with (folder / "results.csv").open("w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f, delimiter=";")
    writer.writerow(["run", "api_seconds", "audio_seconds", "rtf"])
    writer.writerows(rows)

print(f"\nСреднее время API: {sum(r[1] for r in rows) / len(rows):.2f} с")
print("Результаты сохранены:", folder)

