from contextlib import asynccontextmanager
from io import BytesIO
from threading import Lock
from fastapi.middleware.cors import CORSMiddleware
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from qwen_tts import Qwen3TTSModel

model = None
generation_lock = Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    torch.set_num_threads(4)
    model = Qwen3TTSModel.from_pretrained(
        "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
        device_map="cpu",
        dtype=torch.float32,
    )
    print("Qwen3-TTS загружена и готова", flush=True)
    yield
    model = None


app = FastAPI(title="Qwen3-TTS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8765"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)


@app.get("/health")
def health():
    return {"ready": model is not None}


@app.post("/tts")
def tts(request: TTSRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Модель ещё загружается")

    try:
        with generation_lock:
            audio, sample_rate = model.generate_custom_voice(
                text=request.text,
                language="Russian",
                speaker="Serena",
                instruct=(
                    "Говори спокойно, доброжелательно и естественно. "
                    "Мягкий женский тембр, без чрезмерной нежности. "
                    "Чётко произноси слова и сохраняй естественные ударения."
                ),
            )

        wav = BytesIO()
        sf.write(wav, audio[0], sample_rate, format="WAV")
        wav.seek(0)
        return StreamingResponse(
            wav,
            media_type="audio/wav",
            headers={"Content-Disposition": 'attachment; filename="speech.wav"'},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
