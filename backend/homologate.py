"""
Homologación madurador (rama test-carne) → JSON TermoKing.

Fase actual (logica_madurador_carne.md): i, d1←d01/82A700, d2←d02/82A701,
d3 y d4 fijos. d03–d05 no salen todavía.

Parseo puro, sin I/O. El envío HTTP vive en main.py para no bloquear el socket 9912.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

OP_SENSOR = "82A700"
OP_CONTROL = "82A701"
OP_IO = "82A702"
OP_CAPTION = "82A703"
OP_ALARM = "82A706"
OPS_STANDARD = (OP_SENSOR, OP_CONTROL, OP_ALARM)
D0X_RE = re.compile(r"^d\d{2}$", re.IGNORECASE)
# Constantes de esta fase. No se leen del equipo.
D3_STATIC = "1 32516 1051 0 0 0 0.0"
D4_STATIC = "UNIT111"


def env_enabled() -> bool:
    raw = (os.getenv("HOMOLOGATE_ENABLED", "1") or "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def env_url() -> str:
    return (os.getenv("HOMOLOGATE_URL", "") or "").strip()


def env_unit() -> str:
    return (os.getenv("HOMOLOGATE_UNIT", "UNIT111") or "UNIT111").strip() or "UNIT111"


def env_timeout() -> float:
    try:
        return max(1.0, float(os.getenv("HOMOLOGATE_TIMEOUT_S", "5")))
    except ValueError:
        return 5.0


def env_retries() -> int:
    try:
        return max(1, min(int(os.getenv("HOMOLOGATE_RETRIES", "3")), 8))
    except ValueError:
        return 3


def env_dedup_s() -> int:
    try:
        return max(0, min(int(os.getenv("HOMOLOGATE_DEDUP_S", "30")), 600))
    except ValueError:
        return 30


def env_queue_interval_s() -> float:
    try:
        return max(0.0, min(float(os.getenv("HOMOLOGATE_QUEUE_INTERVAL_S", "5")), 120))
    except ValueError:
        return 5.0


def env_tz() -> ZoneInfo:
    name = (os.getenv("HOMOLOGATE_TZ", "America/Lima") or "America/Lima").strip()
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo("America/Lima")


def hour_key(ts: str | None) -> str:
    """Misma clave que el frontend: YYYY-MM-DD HH:00 en zona local (Lima)."""
    if not ts:
        return "desconocida"
    raw = str(ts).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        local = dt.astimezone(env_tz())
        return f"{local.year:04d}-{local.month:02d}-{local.day:02d} {local.hour:02d}:00"
    except Exception:
        return "desconocida"


def date_key(ts: str | None) -> str:
    """YYYY-MM-DD en zona local (Lima), alineado con hour_key."""
    hk = hour_key(ts)
    return hk[:10] if len(hk) >= 10 and hk != "desconocida" else "desconocida"


def destination_host(url: str | None = None) -> str | None:
    target = url if url is not None else env_url()
    if not target:
        return None
    try:
        return urlparse(target).netloc or None
    except Exception:
        return None


def split_json_objects(raw: str) -> list[dict[str, Any]]:
    """Parte JSON concatenados (`}{`) con contador de llaves."""
    text = str(raw or "")
    if "{" not in text:
        return []
    objs: list[dict[str, Any]] = []
    depth = 0
    start = -1
    in_str = False
    escape = False
    for i, ch in enumerate(text):
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth <= 0:
                continue
            depth -= 1
            if depth == 0 and start >= 0:
                chunk = text[start : i + 1]
                try:
                    parsed = json.loads(chunk)
                except json.JSONDecodeError:
                    parsed = None
                if isinstance(parsed, dict):
                    objs.append(parsed)
                start = -1
    return objs


def normalize_hex(value: Any) -> str:
    return re.sub(r"[\s:]", "", str(value or "")).upper()


def has_d0x(obj: dict[str, Any]) -> bool:
    return any(isinstance(k, str) and D0X_RE.match(k) for k in obj)


def index_opcodes(obj: dict[str, Any]) -> dict[str, str]:
    """Opcode → valor hex original (sin remapear por nombre d0x)."""
    found: dict[str, str] = {}
    for value in obj.values():
        if not isinstance(value, str):
            continue
        hexv = normalize_hex(value)
        if not hexv:
            continue
        for op in (OP_SENSOR, OP_CONTROL, OP_IO, OP_CAPTION, OP_ALARM):
            if op in hexv and op not in found:
                found[op] = hexv
    return found


def payload_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def named_hex(obj: dict[str, Any], name: str) -> str:
    """Hex de un campo por nombre (d01, d02). No busca el opcode en otro d0x."""
    want = name.lower()
    for key, value in obj.items():
        if isinstance(key, str) and key.lower() == want and isinstance(value, str):
            return normalize_hex(value)
    return ""


def build_standard(obj: dict[str, Any], unit: str | None = None) -> dict[str, Any] | None:
    """Arma el JSON de esta fase. Sin d1 y d2 no hay envío."""
    ident = obj.get("i")
    if ident is None or str(ident).strip() == "":
        return None
    if not has_d0x(obj):
        return None
    sensor = named_hex(obj, "d01")
    control = named_hex(obj, "d02")
    if OP_SENSOR not in sensor or OP_CONTROL not in control:
        return None
    return {
        "i": str(ident),
        "d1": sensor,
        "d2": control,
        "d3": D3_STATIC,
        "d4": unit or D4_STATIC,
    }


def classify_frame(doc: dict[str, Any]) -> dict[str, Any]:
    """
    Decide si un mensaje persistido debe generar POST.

    status:
      skip | incomplete | ready
    """
    direction = (doc.get("direction") or "rx").lower()
    value_type = (doc.get("value_type") or "").lower()
    raw = doc.get("text") or ""
    result: dict[str, Any] = {
        "status": "skip",
        "reason": "",
        "objects": 0,
        "opcodes": [],
        "payload": None,
        "payload_hash": None,
    }

    if direction != "rx":
        result["reason"] = "not_rx"
        return result
    if value_type == "tcp_header":
        result["reason"] = "tcp_header"
        return result
    if not str(raw).strip():
        result["reason"] = "empty_text"
        return result

    objects = split_json_objects(raw)
    result["objects"] = len(objects)
    if not objects:
        result["reason"] = "no_json"
        return result

    data_objs = [o for o in objects if has_d0x(o)]
    if not data_objs:
        result["reason"] = "status_rs"
        return result

    # Un POST por frame: primer objeto de datos completo
    incomplete = False
    for obj in data_objs:
        ops = index_opcodes(obj)
        result["opcodes"] = sorted(ops.keys())
        if not obj.get("i"):
            incomplete = True
            result["reason"] = "missing_i"
            continue
        payload = build_standard(obj)
        if payload:
            result["status"] = "ready"
            result["reason"] = "ok"
            result["payload"] = payload
            result["payload_hash"] = payload_hash(payload)
            return result
        incomplete = True
        result["reason"] = "incomplete_opcodes"

    if incomplete:
        result["status"] = "incomplete"
    return result
