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
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:9081").rstrip("/")

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


def build_tcp_header(
    addr: tuple,
    *,
    payload_len: int = 0,
    event: str = "data",
) -> dict[str, Any]:
    """Cabecera de conexión TCP a nivel aplicación (peer + puerto local)."""
    return {
        "event": event,
        "protocol": "TCP",
        "src_ip": addr[0],
        "src_port": addr[1],
        "dst_ip": HOST if HOST != "0.0.0.0" else "0.0.0.0",
        "dst_port": TCP_PORT,
        "payload_len": payload_len,
        "family": "AF_INET",
    }


def bytes_to_decimal(raw: bytes) -> tuple[str, int | None]:
    """
    Convierte trama a decimal:
    - decimal: bytes separados por espacio (ej. '10 255 0')
    - decimal_int: entero big-endian si la trama tiene 1..8 bytes
    """
    decimal = " ".join(str(b) for b in raw)
    decimal_int = int.from_bytes(raw, byteorder="big", signed=False) if 1 <= len(raw) <= 8 else None
    return decimal, decimal_int


def notify_connect(addr: str, ip: str, tcp_header: dict | None = None) -> None:
    payload: dict[str, Any] = {"addr": addr, "ip": ip}
    if tcp_header:
        payload["tcp_header"] = tcp_header
    _backend_post("/api/internal/connect", payload)


def notify_data(
    addr: str,
    ip: str,
    text: str,
    hex_str: str,
    *,
    value_type: str = "hex",
    int_value: int | None = None,
    decimal: str | None = None,
    direction: str = "rx",
    encoding: str | None = None,
    tcp_header: dict | None = None,
    frame_len: int | None = None,
) -> None:
    payload: dict[str, Any] = {
        "addr": addr,
        "ip": ip,
        "direction": direction,
        "text": text,
        "hex": hex_str,
        "value_type": value_type,
        "ts": dt.datetime.utcnow().isoformat() + "Z",
    }
    if int_value is not None:
        payload["int_value"] = int_value
    if decimal is not None:
        payload["decimal"] = decimal
    if encoding:
        payload["encoding"] = encoding
    if tcp_header is not None:
        payload["tcp_header"] = tcp_header
    if frame_len is not None:
        payload["frame_len"] = frame_len
    _backend_post("/api/internal/telemetry", payload)


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


def looks_like_ascii_hex(text: str) -> bool:
    cleaned = re.sub(r"[\s:]", "", text.strip())
    return (
        len(cleaned) >= 2
        and len(cleaned) % 2 == 0
        and re.fullmatch(r"[0-9A-Fa-f]+", cleaned) is not None
    )


def parse_chunks(line: str) -> dict[str, Any]:
    """
    Los equipos envían tramas hexadecimales.
    Prioridad: hex (ASCII o binario representado) → JSON → int → string.
    """
    raw = line.strip()
    result: dict[str, Any] = {
        "raw": raw,
        "kind": "string",
        "value_type": "string",
        "json": None,
        "int_value": None,
        "hex": raw.encode("utf-8", errors="replace").hex(),
        "text": raw,
        "payload_bytes": raw.encode("utf-8", errors="replace"),
    }

    # Hex ASCII (objetivo principal de los equipos)
    hex_candidate = re.sub(r"[\s:]", "", raw)
    if looks_like_ascii_hex(raw):
        try:
            decoded = binascii.unhexlify(hex_candidate)
            decimal, decimal_int = bytes_to_decimal(decoded)
            result.update(
                {
                    "kind": "hex",
                    "value_type": "hex",
                    "hex": hex_candidate.lower(),
                    "text": decoded.decode("utf-8", errors="replace"),
                    "payload_bytes": decoded,
                    "decimal": decimal,
                    "int_value": decimal_int,
                }
            )
            return result
        except (binascii.Error, ValueError):
            pass

    # JSON (compat)
    if "{" in raw and "}" in raw:
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            obj = json.loads(raw[start:end])
            payload = raw[start:end].encode("utf-8")
            decimal, decimal_int = bytes_to_decimal(payload)
            result.update(
                {
                    "kind": "json",
                    "value_type": "json",
                    "json": obj,
                    "hex": payload.hex(),
                    "text": raw[start:end],
                    "payload_bytes": payload,
                    "decimal": decimal,
                    "int_value": decimal_int,
                }
            )
            if isinstance(obj, dict):
                imei = obj.get("IMEI") or obj.get("imei") or obj.get("id")
                if imei:
                    result["imei"] = str(imei)
            return result
        except json.JSONDecodeError:
            pass

    # Entero decimal puro
    if re.fullmatch(r"[+-]?\d+", raw):
        try:
            n = int(raw, 10)
            payload = str(n).encode("utf-8")
            decimal, _ = bytes_to_decimal(payload)
            result.update(
                {
                    "kind": "int",
                    "value_type": "int",
                    "int_value": n,
                    "text": str(n),
                    "hex": payload.hex(),
                    "payload_bytes": payload,
                    "decimal": str(n),
                }
            )
            return result
        except ValueError:
            pass

    # String: guardar igual en hex + decimal de sus bytes
    payload = raw.encode("utf-8", errors="replace")
    decimal, decimal_int = bytes_to_decimal(payload)
    result["hex"] = payload.hex()
    result["payload_bytes"] = payload
    result["decimal"] = decimal
    result["int_value"] = decimal_int
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


