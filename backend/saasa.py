"""
Homologación SAASA (caso_saasa.md / logica_comunicacion.json).

Una conexión TCP multiplexa 8 unidades. La respuesta es
{"i":"SAASA","rs":"<hex>"} — el unit id no viaja en el RX, así que
GET_DATA se envía de a una unidad y el rs se atribuye a esa consulta.

Parseo puro. El poller, el POST y Mongo viven en main.py.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from typing import Any
from urllib.parse import urlparse

from homologate import split_json_objects

DEFAULT_UNITS = (
    "SAASA_UNIT111",
    "SAASA_UNIT222",
    "SAASA_UNIT333",
    "SAASA_UNIT444",
    "SAASA_UNIT555",
    "SAASA_UNIT666",
    "SAASA_UNIT777",
    "SAASA_UNIT888",
)
DEFAULT_URL = "http://161.132.53.51:9050/Starcool/"
D01_STATIC = "SAASA"
UNIT_RE = re.compile(r"^SAASA_UNIT\d+$", re.IGNORECASE)
CMD_RE = re.compile(r"^(SAASA_UNIT\d+)_GET_DATA$", re.IGNORECASE)


def env_enabled() -> bool:
    raw = (os.getenv("SAASA_ENABLED", "1") or "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def env_url() -> str:
    return (os.getenv("SAASA_URL", DEFAULT_URL) or DEFAULT_URL).strip()


def env_interval_s() -> float:
    try:
        return max(15.0, min(float(os.getenv("SAASA_INTERVAL_S", "60")), 3600.0))
    except ValueError:
        return 60.0


def env_rx_timeout_s() -> float:
    try:
        return max(2.0, min(float(os.getenv("SAASA_RX_TIMEOUT_S", "12")), 60.0))
    except ValueError:
        return 12.0


def env_gap_s() -> float:
    try:
        return max(0.0, min(float(os.getenv("SAASA_GAP_S", "0.8")), 30.0))
    except ValueError:
        return 0.8


def env_post_timeout_s() -> float:
    try:
        return max(1.0, min(float(os.getenv("SAASA_POST_TIMEOUT_S", "8")), 60.0))
    except ValueError:
        return 8.0


def env_post_retries() -> int:
    try:
        return max(1, min(int(os.getenv("SAASA_POST_RETRIES", "3")), 8))
    except ValueError:
        return 3


def env_units() -> list[str]:
    raw = (os.getenv("SAASA_UNITS", "") or "").strip()
    if not raw:
        return list(DEFAULT_UNITS)
    out: list[str] = []
    for part in raw.split(","):
        u = part.strip().upper()
        if UNIT_RE.match(u) and u not in out:
            out.append(u)
    return out or list(DEFAULT_UNITS)


def destination_host(url: str | None = None) -> str | None:
    target = url if url is not None else env_url()
    if not target:
        return None
    try:
        return urlparse(target).netloc or None
    except Exception:
        return None


def command_for(unit: str) -> str:
    return f"{str(unit).strip().upper()}_GET_DATA"


def unit_from_command(line: str) -> str | None:
    m = CMD_RE.match(str(line or "").strip())
    return m.group(1).upper() if m else None


def parse_rx(text: str) -> dict[str, str] | None:
    """Extrae el sobre SAASA. Ignora GET_DATA, IMEI y JSON POLLO (d0x)."""
    for obj in split_json_objects(text):
        ident = str(obj.get("i") or "").strip()
        rs = str(obj.get("rs") or "").strip()
        if ident.upper() != D01_STATIC:
            continue
        if not rs:
            continue
        if rs.upper().endswith("_GET_DATA"):
            continue
        return {"i": ident, "rs": rs}
    return None


def build_payload(unit: str, rs: str) -> dict[str, str]:
    """JSON que se POST-ea al API (caso_saasa.md)."""
    return {
        "i": str(unit).strip().upper(),
        "d01": D01_STATIC,
        "d02": str(rs).strip(),
    }


def payload_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
