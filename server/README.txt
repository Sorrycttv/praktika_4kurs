Серверные файлы актуализированы 2 октября 2026 года

tts_api.py — основной GPU API (копия с действующего сервера).
tts_api_gpu.py — подготовленная GPU-версия того же адаптера.
tts_api_cpu.py — прежний CPU API для резервного развёртывания.
qwen3-tts.service — существующий unit Uvicorn.
threads.conf — старый CPU drop-in OMP/MKL=4; он не выбирает GPU.
activate_gpu.sh — переключение существующего сервера с резервной копией и проверкой /health. Не является универсальным установщиком.
requirements.freeze.txt — зависимости существующего Python-окружения, включая CPU-библиотеки. Для GPU API нужны FastAPI, Uvicorn и Pydantic; вычисления идут в Docker.

Исходный сервер
/home/sorry/qwen3-tts/tts_api.py
/home/sorry/qwen3-tts/.venv/bin/python
/home/sorry/practice-2026/qwentts.cpp/build-vulkan/qwen-tts
/home/sorry/practice-2026/models/qwen-talker-0.6b-customvoice-Q8_0.gguf
/home/sorry/practice-2026/models/qwen-tokenizer-12hz-Q8_0.gguf
Образ Docker: practice-qwen:vulkan
Runtime commit: 4eb8c7d7609dbd47ad461ba90611234e0c9858bc
Образ на исходном сервере: sha256:41c90253759b606a55e4b12a83bb782063edff9cb42c52e6f3ed4e57e0943252
Источник runtime: https://github.com/ServeurpersoCom/qwentts.cpp
Источник GGUF: https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF

При переносе изменить пути и пользователя, подготовить Vulkan runtime в Docker и два GGUF-файла. Пользователь службы должен иметь доступ к Docker и запись в results/api_gpu.
Контейнеру передаются /dev/dri и группы обоих GPU-устройств; privileged не используется.
API выполняет пробный синтез при старте. Ожидается /health с ready=true, backend=Vulkan0, device=RX 580, speaker=Serena.
Основной API слушает только 127.0.0.1:8020; сайт подключается через SSH.

Диагностика
systemctl is-active qwen3-tts
systemctl is-enabled qwen3-tts
curl --max-time 5 http://127.0.0.1:8020/health
journalctl -u qwen3-tts -n 50 --no-pager

После изменения Python-файла: sudo systemctl restart qwen3-tts.
После изменения unit: sudo systemctl daemon-reload, затем restart.
Для отката сохранить GPU-файл и заменить tts_api.py выбранной CPU-резервной копией; затем restart и проверка POST /tts.
Автоматического CPU-fallback при ошибке запроса нет.
Другие службы ВКР не являются частью этого приложения.
