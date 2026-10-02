#!/bin/bash
set -euo pipefail
cd /home/sorry/qwen3-tts
backup="tts_api_cpu_before_gpu_$(date +%Y%m%d_%H%M%S).py"
cp tts_api.py "$backup"
cp tts_api_gpu.py tts_api.py
if ! sudo systemctl restart qwen3-tts; then
    cp "$backup" tts_api.py
    echo 'Restart failed; CPU source restored.'
    exit 1
fi
for attempt in $(seq 1 30); do
    if curl --fail --silent --max-time 2 http://127.0.0.1:8020/health | grep -q '"ready":true'; then
        echo
        echo "GPU API active. CPU backup: /home/sorry/qwen3-tts/$backup"
        exit 0
    fi
    sleep 2
done
cp "$backup" tts_api.py
sudo systemctl restart qwen3-tts
echo 'GPU startup failed; restored CPU. Check journalctl -u qwen3-tts.'
exit 1
