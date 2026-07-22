"""
tcp_bridge — servidor TCP puerto 9910.

Flujo:
  accept() → register_pending(addr, conn) → recv(4096) → buffer → líneas
  → parse_chunks() → backend

Limpia IPs huérfanas (desconexiones / cambio de IP) sin interrumpir
sesiones activas. Expone HTTP interno para listar dispositivos y enviar
comandos (string o hex) al socket correcto.
"""

from __future__ import annotations

import binascii
import datetime as dt
import json
import logging
import os
import re
import socket
import threading
import time
from typing import Any

import requests
from flask import Flask, jsonify, request

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

HOST = os.getenv("TCP_HOST", "0.0.0.0")
TCP_PORT = int(os.getenv("TCP_PORT", "9910"))
HTTP_PORT = int(os.getenv("HTTP_PORT", "8081"))
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:9070").rstrip("/")

# APIs legacy (compatibilidad con test_9910.py)
API_URL = os.getenv("API_URL", "http://161.132.53.51:9050/TermoKing/")
API_URL2 = os.getenv("API_URL2", "http://161.132.206.104:9050/Datos/")
FORWARD_LEGACY = os.getenv("FORWARD_LEGACY", "0") == "1"

RECV_SIZE = 4096
IDLE_TIMEOUT_S = float(os.getenv("IDLE_TIMEOUT_S", "300"))  # 5 min sin datos
ORPHAN_SWEEP_S = float(os.getenv("ORPHAN_SWEEP_S", "30"))