def process_frame(
    payload: bytes,
    key: str,
    addr: tuple,
    *,
    ascii_hint: str | None = None,
    conn: socket.socket | None = None,
) -> None:
    """Guarda trama completa en hex + decimal, con cabecera TCP."""
    ip = addr[0]
    header = build_tcp_header(addr, payload_len=len(payload), event="data")

    # Si llega como texto hex ASCII, usar parse_chunks; si es binario, hex directo
    if ascii_hint is not None and looks_like_ascii_hex(ascii_hint):
        parsed = parse_chunks(ascii_hint)
        raw_bytes = parsed.get("payload_bytes") or payload
        hex_str = parsed.get("hex") or raw_bytes.hex()
        text = parsed.get("text") or ascii_hint
        value_type = parsed.get("value_type") or "hex"
        decimal = parsed.get("decimal")
        int_value = parsed.get("int_value")
        if parsed.get("imei"):
            set_imei(key, parsed["imei"])
        if FORWARD_LEGACY and parsed.get("json") is not None and conn is not None:
            forward_legacy_json(parsed["json"], conn)
    else:
        raw_bytes = payload
        hex_str = payload.hex()
        text = payload.decode("utf-8", errors="replace")
        value_type = "hex"
        decimal, int_value = bytes_to_decimal(payload)

    if decimal is None:
        decimal, maybe_int = bytes_to_decimal(raw_bytes)
        if int_value is None:
            int_value = maybe_int

    log.info(
        "RX [%s] hex=%s decimal=%s len=%d",
        key,
        hex_str[:80],
        (decimal or "")[:60],
        len(raw_bytes),
    )

    notify_data(
        key,
        ip,
        text,
        hex_str,
        value_type=value_type,
        int_value=int_value,
        decimal=decimal,
        direction="rx",
        tcp_header=header,
        frame_len=len(raw_bytes),
    )


def process_line(line: str, key: str, conn: socket.socket, addr: tuple) -> None:
    """Compat: línea de texto → trama (hex preferente)."""
    if not line.strip():
        return
    if looks_like_ascii_hex(line):
        try:
            payload = binascii.unhexlify(re.sub(r"[\s:]", "", line.strip()))
        except (binascii.Error, ValueError):
            payload = line.encode("utf-8", errors="replace")
    else:
        payload = line.encode("utf-8", errors="replace")
    process_frame(payload, key, addr, ascii_hint=line, conn=conn)


# ---------------------------------------------------------------------------
# Cliente TCP
# ---------------------------------------------------------------------------

def handle_client(conn: socket.socket, addr: tuple) -> None:
    key = register_pending(addr, conn)
    ip = addr[0]
    header = build_tcp_header(addr, payload_len=0, event="connect")
    log.info("Cliente conectado: %s header=%s", key, header)
    notify_connect(key, ip, tcp_header=header)
    # Registrar cabecera TCP también como evento histórico
    notify_data(
        key,
        ip,
        text=f"CONNECT {ip}:{addr[1]} → {TCP_PORT}",
        hex_str="",
        value_type="tcp_header",
        direction="rx",
        tcp_header=header,
        frame_len=0,
    )

    buffer = ""
    try:
        while True:
            data = conn.recv(RECV_SIZE)
            if not data:
                log.info("Cliente desconectado: %s", key)
                break

            touch_rx(key)

            # Trama binaria: si no parece ASCII printable/hex, capturar chunk completo
            try:
                as_text = data.decode("utf-8")
                is_text = as_text.isprintable() or any(c in as_text for c in "\r\n\t")
            except UnicodeDecodeError:
                as_text = ""
                is_text = False

            if not is_text:
                # Trama binaria completa del recv
                process_frame(data, key, addr, ascii_hint=None, conn=conn)
                continue

            buffer += as_text
            lines, buffer = split_lines(buffer)
            if not lines:
                # Sin salto de línea: si es hex ASCII completo o trama sensor, procesar
                if looks_like_ascii_hex(buffer) and len(buffer.strip()) >= 2:
                    lines = [buffer.strip()]
                    buffer = ""
                else:
                    frames, buffer = maybe_sensor_frame(buffer)
                    lines = frames
                    if frames:
                        buffer = ""

            for line in lines:
                try:
                    process_line(line, key, conn, addr)
                except Exception as e:
                    log.exception("process_line %s: %s", key, e)

    except Exception as e:
        log.error("Error en %s: %s", key, e)
    finally:
        # Evento disconnect con cabecera
        notify_data(
            key,
            ip,
            text=f"DISCONNECT {ip}:{addr[1]}",
            hex_str="",
            value_type="tcp_header",
            direction="rx",
            tcp_header=build_tcp_header(addr, payload_len=0, event="disconnect"),
            frame_len=0,
        )
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
    if encoding == "int":
        n = int(str(message).strip(), 10)
        return str(n).encode("utf-8")
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
    decimal, decimal_int = bytes_to_decimal(payload)
    enc = (encoding or "string").lower()
    value_type = "hex" if enc in ("hex", "hexadecimal") else ("int" if enc == "int" else "string")
    int_value = decimal_int
    if value_type == "int":
        try:
            int_value = int(text_view.strip(), 10)
            decimal = str(int_value)
        except ValueError:
            pass

    peer = target_key.split(":")
    peer_addr = (peer[0], int(peer[1])) if len(peer) == 2 and peer[1].isdigit() else (peer[0], 0)
    header = build_tcp_header(peer_addr, payload_len=len(payload), event="tx")

    notify_data(
        target_key,
        peer_addr[0],
        text_view,
        hex_view,
        value_type=value_type,
        int_value=int_value,
        decimal=decimal,
        direction="tx",
        encoding=enc,
        tcp_header=header,
        frame_len=len(payload),
    )
    return {
        "ok": True,
        "addr": target_key,
        "bytes": len(payload),
        "hex": hex_view,
        "decimal": decimal,
        "text": text_view,
        "value_type": value_type,
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
