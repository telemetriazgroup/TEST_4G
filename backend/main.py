"""
Backend REST + WebSocket para el monitor serial TCP (puerto 9910).

Persistencia:
- sessions  → sesión por IP (activa / histórica)
- messages  → cada trama RX/TX ligada a ip + session_id
- devices   → estado vivo por addr (ip:port)
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

import homologate as homo

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
log = logging.getLogger("test_4g")
_queue_lock = asyncio.Lock()
_queue: deque[dict[str, Any]] = deque()
_queue_wake = asyncio.Event()
_queue_state: dict[str, Any] = {
    "running": False,
    "paused": False,
    "sending": None,
    "last_sent_at": None,
    "sent": 0,
    "errors": 0,
    "enqueued": 0,
}


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


class HomologateEnqueueBody(BaseModel):
    hour: str | None = None
    date: str | None = None
    addr: str | None = None
    ip: str | None = None
    ids: list[str] | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BSON_INT_MIN = -(2**63)
BSON_INT_MAX = 2**63 - 1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bson_safe_int(value: Any) -> int | None:
    """MongoDB BSON solo admite int64 con signo (8 bytes)."""
    if value is None or isinstance(value, bool):
        return None if value is None else value
    if not isinstance(value, int):
        return None
    if BSON_INT_MIN <= value <= BSON_INT_MAX:
        return value
    return None


def _sanitize_for_mongo(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return _bson_safe_int(value)
    if isinstance(value, dict):
        return {k: _sanitize_for_mongo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_mongo(v) for v in value]
    return value


def _history_query(
    *,
    session_id: str | None = None,
    addr: str | None = None,
    ip: str | None = None,
    date: str | None = None,
) -> dict[str, Any]:
    q: dict[str, Any] = {}
    if session_id:
        q["session_id"] = session_id
    elif addr:
        q["addr"] = addr
    elif ip:
        q["ip"] = ip
    if date:
        try:
            start = datetime.fromisoformat(f"{date}T00:00:00+00:00")
        except ValueError as e:
            raise HTTPException(400, "date debe ser YYYY-MM-DD") from e
        end = start + timedelta(days=1)
        q["ts"] = {"$gte": start.isoformat(), "$lt": end.isoformat()}
    return q


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
    await db.homologate_log.create_index([("ts", -1)])
    await db.homologate_log.create_index([("payload_hash", 1), ("ts", -1)])
    await db.homologate_log.create_index([("status", 1), ("ts", -1)])
    await db.messages.create_index([("homologate_status", 1), ("ts", -1)])
    await db.homologate_queue.create_index([("status", 1), ("enqueued_at", 1)])
    await _restore_homologate_queue()
    asyncio.create_task(_homologate_queue_worker())


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
        "int_value": _bson_safe_int(body.int_value),
        "frame_len": _bson_safe_int(body.frame_len),
        "tcp_header": _sanitize_for_mongo(body.tcp_header) if body.tcp_header else None,
        "encoding": body.encoding,
        "ts": now,
    }
    try:
        inserted = await db.messages.insert_one(doc)
    except OverflowError:
        log.warning("int overflow en telemetry ip=%s; se guarda sin enteros grandes", body.ip)
        doc = _sanitize_for_mongo(doc)
        inserted = await db.messages.insert_one(doc)
    doc["_id"] = inserted.inserted_id

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

    asyncio.create_task(_homologate_after_persist(doc))

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
# Homologación POLLO → POST estándar (no bloquea el socket)
# ---------------------------------------------------------------------------

async def _mark_message(doc: dict[str, Any], fields: dict[str, Any]) -> None:
    mid = doc.get("_id")
    if not mid:
        return
    try:
        await db.messages.update_one({"_id": mid}, {"$set": fields})
    except Exception:
        log.exception("no se pudo marcar homologate_status")


async def _recent_duplicate(payload_hash: str, session_id: str | None) -> bool:
    window = homo.env_dedup_s()
    if window <= 0 or not payload_hash:
        return False
    since = (datetime.now(timezone.utc) - timedelta(seconds=window)).isoformat()
    q: dict[str, Any] = {
        "payload_hash": payload_hash,
        "status": "ok",
        "ts": {"$gte": since},
    }
    if session_id:
        q["session_id"] = session_id
    found = await db.homologate_log.find_one(q, {"_id": 1})
    return found is not None


async def _post_standard(payload: dict[str, Any]) -> tuple[int | None, str | None]:
    url = homo.env_url()
    last_err = None
    retries = homo.env_retries()
    timeout = homo.env_timeout()
    for attempt in range(1, retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as http:
                r = await http.post(url, json=payload)
            if 200 <= r.status_code < 300:
                return r.status_code, None
            last_err = f"http_{r.status_code}"
        except Exception as e:
            last_err = str(e)
        if attempt < retries:
            await asyncio.sleep(0.5 * attempt)
    return None, last_err


async def _homologate_after_persist(doc: dict[str, Any]) -> None:
    """Corre en background: persistencia ya ocurrió."""
    try:
        classified = homo.classify_frame(doc)
        status = classified["status"]
        reason = classified["reason"]

        if status == "skip":
            await _mark_message(doc, {"homologate_status": "skip", "homologate_reason": reason})
            return
        if status == "incomplete":
            await _mark_message(
                doc,
                {
                    "homologate_status": "incomplete",
                    "homologate_reason": reason,
                    "homologate_opcodes": classified.get("opcodes") or [],
                },
            )
            log.info(
                "homologate incompleta ip=%s opcodes=%s reason=%s",
                doc.get("ip"),
                classified.get("opcodes"),
                reason,
            )
            return

        payload = classified.get("payload")
        payload_hash = classified.get("payload_hash")
        if not payload:
            await _mark_message(doc, {"homologate_status": "skip", "homologate_reason": "no_payload"})
            return

        url = homo.env_url()
        if not homo.env_enabled() or not url:
            await _mark_message(
                doc,
                {
                    "homologate_status": "disabled",
                    "homologate_reason": "no_url" if not url else "disabled",
                    "homologate_opcodes": classified.get("opcodes") or [],
                    "homologate_i": payload.get("i"),
                },
            )
            return

        if await _recent_duplicate(payload_hash, doc.get("session_id")):
            await _mark_message(
                doc,
                {
                    "homologate_status": "skip",
                    "homologate_reason": "duplicate",
                    "homologate_hash": payload_hash,
                },
            )
            return

        await _mark_message(doc, {"homologate_status": "pending", "homologate_hash": payload_hash})
        http_status, err = await _post_standard(payload)
        now = _now()
        log_doc = {
            "ts": now,
            "i": payload.get("i"),
            "opcodes": classified.get("opcodes") or [],
            "host": homo.destination_host(url),
            "http_status": http_status,
            "error": err,
            "status": "ok" if http_status else "error",
            "payload_hash": payload_hash,
            "payload": payload,
            "hour": homo.hour_key(doc.get("ts")),
            "session_id": doc.get("session_id"),
            "addr": doc.get("addr"),
            "ip": doc.get("ip"),
            "message_ts": doc.get("ts"),
            "source": "live",
        }
        await db.homologate_log.insert_one(log_doc)
        if http_status:
            await _mark_message(
                doc,
                {
                    "homologate_status": "ok",
                    "homologate_reason": "sent",
                    "homologate_http": http_status,
                    "homologate_i": payload.get("i"),
                    "homologate_hash": payload_hash,
                },
            )
            log.info(
                "homologate ok i=%s host=%s http=%s ip=%s",
                payload.get("i"),
                log_doc["host"],
                http_status,
                doc.get("ip"),
            )
        else:
            await _mark_message(
                doc,
                {
                    "homologate_status": "error",
                    "homologate_reason": err or "post_failed",
                    "homologate_i": payload.get("i"),
                    "homologate_hash": payload_hash,
                },
            )
            log.warning(
                "homologate error i=%s host=%s err=%s ip=%s",
                payload.get("i"),
                log_doc["host"],
                err,
                doc.get("ip"),
            )
    except Exception:
        log.exception("homologate task falló")
        await _mark_message(doc, {"homologate_status": "error", "homologate_reason": "internal"})


def _candidate_from_doc(doc: dict[str, Any]) -> dict[str, Any] | None:
    classified = homo.classify_frame(doc)
    if classified["status"] != "ready" or not classified.get("payload"):
        return None
    return {
        "message_id": str(doc.get("_id") or ""),
        "ts": doc.get("ts"),
        "hour": homo.hour_key(doc.get("ts")),
        "addr": doc.get("addr"),
        "ip": doc.get("ip"),
        "session_id": doc.get("session_id"),
        "i": classified["payload"].get("i"),
        "opcodes": classified.get("opcodes") or [],
        "payload": classified["payload"],
        "payload_hash": classified.get("payload_hash"),
        "homologate_status": doc.get("homologate_status"),
    }


async def _scan_candidates(
    *,
    addr: str | None = None,
    ip: str | None = None,
    session_id: str | None = None,
    date: str | None = None,
    hour: str | None = None,
    limit: int = 5000,
) -> list[dict[str, Any]]:
    scan_date = date
    if hour and not scan_date and len(hour) >= 10:
        scan_date = hour[:10]
    q = _history_query(session_id=session_id, addr=addr, ip=ip, date=scan_date)
    q["direction"] = "rx"
    q["value_type"] = {"$ne": "tcp_header"}
    limit = max(1, min(limit, 10000))
    cursor = db.messages.find(q).sort("ts", 1).limit(limit)
    rows = await cursor.to_list(limit)
    out: list[dict[str, Any]] = []
    for doc in rows:
        item = _candidate_from_doc(doc)
        if not item:
            continue
        if hour and item["hour"] != hour:
            continue
        out.append(item)
    return out


def _queue_snapshot() -> dict[str, Any]:
    pending = [x for x in _queue if x.get("status") == "queued"]
    by_hour: dict[str, int] = {}
    for item in pending:
        hk = item.get("hour") or "?"
        by_hour[hk] = by_hour.get(hk, 0) + 1
    return {
        "configured": bool(homo.env_url()),
        "enabled": homo.env_enabled(),
        "host": homo.destination_host(),
        "interval_s": homo.env_queue_interval_s(),
        "running": _queue_state["running"],
        "paused": _queue_state["paused"],
        "pending": len(pending),
        "sending": _queue_state["sending"],
        "sent": _queue_state["sent"],
        "errors": _queue_state["errors"],
        "enqueued": _queue_state["enqueued"],
        "last_sent_at": _queue_state["last_sent_at"],
        "hours": by_hour,
    }


async def _restore_homologate_queue() -> None:
    try:
        rows = await db.homologate_queue.find({"status": "queued"}).sort("enqueued_at", 1).to_list(2000)
    except Exception:
        return
    for row in rows:
        item = {
            "queue_id": row.get("queue_id"),
            "message_id": row.get("message_id"),
            "hour": row.get("hour"),
            "payload": row.get("payload"),
            "payload_hash": row.get("payload_hash"),
            "i": row.get("i"),
            "status": "queued",
        }
        if item["queue_id"] and item.get("payload"):
            _queue.append(item)
    if _queue:
        _queue_wake.set()
        log.info("cola homologate restaurada: %s pendientes", len(_queue))


async def _enqueue_candidates(items: list[dict[str, Any]]) -> dict[str, Any]:
    added = 0
    skipped = 0
    async with _queue_lock:
        pending_hashes = {x.get("payload_hash") for x in _queue if x.get("status") == "queued"}
        if _queue_state.get("sending") and _queue_state["sending"].get("payload_hash"):
            pending_hashes.add(_queue_state["sending"]["payload_hash"])
        for item in items:
            ph = item.get("payload_hash")
            if not item.get("payload"):
                skipped += 1
                continue
            if ph and ph in pending_hashes:
                skipped += 1
                continue
            queue_id = str(uuid.uuid4())
            job = {
                "queue_id": queue_id,
                "message_id": item.get("message_id"),
                "hour": item.get("hour"),
                "payload": item["payload"],
                "payload_hash": ph,
                "i": item.get("i"),
                "addr": item.get("addr"),
                "ip": item.get("ip"),
                "status": "queued",
                "enqueued_at": _now(),
            }
            _queue.append(job)
            pending_hashes.add(ph)
            added += 1
            _queue_state["enqueued"] += 1
            try:
                await db.homologate_queue.insert_one(dict(job))
            except Exception:
                log.exception("no se persistió item de cola")
    if added:
        _queue_wake.set()
    return {"added": added, "skipped": skipped, "pending": sum(1 for x in _queue if x.get("status") == "queued")}


async def _homologate_queue_worker() -> None:
    _queue_state["running"] = True
    while True:
        try:
            if _queue_state["paused"] or not any(x.get("status") == "queued" for x in _queue):
                _queue_wake.clear()
                await _queue_wake.wait()
                continue
            async with _queue_lock:
                job = next((x for x in _queue if x.get("status") == "queued"), None)
                if job:
                    job["status"] = "sending"
                    _queue_state["sending"] = {
                        "i": job.get("i"),
                        "hour": job.get("hour"),
                        "payload_hash": job.get("payload_hash"),
                    }
            if not job:
                continue
            last = _queue_state.get("last_sent_at")
            gap = homo.env_queue_interval_s()
            if last and gap > 0:
                wait = gap - (time.monotonic() - last)
                if wait > 0:
                    await asyncio.sleep(wait)
            if not homo.env_enabled() or not homo.env_url():
                http_status, err = None, "no_url"
            else:
                http_status, err = await _post_standard(job["payload"])
            now = _now()
            ok = bool(http_status)
            log_doc = {
                "ts": now,
                "i": job.get("i"),
                "opcodes": list((job.get("payload") or {}).keys()),
                "host": homo.destination_host(),
                "http_status": http_status,
                "error": err,
                "status": "ok" if ok else "error",
                "payload_hash": job.get("payload_hash"),
                "payload": job.get("payload"),
                "hour": job.get("hour"),
                "message_id": job.get("message_id"),
                "addr": job.get("addr"),
                "ip": job.get("ip"),
                "source": "queue",
            }
            try:
                await db.homologate_log.insert_one(log_doc)
                await db.homologate_queue.update_one(
                    {"queue_id": job["queue_id"]},
                    {"$set": {"status": "ok" if ok else "error", "http_status": http_status, "error": err, "sent_at": now}},
                )
                if job.get("message_id"):
                    try:
                        mid = ObjectId(job["message_id"])
                        await db.messages.update_one(
                            {"_id": mid},
                            {
                                "$set": {
                                    "homologate_status": "ok" if ok else "error",
                                    "homologate_reason": "queue_sent" if ok else (err or "queue_error"),
                                    "homologate_http": http_status,
                                    "homologate_i": job.get("i"),
                                }
                            },
                        )
                    except Exception:
                        pass
            except Exception:
                log.exception("cola homologate: no se pudo auditar")
            async with _queue_lock:
                job["status"] = "ok" if ok else "error"
                try:
                    _queue.remove(job)
                except ValueError:
                    pass
                _queue_state["sending"] = None
                _queue_state["last_sent_at"] = time.monotonic()
                if ok:
                    _queue_state["sent"] += 1
                else:
                    _queue_state["errors"] += 1
            log.info(
                "cola homologate %s i=%s hour=%s pending=%s",
                "ok" if ok else f"error:{err}",
                job.get("i"),
                job.get("hour"),
                sum(1 for x in _queue if x.get("status") == "queued"),
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("cola homologate worker")
            await asyncio.sleep(1)


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    msgs = await db.messages.estimated_document_count()
    sessions = await db.sessions.count_documents({"is_active": True})
    return {
        "ok": True,
        "messages": msgs,
        "active_sessions": sessions,
        "homologate": {
            "enabled": homo.env_enabled() and bool(homo.env_url()),
            "host": homo.destination_host(),
        },
    }


@app.get("/api/homologate/status")
async def homologate_status(limit: int = 20):
    limit = max(1, min(limit, 100))
    cursor = db.homologate_log.find({}, {"_id": 0}).sort("ts", -1).limit(limit)
    logs = await cursor.to_list(limit)
    pending = await db.messages.count_documents({"homologate_status": "pending"})
    errors = await db.messages.count_documents({"homologate_status": "error"})
    return {
        "enabled": homo.env_enabled(),
        "configured": bool(homo.env_url()),
        "host": homo.destination_host(),
        "unit": homo.env_unit(),
        "pending": pending,
        "errors": errors,
        "recent": logs,
        "queue": _queue_snapshot(),
    }


@app.get("/api/homologate/sent")
async def homologate_sent(
    status: str | None = None,
    source: str | None = None,
    date: str | None = None,
    hour: str | None = None,
    ident: str | None = None,
    limit: int = 500,
):
    """Consulta tramas estándar enviadas (vivo + histórico) y su resultado POST."""
    q: dict[str, Any] = {}
    if status and status != "all":
        q["status"] = status
    if source and source != "all":
        q["source"] = source
    if ident:
        q["i"] = ident
    if hour:
        q["hour"] = hour
    elif date:
        q["hour"] = {"$regex": f"^{date}"}
    limit = max(1, min(limit, 2000))
    cursor = db.homologate_log.find(q, {"_id": 0}).sort("ts", -1).limit(limit)
    rows = await cursor.to_list(limit)
    pending = []
    for item in list(_queue):
        if item.get("status") not in {"queued", "sending"}:
            continue
        pending.append(
            {
                "ts": item.get("enqueued_at"),
                "i": item.get("i"),
                "status": item.get("status"),
                "source": "queue",
                "hour": item.get("hour"),
                "payload": item.get("payload"),
                "payload_hash": item.get("payload_hash"),
                "addr": item.get("addr"),
                "ip": item.get("ip"),
                "host": homo.destination_host(),
                "http_status": None,
                "error": None,
            }
        )
    ok = sum(1 for r in rows if r.get("status") == "ok")
    err = sum(1 for r in rows if r.get("status") == "error")
    return {
        "items": pending + rows,
        "count": len(pending) + len(rows),
        "pending": len(pending),
        "ok": ok,
        "errors": err,
        "configured": bool(homo.env_url()),
        "host": homo.destination_host(),
        "queue": _queue_snapshot(),
    }


@app.get("/api/homologate/candidates")
async def homologate_candidates(
    addr: str | None = None,
    ip: str | None = None,
    session_id: str | None = None,
    date: str | None = None,
    hour: str | None = None,
    limit: int = 5000,
):
    """Explora el histórico y lista tramas que se pueden homologar al JSON estándar."""
    items = await _scan_candidates(
        addr=addr, ip=ip, session_id=session_id, date=date, hour=hour, limit=limit
    )
    hours: dict[str, int] = {}
    for it in items:
        hk = it["hour"]
        hours[hk] = hours.get(hk, 0) + 1
    return {
        "count": len(items),
        "hours": [{"hour": k, "count": hours[k]} for k in sorted(hours.keys(), reverse=True)],
        "configured": bool(homo.env_url()),
        "enabled": homo.env_enabled(),
        "host": homo.destination_host(),
        "unit": homo.env_unit(),
        "interval_s": homo.env_queue_interval_s(),
        "items": items,
        "queue": _queue_snapshot(),
    }


@app.get("/api/homologate/queue")
async def homologate_queue_get():
    return _queue_snapshot()


@app.post("/api/homologate/enqueue")
async def homologate_enqueue(body: HomologateEnqueueBody):
    """Encola tramas homologables. Si ya hay un envío, se agregan al final (5 s entre POST)."""
    if not homo.env_enabled() or not homo.env_url():
        raise HTTPException(400, "HOMOLOGATE_URL no configurada")
    items: list[dict[str, Any]] = []
    if body.ids:
        oids = []
        for raw in body.ids:
            try:
                oids.append(ObjectId(raw))
            except Exception:
                continue
        if oids:
            cursor = db.messages.find({"_id": {"$in": oids}})
            rows = await cursor.to_list(len(oids))
            for doc in rows:
                item = _candidate_from_doc(doc)
                if item:
                    items.append(item)
    else:
        items = await _scan_candidates(
            addr=body.addr, ip=body.ip, date=body.date, hour=body.hour, limit=10000
        )
    if not items:
        return {"ok": True, "added": 0, "skipped": 0, "queue": _queue_snapshot(), "detail": "sin tramas homologables"}
    result = await _enqueue_candidates(items)
    result["ok"] = True
    result["queue"] = _queue_snapshot()
    return result


@app.post("/api/homologate/queue/clear")
async def homologate_queue_clear():
    """Quita pendientes que aún no se están enviando."""
    removed = 0
    async with _queue_lock:
        keep: deque[dict[str, Any]] = deque()
        ids = []
        for item in _queue:
            if item.get("status") == "queued":
                removed += 1
                if item.get("queue_id"):
                    ids.append(item["queue_id"])
            else:
                keep.append(item)
        _queue.clear()
        _queue.extend(keep)
    if ids:
        await db.homologate_queue.update_many(
            {"queue_id": {"$in": ids}},
            {"$set": {"status": "cancelled", "cancelled_at": _now()}},
        )
    return {"ok": True, "removed": removed, "queue": _queue_snapshot()}


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


@app.get("/api/history/days")
async def get_history_days(
    addr: str | None = None,
    ip: str | None = None,
    session_id: str | None = None,
    limit: int = 365,
):
    """Lista días con tramas guardadas (más recientes primero)."""
    q = _history_query(session_id=session_id, addr=addr, ip=ip)
    limit = max(1, min(limit, 1000))
    pipeline: list[dict[str, Any]] = [
        {"$match": q},
        {
            "$project": {
                "date": {"$substr": ["$ts", 0, 10]},
                "direction": 1,
            }
        },
        {
            "$group": {
                "_id": "$date",
                "count": {"$sum": 1},
                "rx": {"$sum": {"$cond": [{"$eq": ["$direction", "rx"]}, 1, 0]}},
                "tx": {"$sum": {"$cond": [{"$eq": ["$direction", "tx"]}, 1, 0]}},
            }
        },
        {"$sort": {"_id": -1}},
        {"$limit": limit},
    ]
    rows = await db.messages.aggregate(pipeline).to_list(limit)
    days = [
        {"date": r["_id"], "count": r["count"], "rx": r["rx"], "tx": r["tx"]}
        for r in rows
        if r.get("_id")
    ]
    return {"days": days, "count": len(days)}


@app.get("/api/history")
async def get_history(
    addr: str | None = None,
    ip: str | None = None,
    session_id: str | None = None,
    date: str | None = None,
    limit: int = 500,
    skip: int = 0,
):
    q = _history_query(session_id=session_id, addr=addr, ip=ip, date=date)
    max_limit = 10000 if date else 2000
    limit = max(1, min(limit, max_limit))
    skip = max(0, skip)
    total = await db.messages.count_documents(q)
    cursor = db.messages.find(q, {"_id": 0}).sort("ts", -1).skip(skip).limit(limit)
    rows = await cursor.to_list(limit)
    return {
        "messages": rows,
        "total": total,
        "skip": skip,
        "limit": limit,
        "date": date,
    }


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
