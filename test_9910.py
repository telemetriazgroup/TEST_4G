#!/usr/bin/env python3
"""
Punto de entrada legacy (test_9910.py).

Delega al bridge completo en tcp_bridge/bridge.py, que cumple:
  - bind 0.0.0.0:9910 + SO_REUSEADDR + listen(10)
  - hilo por accept() → handle_client
  - register_pending / limpieza de IPs huérfanas
  - recv(4096) → buffer → líneas → parse_chunks → backend
  - envío string/hex vía HTTP :8081

Uso local (sin Docker):
  pip install -r tcp_bridge/requirements.txt -r backend/requirements.txt
  # terminal 1: mongodb
  # terminal 2: uvicorn backend.main:app --port 9070
  # terminal 3: BACKEND_URL=http://127.0.0.1:9070 python test_9910.py
"""

import os
import sys

# Asegura import del paquete local
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "tcp_bridge"))

# Compat: APIs legacy activables con FORWARD_LEGACY=1
os.environ.setdefault("TCP_PORT", "9910")
os.environ.setdefault("HTTP_PORT", "8081")
os.environ.setdefault("BACKEND_URL", os.getenv("BACKEND_URL", "http://127.0.0.1:9070"))

from bridge import main  # noqa: E402

if __name__ == "__main__":
    main()
