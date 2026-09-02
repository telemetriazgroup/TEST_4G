"""
Backend REST + WebSocket para el monitor serial TCP (puerto 9910).

Persistencia:
- sessions  → sesión por IP (activa / histórica)
- messages  → cada trama RX/TX ligada a ip + session_id
- devices   → estado vivo por addr (ip:port)
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

MONGO_URL = os.getenv("MONGO_URL", "mongodb://mongo:27017")
MONGO_DB = os.getenv("MONGO_DB", "test_4g")
BRIDGE_URL = os.getenv("BRIDGE_URL", "http://tcp_bridge:8081").rstrip("/")

app = FastAPI(title="TEST_4G Backend", version="1.1.0")
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
    encoding: str = Field(default="hex", description="string | hex | int")
    addr: str | None = None
    ip: str | None = None


class TelemetryBody(BaseModel):
    addr: str
    ip: str
    direction: str = "rx"
    text: str = ""
    hex: str = ""
    decimal: str | None = None
    value_type: str = "hex"
    int_value: int | None = None
    frame_len: int | None = None
    tcp_header: dict[str, Any] | None = None
    encoding: str | None = None
    session_id: str | None = None
    ts: str | None = None


class ConnectBody(BaseModel):
    addr: str
    ip: str
    imei: str | None = None
    tcp_header: dict[str, Any] | None = None
    session_id: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _jsonable(doc: dict[str, Any]) -> dict[str, Any]:
    """Quita ObjectId y deja el doc serializable para WS/JSON."""
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        if isinstance(v, ObjectId):
            continue
        out[k] = v
    return out


async def broadcast(event: dict[str, Any]) -> None:
    dead: list[WebSocket] = []
    for ws in list(_ws_clients):
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.discard(ws)


async def ensure_session(ip: str, addr: str, tcp_header: dict | None = None, session_id: str | None = None) -> str:
    """
    Obtiene o crea sesión activa por IP.
    Si la IP reconecta con otro puerto, cierra la sesión previa y abre una nueva.
    """
    now = _now()
    active = await db.sessions.find_one({"ip": ip, "is_active": True})
    if active:
        sid = active["session_id"]
        # Misma IP: actualizar addr actual (puede cambiar el puerto)
        await db.sessions.update_one(
            {"session_id": sid},
            {
                "$set": {
                    "addr": addr,
                    "last_seen": now,
                    "tcp_header": tcp_header or active.get("tcp_header"),
                },
                "$addToSet": {"addrs": addr},
            },
        )
        return sid

    sid = session_id or str(uuid.uuid4())
    doc = {
        "session_id": sid,
        "ip": ip,
        "addr": addr,
        "addrs": [addr],
        "is_active": True,
        "started_at": now,
        "last_seen": now,
        "ended_at": None,
        "rx_count": 0,
        "tx_count": 0,
        "tcp_header": tcp_header,
        "imei": None,
    }
    await db.sessions.insert_one(doc)
    return sid


async def close_session_by_addr(addr: str) -> None:
    now = _now()
    await db.sessions.update_many(
        {"addr": addr, "is_active": True},
        {"$set": {"is_active": False, "ended_at": now, "last_seen": now}},
    )
    # También por addrs[] por si el addr cambió
    await db.sessions.update_many(
        {"addrs": addr, "is_active": True},
        {"$set": {"is_active": False, "ended_at": now, "last_seen": now}},
    )


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup() -> None:
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[MONGO_DB]
    await db.messages.create_index([("ts", -1)])
    await db.messages.create_index([("ip", 1), ("ts", -1)])
    await db.messages.create_index([("addr", 1), ("ts", -1)])
    await db.messages.create_index([("session_id", 1), ("ts", -1)])
    await db.messages.create_index([("direction", 1), ("ts", -1)])
    await db.devices.create_index("addr", unique=True)
    await db.devices.create_index("ip")
    await db.sessions.create_index([("ip", 1), ("started_at", -1)])
    await db.sessions.create_index([("session_id", 1)], unique=True)
    await db.sessions.create_index([("is_active", 1), ("ip", 1)])


@app.on_event("shutdown")
async def shutdown() -> None:
    if client:
        client.close()


# ---------------------------------------------------------------------------
# Interno (tcp_bridge)
# ---------------------------------------------------------------------------

@app.post("/api/internal/disconnect_all")
async def disconnect_all():
    now = _now()
    result = await db.devices.update_many(
        {"is_connected": True},
        {"$set": {"is_connected": False, "disconnected_at": now}},
    )
    await db.sessions.update_many(
        {"is_active": True},
        {"$set": {"is_active": False, "ended_at": now, "last_seen": now}},
    )
    await broadcast({"type": "disconnect_all"})
    return {"ok": True, "modified": result.modified_count}


@app.post("/api/internal/connect")
async def internal_connect(body: ConnectBody):
    now = _now()
    session_id = await ensure_session(body.ip, body.addr, body.tcp_header, body.session_id)

    set_doc: dict[str, Any] = {
        "addr": body.addr,
        "ip": body.ip,
        "imei": body.imei,
        "is_connected": True,
        "connected_at": now,
        "last_seen": now,
        "session_id": session_id,
    }
    if body.tcp_header:
        set_doc["tcp_header"] = body.tcp_header
    await db.devices.update_one(
        {"addr": body.addr},
        {"$set": set_doc, "$unset": {"disconnected_at": ""}},
        upsert=True,
    )
    # Otras conexiones de la misma IP quedan huérfanas en devices
    await db.devices.update_many(
        {"ip": body.ip, "addr": {"$ne": body.addr}, "is_connected": True},
        {"$set": {"is_connected": False, "disconnected_at": now, "orphan": True}},
    )
    if body.imei:
        await db.sessions.update_one(
            {"session_id": session_id},
            {"$set": {"imei": body.imei}},
        )

    await broadcast(
        {
            "type": "connect",
            "addr": body.addr,
            "ip": body.ip,
            "session_id": session_id,
            "tcp_header": body.tcp_header,
        }
    )
    return {"ok": True, "session_id": session_id}


@app.post("/api/internal/disconnect")
async def internal_disconnect(body: dict):
    addr = body.get("addr")
    if not addr:
        raise HTTPException(400, "addr requerido")
    now = _now()
    await db.devices.update_one(
        {"addr": addr},
        {"$set": {"is_connected": False, "disconnected_at": now}},
    )
    await close_session_by_addr(addr)
    await broadcast({"type": "disconnect", "addr": addr, "ip": body.get("ip")})
    return {"ok": True}


@app.post("/api/internal/telemetry")
async def internal_telemetry(body: TelemetryBody):
    """Persiste SIEMPRE cada trama RX/TX en MongoDB, ligada a sesión por IP."""
    now = body.ts or _now()
    value_type = (body.value_type or body.encoding or "hex").lower()
    if value_type in ("hexadecimal",):
        value_type = "hex"

    session_id = body.session_id
    if not session_id:
        session_id = await ensure_session(body.ip, body.addr, body.tcp_header)

    doc = {
        "addr": body.addr,
        "ip": body.ip,
        "session_id": session_id,
        "direction": body.direction,
        "text": body.text,
        "hex": body.hex,
        "decimal": body.decimal,
        "value_type": value_type,
        "int_value": body.int_value,
        "frame_len": body.frame_len,
        "tcp_header": body.tcp_header,
        "encoding": body.encoding,
        "ts": now,
    }
    await db.messages.insert_one(doc)

    # Contadores de sesión
    inc = {"rx_count": 1} if body.direction == "rx" else {"tx_count": 1}
    if value_type == "tcp_header":
        inc = {}
    update_session: dict[str, Any] = {
        "$set": {"last_seen": now, "addr": body.addr, "is_active": True},
        "$addToSet": {"addrs": body.addr},
    }
    if inc:
        update_session["$inc"] = inc
    await db.sessions.update_one({"session_id": session_id}, update_session, upsert=False)

    device_set: dict[str, Any] = {
        "ip": body.ip,
        "is_connected": True,
        "last_seen": now,
        "last_direction": body.direction,
        "last_value_type": value_type,
        "last_hex": body.hex,
        "last_decimal": body.decimal,
        "session_id": session_id,
    }
    if body.tcp_header:
        device_set["tcp_header"] = body.tcp_header
    await db.devices.update_one(
        {"addr": body.addr},
        {"$set": device_set},
        upsert=True,
    )

    await broadcast({"type": "message", **_jsonable(doc)})
    return {"ok": True, "session_id": session_id}


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    msgs = await db.messages.estimated_document_count()
    sessions = await db.sessions.count_documents({"is_active": True})
    return {"ok": True, "messages": msgs, "active_sessions": sessions}


@app.get("/api/devices")
async def get_devices(connected_only: bool = True):
    bridge_devices = []
    try:
        async with httpx.AsyncClient(timeout=3.0) as http:
            r = await http.get(f"{BRIDGE_URL}/devices")
            if r.status_code == 200:
                bridge_devices = r.json().get("devices", [])
    except Exception:
        pass

    if bridge_devices:
        live_addrs = {d["addr"] for d in bridge_devices}
        await db.devices.update_many(
            {"addr": {"$nin": list(live_addrs)}, "is_connected": True},
            {"$set": {"is_connected": False, "disconnected_at": _now(), "orphan": True}},
        )
        # Enriquecer con session_id desde Mongo
        for d in bridge_devices:
            sess = await db.sessions.find_one(
                {"ip": d.get("ip"), "is_active": True},
                {"_id": 0, "session_id": 1, "rx_count": 1, "tx_count": 1},
            )
            if sess:
                d["session_id"] = sess.get("session_id")
                d["rx_count"] = sess.get("rx_count", 0)
                d["tx_count"] = sess.get("tx_count", 0)
        return {"devices": bridge_devices, "source": "bridge"}

    q: dict[str, Any] = {"is_connected": True} if connected_only else {}
    cursor = db.devices.find(q, {"_id": 0}).sort("last_seen", -1)
    devices = await cursor.to_list(500)
    return {"devices": devices, "source": "mongo"}


@app.get("/api/sessions")
async def list_sessions(ip: str | None = None, active_only: bool = False, limit: int = 100):
    """Lista sesiones por IP (activas e históricas)."""
    q: dict[str, Any] = {}
    if ip:
        q["ip"] = ip
    if active_only:
        q["is_active"] = True
    limit = max(1, min(limit, 500))
    cursor = db.sessions.find(q, {"_id": 0}).sort("started_at", -1).limit(limit)
    rows = await cursor.to_list(limit)
    return {"sessions": rows, "count": len(rows)}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str, limit: int = 200):
    """Detalle de una sesión + sus mensajes RX/TX."""
    sess = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not sess:
        raise HTTPException(404, "sesión no encontrada")
    limit = max(1, min(limit, 2000))
    cursor = db.messages.find({"session_id": session_id}, {"_id": 0}).sort("ts", -1).limit(limit)
    msgs = await cursor.to_list(limit)
    msgs.reverse()
    return {"session": sess, "messages": msgs, "count": len(msgs)}


@app.get("/api/messages")
async def get_messages(
    addr: str | None = None,
    ip: str | None = None,
    session_id: str | None = None,
    limit: int = 200,
    value_type: str | None = None,
    direction: str | None = None,
    exclude_headers: bool = False,
):
    q: dict[str, Any] = {}
    if session_id:
        q["session_id"] = session_id
    elif addr:
        q["addr"] = addr
    elif ip:
        q["ip"] = ip
    if value_type:
        q["value_type"] = value_type
    if direction:
        q["direction"] = direction
    if exclude_headers:
        q["value_type"] = {"$ne": "tcp_header"}
    limit = max(1, min(limit, 2000))
    cursor = db.messages.find(q, {"_id": 0}).sort("ts", -1).limit(limit)
    rows = await cursor.to_list(limit)
    rows.reverse()
    return {"messages": rows, "count": len(rows)}


@app.get("/api/history")
async def get_history(
    addr: str | None = None,
    ip: str | None = None,
    session_id: str | None = None,
    limit: int = 500,
    skip: int = 0,
):
    q: dict[str, Any] = {}
    if session_id:
        q["session_id"] = session_id
    elif addr:
        q["addr"] = addr
    elif ip:
        q["ip"] = ip
    limit = max(1, min(limit, 2000))
    skip = max(0, skip)
    total = await db.messages.count_documents(q)
    cursor = db.messages.find(q, {"_id": 0}).sort("ts", -1).skip(skip).limit(limit)
    rows = await cursor.to_list(limit)
    return {"messages": rows, "total": total, "skip": skip, "limit": limit}


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
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            r = await http.post(f"{BRIDGE_URL}/sweep")
            bridge = r.json()
    except Exception as e:
        raise HTTPException(502, f"bridge no disponible: {e}") from e

    live = {d["addr"] for d in bridge.get("devices", [])}
    now = _now()
    result = await db.devices.update_many(
        {"addr": {"$nin": list(live)}, "is_connected": True},
        {"$set": {"is_connected": False, "disconnected_at": now, "orphan": True}},
    )
    # Cerrar sesiones activas sin conexiones vivas de su IP
    live_ips = {d.get("ip") for d in bridge.get("devices", []) if d.get("ip")}
    await db.sessions.update_many(
        {"is_active": True, "ip": {"$nin": list(live_ips)}},
        {"$set": {"is_active": False, "ended_at": now, "last_seen": now}},
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
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _ws_clients.discard(ws)