# Trama sensor completa sin salto de línea (ajustable)
SENSOR_FRAME_RE = re.compile(
    r"(?:\{[^{}]+\}|[0-9A-Fa-f]{8,}|(?:\+?[A-Za-z0-9_,.=:\-]{6,}))"
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("tcp_bridge")

# ---------------------------------------------------------------------------
# Registro de conexiones
# ---------------------------------------------------------------------------

_lock = threading.RLock()
# addr_key "ip:port" → meta
_conn_by_addr: dict[str, dict[str, Any]] = {}
# ip → set de addr_key (varios sockets por misma IP posible)
_addrs_by_ip: dict[str, set[str]] = {}


def _addr_key(addr: tuple) -> str:
    return f"{addr[0]}:{addr[1]}"


def register_pending(addr: tuple, conn: socket.socket) -> str:
    """Registra socket pendiente (aún sin IMEI / id de equipo)."""
    key = _addr_key(addr)
    ip = addr[0]
    now = time.time()
    with _lock:
        # Si ya hay entrada previa para la misma key, cerrar la vieja
        old = _conn_by_addr.pop(key, None)
        if old and old.get("conn") is not conn:
            _safe_close(old["conn"])

        _conn_by_addr[key] = {
            "conn": conn,
            "addr": addr,
            "ip": ip,
            "port": addr[1],
            "connected_at": now,
            "last_rx": now,
            "imei": None,
            "alive": True,
        }
        _addrs_by_ip.setdefault(ip, set()).add(key)
    return key


def unregister(key: str, *, notify: bool = True) -> None:
    """Quita del registro y cierra el socket. No toca otras sesiones."""
    with _lock:
        meta = _conn_by_addr.pop(key, None)
        if not meta:
            return
        ip = meta["ip"]
        addrs = _addrs_by_ip.get(ip)
        if addrs:
            addrs.discard(key)
            if not addrs:
                _addrs_by_ip.pop(ip, None)
        _safe_close(meta.get("conn"))

    if notify:
        _backend_post(
            "/api/internal/disconnect",
            {"addr": key, "ip": meta["ip"], "imei": meta.get("imei")},
        )


def touch_rx(key: str) -> None:
    with _lock:
        if key in _conn_by_addr:
            _conn_by_addr[key]["last_rx"] = time.time()


def set_imei(key: str, imei: str) -> None:
    with _lock:
        if key in _conn_by_addr:
            _conn_by_addr[key]["imei"] = imei


def list_connections() -> list[dict[str, Any]]:
    now = time.time()
    with _lock:
        out = []
        for key, m in _conn_by_addr.items():
            out.append(
                {
                    "addr": key,
                    "ip": m["ip"],
                    "port": m["port"],
                    "imei": m.get("imei"),
                    "connected_at": m["connected_at"],
                    "last_rx": m["last_rx"],
                    "idle_s": round(now - m["last_rx"], 1),
                    "alive": m.get("alive", True),
                }
            )
        return out


def get_conn_by_addr(addr: str) -> socket.socket | None:
    with _lock:
        m = _conn_by_addr.get(addr)
        return m["conn"] if m else None


def get_conn_by_ip(ip: str) -> tuple[str, socket.socket] | None:
    """Devuelve la sesión más reciente (por last_rx) de esa IP."""
    with _lock:
        keys = list(_addrs_by_ip.get(ip, ()))
        if not keys:
            return None
        best = max(keys, key=lambda k: _conn_by_addr[k]["last_rx"])
        return best, _conn_by_addr[best]["conn"]


def _safe_close(conn: socket.socket | None) -> None:
    if not conn:
        return
    try:
        conn.shutdown(socket.SHUT_RDWR)
    except OSError:
        pass
    try:
        conn.close()
    except OSError:
        pass


def _socket_alive(conn: socket.socket) -> bool:
    """Comprueba si el peer sigue vivo sin consumir datos (MSG_PEEK)."""
    try:
        conn.setblocking(False)
        data = conn.recv(1, socket.MSG_PEEK)
        conn.setblocking(True)
        # b'' → peer cerró
        return data != b""
    except BlockingIOError:
        # No hay datos pendientes → socket OK
        try:
            conn.setblocking(True)
        except OSError:
            pass
        return True
    except OSError:
        try:
            conn.setblocking(True)
        except OSError:
            pass
        return False


def sweep_orphans() -> int:
    """
    Elimina entradas huérfanas: socket muerto o idle demasiado largo.
    No interrumpe conexiones vivas.
    """
    now = time.time()
    to_drop: list[str] = []
    with _lock:
        for key, m in list(_conn_by_addr.items()):
            conn = m.get("conn")
            idle = now - m.get("last_rx", now)
            dead = False
            if conn is None:
                dead = True
            elif idle > IDLE_TIMEOUT_S:
                dead = True
                log.info("Orphan idle %s (%.0fs)", key, idle)
            elif not _socket_alive(conn):
                dead = True
                log.info("Orphan dead socket %s", key)
            if dead:
                to_drop.append(key)

    for key in to_drop:
        unregister(key, notify=True)
    return len(to_drop)


def orphan_loop() -> None:
    while True:
        try:
            n = sweep_orphans()
            if n:
                log.info("Sweep: %d huérfana(s) limpiada(s). Activas=%d", n, len(_conn_by_addr))
        except Exception as e:
            log.exception("orphan_loop: %s", e)
        time.sleep(ORPHAN_SWEEP_S)


# ---------------------------------------------------------------------------
# Backend HTTP helpers
# ---------------------------------------------------------------------------

def _backend_post(path: str, payload: dict, timeout: float = 5.0) -> Any:
    url = f"{BACKEND_URL}{path}"
    try:
        r = requests.post(url, json=payload, timeout=timeout)
        return r.json() if r.content else None
    except Exception as e:
        log.warning("Backend POST %s falló: %s", path, e)
        return None


def notify_disconnect_all() -> None:
    _backend_post("/api/internal/disconnect_all", {})


def notify_connect(addr: str, ip: str) -> None:
    _backend_post("/api/internal/connect", {"addr": addr, "ip": ip})


def notify_data(addr: str, ip: str, text: str, hex_str: str, raw_b64: str | None = None) -> None:
    _backend_post(
        "/api/internal/telemetry",
        {
            "addr": addr,
            "ip": ip,
            "direction": "rx",
            "text": text,
            "hex": hex_str,
            "ts": dt.datetime.utcnow().isoformat() + "Z",
        },
    )


# ---------------------------------------------------------------------------
# Parseo de buffer / chunks
# ---------------------------------------------------------------------------

def split_lines(buffer: str) -> tuple[list[str], str]:
    """Corta por \\r\\n, \\n o \\r (en ese orden de preferencia por posición)."""
    lines: list[str] = []
    while buffer:
        # Buscar el primer separador que aparezca
        idx_rn = buffer.find("\r\n")
        idx_n = buffer.find("\n")
        idx_r = buffer.find("\r")

        best_pos = -1
        best_width = 0

        def consider(pos: int, width: int) -> None:
            nonlocal best_pos, best_width
            if pos < 0:
                return
            if best_pos < 0 or pos < best_pos:
                best_pos, best_width = pos, width

        consider(idx_rn, 2)
        # \n suelto (si no es el de un \r\n ya considerado en la misma posición)
        if idx_n >= 0 and idx_n != idx_rn + 1:
            consider(idx_n, 1)
        # \r suelto (si no inicia un \r\n)
        if idx_r >= 0 and idx_r != idx_rn:
            consider(idx_r, 1)

        if best_pos < 0:
            break

        line = buffer[:best_pos]
        buffer = buffer[best_pos + best_width :]
        if line != "":
            lines.append(line)
    return lines, buffer


def maybe_sensor_frame(buffer: str) -> tuple[list[str], str]:
    """Si no hay salto de línea pero hay trama completa (regex), procesarla."""
    if "\n" in buffer or "\r" in buffer:
        return [], buffer
    m = SENSOR_FRAME_RE.search(buffer)
    if not m:
        return [], buffer
    # Trama completa que llena el buffer, o buffer ya suficientemente largo
    if m.end() == len(buffer.strip()) or len(buffer) >= 8:
        frame = m.group(0)
        rest = buffer[m.end() :]
        return [frame], rest
    return [], buffer


def bytes_to_views(data: bytes) -> tuple[str, str]:
    """Interpretación dual: texto UTF-8 y hex."""
    text = data.decode("utf-8", errors="replace")
    hex_str = data.hex()
    return text, hex_str


def parse_chunks(line: str) -> dict[str, Any]:
    """
    Interpreta una línea como JSON, hex puro o texto.
    Conserva compatibilidad con el flujo JSON de test_9910.py.
    """
    raw = line.strip()
    result: dict[str, Any] = {
        "raw": raw,
        "kind": "text",
        "json": None,
        "hex": raw.encode("utf-8", errors="replace").hex(),
        "text": raw,
    }

    # JSON
    if "{" in raw and "}" in raw:
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            obj = json.loads(raw[start:end])
            result["kind"] = "json"
            result["json"] = obj
            if isinstance(obj, dict):
                imei = obj.get("IMEI") or obj.get("imei") or obj.get("id")
                if imei:
                    result["imei"] = str(imei)
            return result
        except json.JSONDecodeError:
            pass

    # Hex puro (solo [0-9A-Fa-f], longitud par)
    hex_candidate = re.sub(r"[\s:]", "", raw)
    if len(hex_candidate) >= 2 and len(hex_candidate) % 2 == 0 and re.fullmatch(
        r"[0-9A-Fa-f]+", hex_candidate
    ):
        try:
            decoded = binascii.unhexlify(hex_candidate)
            result["kind"] = "hex"
            result["hex"] = hex_candidate.lower()
            result["text"] = decoded.decode("utf-8", errors="replace")
            result["raw_bytes"] = decoded
            return result
        except (binascii.Error, ValueError):
            pass

    return result


def forward_legacy_json(mensaje_json: dict, conn: socket.socket) -> None:
    """Compatibilidad opcional con APIs TermoKing / Datos."""
    respuesta = "sin envio"
    try:
        r = requests.post(API_URL, json=mensaje_json, timeout=5)
        respuesta = r.text
        log.info("API TermoKing: %s", respuesta[:200])
    except Exception as e:
        log.warning("API TermoKing error: %s", e)
    try:
        requests.post(API_URL2, json=mensaje_json, timeout=5)
    except Exception as e:
        log.warning("API Datos error: %s", e)
    try:
        conn.sendall(respuesta.encode("utf-8"))
    except OSError:
        log.warning("No se pudo devolver respuesta al cliente")


def process_line(line: str, key: str, conn: socket.socket, ip: str) -> None:
    parsed = parse_chunks(line)
    if parsed.get("imei"):
        set_imei(key, parsed["imei"])

    text = parsed.get("text") or line
    hex_str = parsed.get("hex") or line.encode("utf-8", errors="replace").hex()

    log.info("RX [%s] kind=%s text=%r hex=%s", key, parsed["kind"], text[:120], hex_str[:64])

    notify_data(key, ip, text, hex_str)

    if FORWARD_LEGACY and parsed.get("json") is not None:
        forward_legacy_json(parsed["json"], conn)


# ---------------------------------------------------------------------------
# Cliente TCP
# ---------------------------------------------------------------------------

def handle_client(conn: socket.socket, addr: tuple) -> None:
    key = register_pending(addr, conn)
    ip = addr[0]
    log.info("Cliente conectado: %s", key)
    notify_connect(key, ip)

    buffer = ""
    try:
        while True:
            data = conn.recv(RECV_SIZE)
            if not data:
                log.info("Cliente desconectado: %s", key)
                break

            touch_rx(key)
            text_chunk, hex_chunk = bytes_to_views(data)
            # Log dual hex/string del chunk crudo
            log.debug("chunk %s text=%r hex=%s", key, text_chunk[:80], hex_chunk[:80])

            buffer += text_chunk

            lines, buffer = split_lines(buffer)
            if not lines:
                frames, buffer = maybe_sensor_frame(buffer)
                lines = frames
                if frames:
                    buffer = ""

            for line in lines:
                try:
                    process_line(line, key, conn, ip)
                except Exception as e:
                    log.exception("process_line %s: %s", key, e)

    except Exception as e:
        log.error("Error en %s: %s", key, e)
    finally:
        unregister(key, notify=True)
        log.info("Conexión cerrada: %s", key)


def tcp_server_loop() -> None:
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((HOST, TCP_PORT))
    srv.listen(10)
    log.info("TCP escuchando en %s:%s", HOST, TCP_PORT)

    while True:
        conn, addr = srv.accept()
        t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
        t.start()


# ---------------------------------------------------------------------------
# Envío a dispositivo (string o hex)
# ---------------------------------------------------------------------------

def encode_payload(message: str, encoding: str) -> bytes:
    encoding = (encoding or "string").lower()
    if encoding in ("hex", "hexadecimal"):
        cleaned = re.sub(r"[\s:]", "", message)
        if len(cleaned) % 2 != 0:
            raise ValueError("Hex debe tener longitud par")
        return binascii.unhexlify(cleaned)
    return message.encode("utf-8")


def send_to_device(
    *,
    addr: str | None = None,
    ip: str | None = None,
    message: str,
    encoding: str = "string",
) -> dict[str, Any]:
    payload = encode_payload(message, encoding)

    target_key = None
    conn = None
    if addr:
        conn = get_conn_by_addr(addr)
        target_key = addr
    elif ip:
        found = get_conn_by_ip(ip)
        if found:
            target_key, conn = found

    if not conn or not target_key:
        return {"ok": False, "error": "dispositivo no conectado"}

    try:
        conn.sendall(payload)
    except OSError as e:
        unregister(target_key, notify=True)
        return {"ok": False, "error": f"send falló: {e}"}

    text_view, hex_view = bytes_to_views(payload)
    _backend_post(
        "/api/internal/telemetry",
        {
            "addr": target_key,
            "ip": target_key.split(":")[0],
            "direction": "tx",
            "text": text_view,
            "hex": hex_view,
            "encoding": encoding,
            "ts": dt.datetime.utcnow().isoformat() + "Z",
        },
    )
    return {
        "ok": True,
        "addr": target_key,
        "bytes": len(payload),
        "hex": hex_view,
        "text": text_view,
    }


# ---------------------------------------------------------------------------
# HTTP interno (comandos + listado)
# ---------------------------------------------------------------------------

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"ok": True, "connections": len(_conn_by_addr)})


@app.get("/devices")
def devices():
    return jsonify({"devices": list_connections()})


@app.post("/send")
def send():
    body = request.get_json(force=True, silent=True) or {}
    message = body.get("message")
    if message is None or message == "":
        return jsonify({"ok": False, "error": "message requerido"}), 400
    try:
        result = send_to_device(
            addr=body.get("addr"),
            ip=body.get("ip"),
            message=str(message),
            encoding=body.get("encoding", "string"),
        )
    except (ValueError, binascii.Error) as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    status = 200 if result.get("ok") else 404
    return jsonify(result), status


@app.post("/sweep")
def sweep():
    n = sweep_orphans()
    return jsonify({"removed": n, "devices": list_connections()})


def run_http() -> None:
    app.run(host="0.0.0.0", port=HTTP_PORT, threaded=True, use_reloader=False)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    notify_disconnect_all()
    threading.Thread(target=orphan_loop, daemon=True).start()
    threading.Thread(target=run_http, daemon=True).start()
    tcp_server_loop()


if __name__ == "__main__":
    main()
