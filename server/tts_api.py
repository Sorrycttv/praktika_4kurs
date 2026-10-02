from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from threading import Lock
import logging, os, subprocess, time, uuid, wave
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

ROOT = Path('/home/sorry/practice-2026')
OUTPUT = ROOT / 'results' / 'api_gpu'
PROMPT = 'Говори спокойно, доброжелательно и естественно. Мягкий женский тембр, без чрезмерной нежности. Чётко произноси слова и сохраняй естественные ударения.'
ready = False
generation_lock = Lock()
logger = logging.getLogger('uvicorn.error')

def synthesize(text):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    token = uuid.uuid4().hex
    container = 'practice-tts-api-' + token
    wav_path = OUTPUT / (token + '.wav')
    render_gid = str(os.stat('/dev/dri/renderD128').st_gid)
    card_gid = str(os.stat('/dev/dri/card1').st_gid)
    args = ['docker', 'run', '--rm', '--name', container, '-i', '--user', f'{os.getuid()}:{os.getgid()}',
        '--device=/dev/dri', '--group-add', render_gid, '--group-add', card_gid, '--cpus=4', '--memory=6g',
        '-e', 'GGML_BACKEND=Vulkan0', '-e', 'GGML_VK_VISIBLE_DEVICES=0',
        '-e', 'GGML_VK_ALLOW_GRAPHICS_QUEUE=1', '-e', 'XDG_RUNTIME_DIR=/tmp',
        '-v', str(ROOT) + ':/work', '-w', '/work/qwentts.cpp', 'practice-qwen:vulkan', './build-vulkan/qwen-tts',
        '--model', '/work/models/qwen-talker-0.6b-customvoice-Q8_0.gguf',
        '--codec', '/work/models/qwen-tokenizer-12hz-Q8_0.gguf', '--lang', 'Russian',
        '--speaker', 'serena', '--instruct', PROMPT, '--seed', '42', '--max-new', '2000',
        '-o', '/work/results/api_gpu/' + wav_path.name]
    start = time.perf_counter()
    try:
        proc = subprocess.run(args, input=text.encode('utf-8'), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=300)
        log = proc.stdout.decode('utf-8', errors='replace')
        if proc.returncode or 'Talker backend: Vulkan0' not in log or 'AMD Radeon RX 580' not in log or 'EOS at step' not in log:
            logger.error('GPU synthesis failed: %s', log[-4000:])
            raise RuntimeError('GPU generation failed or output incomplete; see service log')
        payload = wav_path.read_bytes()
        with wave.open(BytesIO(payload)) as audio:
            duration = audio.getnframes() / audio.getframerate()
            if duration <= 0 or audio.getnchannels() != 1:
                raise RuntimeError('Invalid GPU audio output')
        elapsed = time.perf_counter() - start
        logger.info('RX 580 Vulkan0 Serena: %.3f s total, %.3f s audio', elapsed, duration)
        return payload, elapsed
    finally:
        subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20)
        wav_path.unlink(missing_ok=True)

@asynccontextmanager
async def lifespan(app):
    global ready
    synthesize('Здравствуйте!')
    ready = True
    logger.info('Qwen3-TTS GPU ready: RX 580 / Vulkan / Serena')
    yield
    ready = False

app = FastAPI(title='Qwen3-TTS GPU API', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:8765'], allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
@app.get('/health')
def health():
    return {'ready': ready, 'backend': 'Vulkan0', 'device': 'RX 580', 'speaker': 'Serena'}
@app.post('/tts')
def tts(request: TTSRequest):
    if not ready:
        raise HTTPException(status_code=503, detail='GPU is not ready')
    if not request.text.strip():
        raise HTTPException(status_code=422, detail='Text must not be blank')
    try:
        with generation_lock:
            payload, elapsed = synthesize(request.text)
        return StreamingResponse(BytesIO(payload), media_type='audio/wav', headers={'Content-Disposition': 'attachment; filename="speech.wav"', 'X-Generation-Seconds': f'{elapsed:.3f}'})
    except Exception as exc:
        logger.exception('TTS request failed')
        raise HTTPException(status_code=500, detail='GPU synthesis failed; check service log') from exc
