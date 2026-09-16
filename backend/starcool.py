"""
Starcool METRO (caso_starcool.md) — parseo puro, sin I/O.

TX hex fijo por sesión TCP. RX = IMEI (ASCII en hex) + payload desde 161693.
POST { i: IMEI, d01: METRO, d02: sector2 }.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from typing import Any
from urllib.parse import urlparse

DEFAULT_URL = "http://161.132.53.51:9050/Starcool/"
DEFAULT_TX_HEX = "161613ffffffff8457"
MARKER = "161693"
D01_STATIC = "METRO"
IMEI_RE = re.compile(r"^\d{15}$")
HEX_ONLY_RE = re.compile(r"^[0-9a-fA-F]+$")


def env_enabled() -> bool:
    raw = (os.getenv("STARCOOL_ENABLED", "1") or "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def env_url() -> str:
    return (os.getenv("STARCOOL_URL", DEFAULT_URL) or DEFAULT_URL).strip()


def env_tx_hex() -> str:
    return normalize_hex(os.getenv("STARCOOL_TX_HEX", DEFAULT_TX_HEX) or DEFAULT_TX_HEX) or DEFAULT_TX_HEX


def env_d01() -> str:
    return (os.getenv("STARCOOL_D01", D01_STATIC) or D01_STATIC).strip() or D01_STATIC


def env_interval_s() -> float:
    try:
        return max(15.0, min(float(os.getenv("STARCOOL_INTERVAL_S", "60")), 3600.0))
    except ValueError:
        return 60.0


def env_rx_timeout_s() -> float:
    try:
        return max(2.0, min(float(os.getenv("STARCOOL_RX_TIMEOUT_S", "8")), 60.0))
    except ValueError:
        return 8.0


def env_post_timeout_s() -> float:
    try:
        return max(1.0, min(float(os.getenv("STARCOOL_POST_TIMEOUT_S", "8")), 60.0))
    except ValueError:
        return 8.0


def env_post_retries() -> int:
    try:
        return max(1, min(int(os.getenv("STARCOOL_POST_RETRIES", "3")), 8))
    except ValueError:
        return 3


def env_dedup_s() -> int:
    try:
        return max(0, min(int(os.getenv("STARCOOL_DEDUP_S", "30")), 600))
    except ValueError:
        return 30


def env_concurrency() -> int:
    try:
        return max(1, min(int(os.getenv("STARCOOL_POLL_CONCURRENCY", "5")), 32))
    except ValueError:
        return 5


def destination_host(url: str | None = None) -> str | None:
    target = url if url is not None else env_url()
    if not target:
        return None
    try:
        return urlparse(target).netloc or None
    except Exception:
        return None


def normalize_hex(value: Any) -> str:
    return re.sub(r"[^0-9a-fA-F]", "", str(value or "")).lower()


def build_payload(imei: str, d02: str, d01: str | None = None) -> dict[str, str]:
    return {
        "i": str(imei).strip(),
        "d01": (d01 or env_d01()).strip() or D01_STATIC,
        "d02": normalize_hex(d02),
    }


def payload_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def parse_rx_hex(raw: str) -> dict[str, str] | None:
    """Corta IMEI + d02 en el primer 161693. Ignora el eco del TX 161613…"""
    h = normalize_hex(raw)
    if not h or len(h) < 20:
        return None
    tx = env_tx_hex()
    if h == tx or h.startswith(tx):
        return None
    idx = h.find(MARKER)
    if idx < 2 or idx % 2 != 0:
        return None
    sector1 = h[:idx]
    sector2 = h[idx:]
    if len(sector1) < 2 or len(sector1) % 2 != 0:
        return None
    try:
        imei = bytes.fromhex(sector1).decode("ascii")
    except Exception:
        return None
    imei = "".join(ch for ch in imei if ch.isprintable()).strip()
    if not IMEI_RE.match(imei):
        return None
    if not sector2.startswith(MARKER) or len(sector2) < 12:
        return None
    return {"i": imei, "d01": env_d01(), "d02": sector2}


def parse_frame(doc: dict[str, Any] | None) -> dict[str, str] | None:
    if not doc:
        return None
    if str(doc.get("direction") or "rx").lower() != "rx":
        return None
    if str(doc.get("value_type") or "").lower() == "tcp_header":
        return None
    for raw in (doc.get("hex"), doc.get("text")):
        text = str(raw or "").strip()
        if not text:
            continue
        if HEX_ONLY_RE.match(re.sub(r"[\s:]", "", text)):
            parsed = parse_rx_hex(text)
            if parsed:
                return parsed
    return None
