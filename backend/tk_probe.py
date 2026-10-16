"""Prueba manual de lecturas. No arma el JSON ni lo publica."""

from __future__ import annotations

import asyncio
import time
from typing import Any, Awaitable, Callable

from tk_analysis import BY_ID, decode_pasted

Send = Callable[[str], Awaitable[bool]]
Wait = Callable[[str, float, float], Awaitable[dict[str, Any] | None]]


def autosend_allowed(held: bool) -> bool:
    """Con la prueba tomada, el ciclo no consulta ni hace POST."""
    return not held


async def run_probe(command_ids: list[str], send: Send, wait: Wait) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for cid in command_ids:
        spec = BY_ID.get(cid)
        if not spec:
            results.append({"id": cid, "ok": False, "error": "comando desconocido", "fields": []})
            continue
        sent_at = time.monotonic()
        if not await send(spec["hex"]):
            results.append(
                {
                    "id": cid,
                    "title": spec["title"],
                    "ok": False,
                    "error": "no se pudo enviar",
                    "tx": spec["hex"],
                    "fields": [],
                }
            )
            continue
        got = await wait(spec["expect"], sent_at, 8.0)
        payload = (got or {}).get("payload") or ""
        if spec["expect"] not in payload.lower():
            results.append(
                {
                    "id": cid,
                    "title": spec["title"],
                    "ok": False,
                    "error": "sin respuesta",
                    "tx": spec["hex"],
                    "imei": (got or {}).get("imei"),
                    "fields": [],
                }
            )
            continue
        decoded = decode_pasted(payload, cid)
        if got and got.get("imei") and not decoded.get("imei"):
            decoded["imei"] = got["imei"]
        decoded.update({"id": cid, "tx": spec["hex"], "rx": payload})
        results.append(decoded)
        await asyncio.sleep(0.3)
    return results
