"""
Backend REST + WebSocket para el monitor serial TCP (puerto 9910).

- Guarda RX/TX en MongoDB
- Mantiene estado de dispositivos conectados
- Reenvía comandos al tcp_bridge (hex o string)
- Empuja eventos en vivo al frontend vía WebSocket
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://mongo:27017")
MONGO_DB = os.getenv("MONGO_DB", "test_4g")
BRIDGE_URL = os.getenv("BRIDGE_URL", "http://tcp_bridge:8081").rstrip("/")

app = FastAPI(title="TEST_4G Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client: AsyncIOMotorClient | None = None
db = None
_ws_clients: set[WebSocket] = set()


class SendBody(BaseModel):
    message: str
    encoding: str = Field(default="string", description="string | hex")
    addr: str | None = None
    ip: str | None = None


class TelemetryBody(BaseModel):
    addr: str
    ip: str
    direction: str = "rx"
    text: str = ""
    hex: str = ""
    encoding: str | None = None
    ts: str | None = None


class ConnectBody(BaseModel):
    addr: str
    ip: str
    imei: str | None = None


# ---------------------------------------------------------------------------
# WebSocket fan-out
# ---------------------------------------------------------------------------

async def broadcast(event: dict[str, Any]) -> None:
    dead: list[WebSocket] = []
    for ws in list(_ws_clients):
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.discard(ws)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup() -> None:
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[MONGO_DB]
    await db.messages.create_index([("ts", -1)])
    await db.messages.create_index([("addr", 1), ("ts", -1)])
    await db.devices.create_index("addr", unique=True)
    await db.devices.create_index("ip")


@app.on_event("shutdown")
async def shutdown() -> None:
    if client:
        client.close()


# ---------------------------------------------------------------------------
# Interno (llamado por tcp_bridge)
# ---------------------------------------------------------------------------

@app.post("/api/internal/disconnect_all")
async def disconnect_all():
    result = await db.devices.update_many(
        {"is_connected": True},
        {"$set": {"is_connected": False, "disconnected_at": _now()}},
    )
    await broadcast({"type": "disconnect_all"})
    return {"ok": True, "modified": result.modified_count}


@app.post("/api/internal/connect")
async def internal_connect(body: ConnectBody):
    now = _now()
    await db.devices.update_one(
        {"addr": body.addr},
        {
            "$set": {
                "addr": body.addr,
                "ip": body.ip,
                "imei": body.imei,
                "is_connected": True,
                "connected_at": now,
                "last_seen": now,
            },
            "$unset": {"disconnected_at": ""},
        },
        upsert=True,
    )
    # Limpiar otras entradas de la misma IP que quedaron huérfanas en DB
    await db.devices.update_many(
        {"ip": body.ip, "addr": {"$ne": body.addr}, "is_connected": True},
        {"$set": {"is_connected": False, "disconnected_at": now, "orphan": True}},
    )
    await broadcast({"type": "connect", "addr": body.addr, "ip": body.ip})
    return {"ok": True}


@app.post("/api/internal/disconnect")
async def internal_disconnect(body: dict):
    addr = body.get("addr")
    if not addr:
        raise HTTPException(400, "addr requerido")
    await db.devices.update_one(
        {"addr": addr},
        {"$set": {"is_connected": False, "disconnected_at": _now()}},
    )
    await broadcast({"type": "disconnect", "addr": addr, "ip": body.get("ip")})
    return {"ok": True}


@app.post("/api/internal/telemetry")
async def internal_telemetry(body: TelemetryBody):
    now = body.ts or _now()
    doc = {
        "addr": body.addr,
        "ip": body.ip,
        "direction": body.direction,
        "text": body.text,
        "hex": body.hex,
        "encoding": body.encoding,
        "ts": now,
    }
    await db.messages.insert_one(doc)
    await db.devices.update_one(
        {"addr": body.addr},
        {
            "$set": {
                "ip": body.ip,
                "is_connected": True,
                "last_seen": now,
                "last_direction": body.direction,
            }
        },
        upsert=True,
    )
    # No enviar _id al WS
    event = {"type": "message", **{k: v for k, v in doc.items()}}
    await broadcast(event)
    return {"ok": True}


# ---------------------------------------------------------------------------
# API pública (frontend)
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/api/devices")
async def get_devices(connected_only: bool = True):
    """Lista dispositivos. Por defecto solo los conectados (sin huérfanos)."""
    # Preferir fuente viva del bridge; fallback a Mongo
    bridge_devices = []
    try:
        async with httpx.AsyncClient(timeout=3.0) as http:
            r = await http.get(f"{BRIDGE_URL}/devices")
            if r.status_code == 200:
                bridge_devices = r.json().get("devices", [])
    except Exception:
        pass

    if bridge_devices:
        # Sincronizar flags en Mongo con la realidad del bridge
        live_addrs = {d["addr"] for d in bridge_devices}
        await db.devices.update_many(
            {"addr": {"$nin": list(live_addrs)}, "is_connected": True},
            {"$set": {"is_connected": False, "disconnected_at": _now(), "orphan": True}},
        )
        return {"devices": bridge_devices, "source": "bridge"}

    q: dict[str, Any] = {"is_connected": True} if connected_only else {}
    cursor = db.devices.find(q, {"_id": 0}).sort("last_seen", -1)
    devices = await cursor.to_list(500)
    return {"devices": devices, "source": "mongo"}


@app.get("/api/messages")
async def get_messages(addr: str | None = None, ip: str | None = None, limit: int = 200):
    q: dict[str, Any] = {}
    if addr:
        q["addr"] = addr
    elif ip:
        q["ip"] = ip
    limit = max(1, min(limit, 1000))
    cursor = db.messages.find(q, {"_id": 0}).sort("ts", -1).limit(limit)
    rows = await cursor.to_list(limit)
    rows.reverse()
    return {"messages": rows}


@app.post("/api/send")
async def api_send(body: SendBody):
    if not body.addr and not body.ip:
        raise HTTPException(400, "addr o ip requerido")
    payload = body.model_dump(exclude_none=True)
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            r = await http.post(f"{BRIDGE_URL}/send", json=payload)
            data = r.json()
    except Exception as e:
        raise HTTPException(502, f"bridge no disponible: {e}") from e
    if not data.get("ok"):
        raise HTTPException(404, data.get("error", "send falló"))
    return data


@app.post("/api/sweep")
async def api_sweep():
    """Fuerza limpieza de IPs huérfanas en el bridge + DB."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            r = await http.post(f"{BRIDGE_URL}/sweep")
            bridge = r.json()
    except Exception as e:
        raise HTTPException(502, f"bridge no disponible: {e}") from e

    live = {d["addr"] for d in bridge.get("devices", [])}
    result = await db.devices.update_many(
        {"addr": {"$nin": list(live)}, "is_connected": True},
        {"$set": {"is_connected": False, "disconnected_at": _now(), "orphan": True}},
    )
    await broadcast({"type": "sweep", "removed_db": result.modified_count})
    return {
        "ok": True,
        "bridge_removed": bridge.get("removed", 0),
        "db_orphans_cleared": result.modified_count,
        "devices": bridge.get("devices", []),
    }


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    _ws_clients.add(ws)
    try:
        await ws.send_json({"type": "hello", "msg": "connected"})
        while True:
            # Mantener vivo; el cliente puede enviar pings
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _ws_clients.discard(ws)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
