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

import client_api as capi
import comandos as cmdb
import decode_rs
import decode_tk
import homologate as homo
import reglas as regl

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
_decode_q: deque[dict[str, Any]] = deque()
_decode_wake = asyncio.Event()
_cmd_win: dict[str, dict[str, Any]] = {}
_cmd_lock = asyncio.Lock()
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


class RelayLabelsBody(BaseModel):
    ident: str
    names: dict[str, str] = Field(default_factory=dict)


class ComandoBody(BaseModel):
    ident: str = "POLLO_BEBE"
    addr: str | None = None
    ip: str | None = None
    session_id: str | None = None
    kind: str = "mp5000_write"
    idx: int | None = None
    value: Any = None
    fp: int | None = None
    bits: str | None = None
    pot: int | None = None
    hex: str | None = None
    reglas: list[dict[str, Any]] | None = None
    modo: str = "DEC"
    label: str | None = None
    window: str = "any"


class ClientLoginBody(BaseModel):
    username: str
    password: str


class ClientSetpointsBody(BaseModel):
    ident: str = "POLLO_BEBE"
    temperature_c: float | None = None
    humidity_pct: float | None = None
    co2_pct: float | None = None


CLIENT_USERS = {
    "superadmin": {"password": "superadmin", "role": "superadmin", "name": "Superadmin"},
    "admin": {"password": "admin", "role": "admin", "name": "Administrador"},
    "monitor": {"password": "monitor", "role": "monitor", "name": "Monitoreo"},
    "demo": {"password": "demo", "role": "admin", "name": "Demo"},
}


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
    await db.seguimiento.create_index([("date", 1), ("ts", -1)])
    await db.seguimiento.create_index([("hour", 1), ("ts", -1)])
    await db.seguimiento.create_index([("kind", 1), ("date", 1), ("ts", -1)])
    await db.seguimiento.create_index([("i", 1), ("date", 1), ("ts", -1)])
    await db.seguimiento.create_index([("ip", 1), ("date", 1), ("ts", -1)])
    try:
        await db.seguimiento.drop_index("message_id_1")
    except Exception:
        pass
    await db.seguimiento.create_index([("message_id", 1), ("kind", 1)], unique=True, sparse=True)
    await db.relay_labels.create_index("ident", unique=True)
    await db.comandos.create_index([("status", 1), ("enqueued_at", 1)])
    await db.comandos.create_index([("addr", 1), ("status", 1)])
    await db.comandos.create_index([("ip", 1), ("enqueued_at", -1)])
    await db.comandos.create_index([("enqueued_at", -1)])
    await _restore_homologate_queue()
    asyncio.create_task(_homologate_queue_worker())
    asyncio.create_task(_seguimiento_worker())
    asyncio.create_task(_backfill_seguimiento())
    asyncio.create_task(_comandos_janitor())


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
    _enqueue_seguimiento(doc)
    asyncio.create_task(_comandos_on_rx(doc))

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


def _looks_decodable(doc: dict[str, Any]) -> bool:
    if (doc.get("direction") or "rx").lower() != "rx":
        return False
    if (doc.get("value_type") or "") == "tcp_header":
        return False
    text = str(doc.get("text") or "")
    upper = text.upper()
    return "82A7" in upper or '"D0' in upper or decode_rs.looks_rs_text(text)


def _decode_job_from_doc(doc: dict[str, Any]) -> dict[str, Any]:
    mid = doc.get("_id")
    return {
        "message_id": str(mid) if mid else None,
        "ts": doc.get("ts"),
        "text": doc.get("text"),
        "addr": doc.get("addr"),
        "ip": doc.get("ip"),
        "session_id": doc.get("session_id"),
        "enqueued_at": _now(),
    }


def _enqueue_seguimiento(doc: dict[str, Any]) -> None:
    """Encola decodificación. Independiente del POST de homologación."""
    if not _looks_decodable(doc):
        return
    _decode_q.append(_decode_job_from_doc(doc))
    _decode_wake.set()


async def _relay_names_for(ident: str | None) -> dict[int, str]:
    if not ident:
        return dict(decode_rs.DEFAULT_RELAY_NAMES)
    doc = await db.relay_labels.find_one({"ident": ident}, {"_id": 0, "names": 1})
    return decode_rs.merge_relay_names((doc or {}).get("names"))


def _decode_tracking(text: str, *, ts: str | None, relay_names: dict[Any, Any] | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    unit = decode_tk.decode_unit_status(text, ts=ts)
    if unit:
        unit["kind"] = "mp5000"
        rows.append(unit)
    rows.extend(decode_rs.decode_rs_text(text, relay_names=relay_names, ts=ts))
    return rows


def _row_from_decoded(job: dict[str, Any], decoded: dict[str, Any]) -> dict[str, Any]:
    ts = job.get("ts") or decoded.get("ts")
    kind = decoded.get("kind") or "mp5000"
    snap = decoded.get("snapshot") or {}
    row: dict[str, Any] = {
        "ts": ts,
        "decoded_at": _now(),
        "date": homo.date_key(ts),
        "hour": homo.hour_key(ts),
        "kind": kind,
        "source": decoded.get("source") or kind,
        "i": decoded.get("i"),
        "addr": job.get("addr"),
        "ip": job.get("ip"),
        "session_id": job.get("session_id"),
        "message_id": job.get("message_id"),
        "snapshot": snap,
    }
    if kind == "mp5000":
        row.update(
            {
                "container_id": snap.get("container_id"),
                "opcodes": decoded.get("opcodes") or [],
                "crc_all_ok": decoded.get("crc_all_ok"),
                "sensors": decoded.get("sensors"),
                "control": decoded.get("control"),
                "io": decoded.get("io"),
                "caption": decoded.get("caption"),
                "alarms": decoded.get("alarms"),
            }
        )
    elif kind == "info":
        row.update({"screen": decoded.get("screen"), "field_count": decoded.get("field_count")})
    elif kind == "relay":
        row.update(
            {
                "node": decoded.get("node"),
                "relays": decoded.get("relays"),
                "analogs": decoded.get("analogs"),
                "humidity_pct": decoded.get("humidity_pct"),
                "humidity_setpoint_pct": decoded.get("humidity_setpoint_pct"),
            }
        )
    return _sanitize_for_mongo(row)


async def _save_seguimiento(job: dict[str, Any], *, notify: bool = True) -> dict[str, Any] | None:
    text = job.get("text") or ""
    ident = None
    objs = homo.split_json_objects(text)
    if objs:
        ident = str(objs[0].get("i") or "") or None
    names = await _relay_names_for(ident)
    decoded_rows = _decode_tracking(text, ts=job.get("ts"), relay_names=names)
    if not decoded_rows:
        return None
    mid = job.get("message_id")
    last = None
    saved = 0
    for decoded in decoded_rows:
        kind = decoded.get("kind") or "mp5000"
        if mid:
            exists = await db.seguimiento.find_one({"message_id": mid, "kind": kind}, {"_id": 1})
            if exists:
                continue
        row = _row_from_decoded(job, decoded)
        try:
            await db.seguimiento.insert_one(row)
        except Exception as e:
            if "E11000" in str(e) or "duplicate" in str(e).lower():
                continue
            raise
        last = row
        saved += 1
        if notify:
            await broadcast({"type": "seguimiento", **_jsonable(row)})
    if mid and saved:
        try:
            await db.messages.update_one(
                {"_id": ObjectId(mid)},
                {"$set": {"seguimiento": True, "seguimiento_date": last.get("date") if last else None}},
            )
        except Exception:
            log.exception("no se pudo marcar mensaje seguimiento")
    return last


async def _seguimiento_worker() -> None:
    """Proceso aparte del POST: decodifica y persiste datos de seguimiento."""
    while True:
        try:
            if not _decode_q:
                _decode_wake.clear()
                await _decode_wake.wait()
                continue
            job = _decode_q.popleft()
            await _save_seguimiento(job)
        except Exception:
            log.exception("seguimiento worker")
            await asyncio.sleep(0.2)


async def _backfill_seguimiento(limit: int = 2000) -> int:
    """Decodifica tramas RX ya guardadas que aún no están en seguimiento."""
    try:
        q = {
            "direction": "rx",
            "value_type": {"$ne": "tcp_header"},
            "seguimiento": {"$ne": True},
        }
        rows = await db.messages.find(q).sort("ts", -1).limit(limit).to_list(limit)
        n = 0
        for doc in reversed(rows):
            if not _looks_decodable(doc):
                continue
            try:
                if await _save_seguimiento(_decode_job_from_doc(doc), notify=False):
                    n += 1
            except Exception:
                log.exception("backfill seguimiento doc=%s", doc.get("_id"))
        if n:
            log.info("seguimiento backfill: %s decodificados", n)
        return n
    except Exception:
        log.exception("backfill seguimiento falló")
        return 0


# ---------------------------------------------------------------------------
# Comandos (ventanas TX + cola + registro)
# ---------------------------------------------------------------------------

def _cmd_ttl_cutoff() -> str:
    return (datetime.now(timezone.utc) - timedelta(seconds=cmdb.COMMAND_TTL_S)).isoformat()


async def _session_online(
    *, addr: str | None = None, ip: str | None = None, session_id: str | None = None
) -> dict[str, Any] | None:
    if session_id:
        found = await db.sessions.find_one({"session_id": session_id, "is_active": True})
        if found:
            return found
    if addr:
        found = await db.sessions.find_one({"addr": addr, "is_active": True})
        if found:
            return found
        found = await db.sessions.find_one({"addrs": addr, "is_active": True})
        if found:
            return found
    if ip:
        return await db.sessions.find_one({"ip": ip, "is_active": True}, sort=[("last_seen", -1)])
    return None


async def _is_online(addr: str | None, ip: str | None, session_id: str | None) -> tuple[bool, dict[str, Any] | None]:
    sess = await _session_online(addr=addr, ip=ip, session_id=session_id)
    if not sess:
        return False, None
    if addr:
        dev = await db.devices.find_one({"addr": addr}, {"is_connected": 1})
        if dev is not None and not dev.get("is_connected"):
            return False, sess
    return True, sess


def _window_open_for(addr: str | None, ip: str | None) -> dict[str, Any] | None:
    now = time.monotonic()
    if addr:
        w = _cmd_win.get(addr)
        if w and w.get("open") and float(w.get("until") or 0) > now:
            return w
    if ip:
        for w in _cmd_win.values():
            if w.get("ip") == ip and w.get("open") and float(w.get("until") or 0) > now:
                return w
    return None


def _built_comando(body: ComandoBody) -> dict[str, Any]:
    ident = (body.ident or cmdb.IDENT_DEFAULT).strip() or cmdb.IDENT_DEFAULT
    kind = (body.kind or "mp5000_write").strip()
    if kind == "mp5000_write":
        if body.idx is None:
            raise HTTPException(400, "idx requerido")
        return cmdb.build_mp5000(int(body.idx), body.value, body.fp, ident)
    if kind == "relay_set":
        if not body.bits:
            raise HTTPException(400, "bits requerido (10 dígitos 0/1)")
        return cmdb.build_relay(body.bits, ident)
    if kind == "relay_pot":
        if body.pot is None:
            raise HTTPException(400, "pot requerido (0..1000)")
        return cmdb.build_pot(int(body.pot), ident)
    if kind == "pantalla_cmd":
        if body.reglas:
            built = regl.build_program(body.reglas, ident=ident, modo=body.modo or "DEC")
        elif body.hex:
            hx = "".join(str(body.hex).split()).upper()
            if not hx or len(hx) % 2:
                raise HTTPException(400, "hex de programa inválido")
            rs = regl.PREFIJO + hx
            payload = {"i": ident, "rs": rs}
            built = {
                "kind": "pantalla_cmd",
                "i": ident,
                "rs": rs,
                "payload": payload,
                "hex": hx,
                "line": cmdb.encode_line(payload),
                "label": body.label or "PANTALLA_CMD",
                "timed": True,
                "ok": True,
                "errors": [],
            }
        else:
            raise HTTPException(400, "reglas o hex requerido")
        if not built.get("ok", True):
            raise HTTPException(400, "; ".join(built.get("errors") or ["programa inválido"]))
        if body.label:
            built["label"] = body.label
        return built
    raise HTTPException(400, "kind no soportado")


async def _expire_comandos() -> int:
    cutoff = _cmd_ttl_cutoff()
    q = {
        "status": {"$in": ["queued", "window_wait", "reference"]},
        "enqueued_at": {"$lt": cutoff},
    }
    rows = await db.comandos.find(q).to_list(500)
    now = _now()
    n = 0
    for row in rows:
        await db.comandos.update_one(
            {"_id": row["_id"]},
            {"$set": {"status": "canceled", "reason": "expired_2h", "canceled_at": now}},
        )
        n += 1
    if n:
        log.info("comandos: %s cancelados por TTL 2h", n)
        await broadcast({"type": "comando", "action": "expired", "count": n})
    return n


async def _comandos_janitor() -> None:
    while True:
        try:
            await _expire_comandos()
        except Exception:
            log.exception("comandos janitor")
        await asyncio.sleep(30)


async def _comandos_on_rx(doc: dict[str, Any]) -> None:
    try:
        if (doc.get("direction") or "rx").lower() != "rx":
            return
        action = cmdb.classify_window(doc.get("text") or "")
        if not action:
            return
        addr = doc.get("addr") or ""
        if action == "close":
            prev = _cmd_win.get(addr) or {}
            _cmd_win[addr] = {
                "open": False,
                "name": None,
                "until": 0,
                "ip": doc.get("ip"),
                "session_id": doc.get("session_id"),
            }
            if prev.get("open"):
                await broadcast({"type": "comando", "action": "window_close", "addr": addr})
            return
        _cmd_win[addr] = {
            "open": True,
            "name": action,
            "until": time.monotonic() + cmdb.TX_BUDGET_S,
            "ip": doc.get("ip"),
            "session_id": doc.get("session_id"),
            "opened_at": _now(),
        }
        await broadcast({"type": "comando", "action": "window_open", "window": action, "addr": addr})
        await _try_send_one_comando(addr=addr, ip=doc.get("ip"), window=action)
    except Exception:
        log.exception("comandos on_rx")


async def _bridge_send_line(addr: str | None, ip: str | None, line: str) -> dict[str, Any]:
    payload: dict[str, Any] = {"message": line, "encoding": "string"}
    if addr:
        payload["addr"] = addr
    if ip:
        payload["ip"] = ip
    async with httpx.AsyncClient(timeout=5.0) as http:
        r = await http.post(f"{BRIDGE_URL}/send", json=payload)
        return r.json()


async def _try_send_one_comando(*, addr: str | None, ip: str | None, window: str) -> dict[str, Any] | None:
    async with _cmd_lock:
        await _expire_comandos()
        online, sess = await _is_online(addr, ip, None)
        if not online:
            return None
        q: dict[str, Any] = {"status": {"$in": ["queued", "window_wait"]}}
        if addr:
            q["$or"] = [{"addr": addr}, {"ip": ip}] if ip else [{"addr": addr}]
        elif ip:
            q["ip"] = ip
        else:
            return None
        job = await db.comandos.find_one(q, sort=[("enqueued_at", 1)])
        if not job:
            return None
        win = _window_open_for(addr, ip)
        if not win:
            await db.comandos.update_one({"_id": job["_id"]}, {"$set": {"status": "window_wait"}})
            return None
        line = cmdb.encode_line(job.get("payload") or {"i": job.get("i"), "rs": job.get("rs")})
        try:
            result = await _bridge_send_line(job.get("addr") or addr, job.get("ip") or ip, line)
        except Exception as e:
            await db.comandos.update_one(
                {"_id": job["_id"]},
                {"$set": {"status": "error", "reason": str(e), "sent_at": _now()}},
            )
            await broadcast({"type": "comando", "action": "error", "id": str(job.get("queue_id") or job["_id"])})
            return None
        ok = bool(result.get("ok"))
        now = _now()
        await db.comandos.update_one(
            {"_id": job["_id"]},
            {
                "$set": {
                    "status": "sent" if ok else "error",
                    "reason": None if ok else (result.get("error") or "send_failed"),
                    "sent_at": now,
                    "window_used": win.get("name") or window,
                    "http": result,
                    "session_id": job.get("session_id") or (sess or {}).get("session_id"),
                }
            },
        )
        snap = await db.comandos.find_one({"_id": job["_id"]}, {"_id": 0})
        await broadcast({"type": "comando", "action": "sent" if ok else "error", **(snap or {})})
        log.info("comando %s i=%s rs=%s win=%s", "ok" if ok else "error", job.get("i"), job.get("rs"), win.get("name"))
        return snap


async def _latest_by_kind(ident: str | None, ip: str | None) -> dict[str, Any]:
    q: dict[str, Any] = {}
    if ident:
        q["i"] = ident
    if ip:
        q["ip"] = ip
    out: dict[str, Any] = {}
    for kind in ("info", "relay", "mp5000"):
        row = await db.seguimiento.find_one({**q, "kind": kind}, {"_id": 0}, sort=[("ts", -1)])
        if row:
            out[kind] = row
    return out


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


def _seguimiento_query(
    *,
    ident: str | None = None,
    ip: str | None = None,
    date: str | None = None,
    hour: str | None = None,
    kind: str | None = None,
) -> dict[str, Any]:
    q: dict[str, Any] = {}
    if ident:
        q["i"] = ident
    if ip:
        q["ip"] = ip
    if hour:
        q["hour"] = hour
    elif date:
        q["date"] = date
    if kind and kind != "all":
        q["kind"] = kind
    return q


@app.get("/api/seguimiento/days")
async def seguimiento_days(ident: str | None = None, ip: str | None = None, limit: int = 365):
    q = _seguimiento_query(ident=ident, ip=ip)
    limit = max(1, min(limit, 1000))
    pipeline: list[dict[str, Any]] = [
        {"$match": q},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": limit},
    ]
    rows = await db.seguimiento.aggregate(pipeline).to_list(limit)
    days = [{"date": r["_id"], "count": r["count"]} for r in rows if r.get("_id")]
    return {"days": days, "count": len(days)}


@app.get("/api/seguimiento")
async def list_seguimiento(
    date: str | None = None,
    hour: str | None = None,
    ident: str | None = None,
    ip: str | None = None,
    kind: str | None = None,
    limit: int = 500,
):
    q = _seguimiento_query(ident=ident, ip=ip, date=date, hour=hour, kind=kind)
    limit = max(1, min(limit, 2000))
    cursor = db.seguimiento.find(q, {"_id": 0}).sort("ts", -1).limit(limit)
    rows = await cursor.to_list(limit)
    hours: dict[str, int] = {}
    latest_by_kind: dict[str, Any] = {}
    for r in rows:
        hk = r.get("hour") or "desconocida"
        hours[hk] = hours.get(hk, 0) + 1
        k = r.get("kind") or "mp5000"
        latest_by_kind.setdefault(k, r)
    return {
        "date": date,
        "hour": hour,
        "kind": kind,
        "latest": rows[0] if rows else None,
        "latest_by_kind": latest_by_kind,
        "items": rows,
        "hours": [{"hour": k, "count": hours[k]} for k in sorted(hours.keys(), reverse=True)],
        "count": len(rows),
    }


@app.get("/api/relay-labels")
async def get_relay_labels(ident: str = "POLLO_BEBE"):
    names = await _relay_names_for(ident)
    stored = await db.relay_labels.find_one({"ident": ident}, {"_id": 0})
    return {
        "ident": ident,
        "names": {str(k): names[k] for k in range(1, 11)},
        "defaults": {str(k): v for k, v in decode_rs.DEFAULT_RELAY_NAMES.items()},
        "custom": bool(stored),
    }


@app.put("/api/relay-labels")
async def put_relay_labels(body: RelayLabelsBody):
    ident = (body.ident or "").strip()
    if not ident:
        raise HTTPException(400, "ident requerido")
    names = decode_rs.merge_relay_names(body.names)
    await db.relay_labels.update_one(
        {"ident": ident},
        {"$set": {"ident": ident, "names": {str(k): names[k] for k in range(1, 11)}, "updated_at": _now()}},
        upsert=True,
    )
    return await get_relay_labels(ident)


@app.get("/api/comandos/catalog")
async def comandos_catalog(ident: str = "POLLO_BEBE", ip: str | None = None):
    latest = await _latest_by_kind(ident, ip)
    names = await _relay_names_for(ident)
    cat = cmdb.catalog(latest, names)
    online, sess = await _is_online(None, ip, None)
    return {
        "ident": ident,
        "online": online,
        "session_id": (sess or {}).get("session_id"),
        "window": next((w for w in _cmd_win.values() if w.get("ip") == ip and w.get("open")), None)
        if ip
        else None,
        **cat,
    }


@app.post("/api/comandos/preview")
async def comandos_preview(body: ComandoBody):
    try:
        built = _built_comando(body)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    line = cmdb.encode_line(built["payload"])
    online, sess = await _is_online(body.addr, body.ip, body.session_id)
    return {
        "ok": True,
        "built": built,
        "line": line,
        "online": online,
        "would_queue": online,
        "would_reference": not online,
        "session_id": (sess or {}).get("session_id"),
        "ttl_s": cmdb.COMMAND_TTL_S,
    }


@app.post("/api/comandos/enqueue")
async def comandos_enqueue(body: ComandoBody):
    await _expire_comandos()
    try:
        built = _built_comando(body)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    online, sess = await _is_online(body.addr, body.ip, body.session_id)
    now = _now()
    qid = str(uuid.uuid4())
    status = "queued" if online else "reference"
    doc = {
        "queue_id": qid,
        "ts": now,
        "enqueued_at": now,
        "status": status,
        "reason": None if online else "offline_or_no_session",
        "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=cmdb.COMMAND_TTL_S)).isoformat(),
        "i": built.get("i"),
        "kind": built.get("kind"),
        "rs": built.get("rs"),
        "payload": built.get("payload"),
        "label": built.get("label"),
        "expected": built.get("value") if "value" in built else built.get("bits") or built.get("n"),
        "idx": built.get("idx"),
        "fp": built.get("fp"),
        "scaled": built.get("scaled"),
        "window": body.window or "any",
        "addr": body.addr,
        "ip": body.ip,
        "session_id": body.session_id or (sess or {}).get("session_id"),
        "origin": "reglas" if built.get("kind") == "pantalla_cmd" else "ui",
        "timed": bool(built.get("timed")),
        "built": built,
    }
    await db.comandos.insert_one(doc)
    if online:
        win = _window_open_for(body.addr, body.ip)
        if win:
            await _try_send_one_comando(addr=body.addr, ip=body.ip, window=win.get("name") or "any")
            fresh = await db.comandos.find_one({"queue_id": qid}, {"_id": 0})
            if fresh:
                doc = fresh
    await broadcast({"type": "comando", "action": "enqueue", "status": doc.get("status"), "queue_id": qid})
    return {"ok": True, "item": _jsonable(doc), "online": online}


@app.get("/api/comandos/queue")
async def comandos_queue(addr: str | None = None, ip: str | None = None):
    await _expire_comandos()
    q: dict[str, Any] = {"status": {"$in": ["queued", "window_wait", "reference"]}}
    if addr:
        q["addr"] = addr
    elif ip:
        q["ip"] = ip
    rows = await db.comandos.find(q, {"_id": 0}).sort("enqueued_at", 1).to_list(200)
    return {
        "items": rows,
        "count": len(rows),
        "queued": sum(1 for r in rows if r.get("status") in {"queued", "window_wait"}),
        "reference": sum(1 for r in rows if r.get("status") == "reference"),
        "ttl_s": cmdb.COMMAND_TTL_S,
        "windows": {
            k: {kk: vv for kk, vv in v.items() if kk != "until"} | {"open": bool(v.get("open") and float(v.get("until") or 0) > time.monotonic()), "name": v.get("name")}
            for k, v in _cmd_win.items()
        },
    }


@app.get("/api/comandos/sent")
async def comandos_sent(
    ident: str | None = None,
    ip: str | None = None,
    status: str | None = None,
    limit: int = 200,
):
    q: dict[str, Any] = {}
    if ident:
        q["i"] = ident
    if ip:
        q["ip"] = ip
    if status and status != "all":
        q["status"] = status
    limit = max(1, min(limit, 1000))
    rows = await db.comandos.find(q, {"_id": 0}).sort("enqueued_at", -1).limit(limit).to_list(limit)
    return {
        "items": rows,
        "count": len(rows),
        "sent": sum(1 for r in rows if r.get("status") == "sent"),
        "canceled": sum(1 for r in rows if r.get("status") == "canceled"),
        "errors": sum(1 for r in rows if r.get("status") == "error"),
    }


class ComandoCancelBody(BaseModel):
    queue_id: str | None = None


@app.post("/api/comandos/cancel")
async def comandos_cancel(body: ComandoCancelBody):
    if not body.queue_id:
        raise HTTPException(400, "queue_id requerido")
    row = await db.comandos.find_one({"queue_id": body.queue_id})
    if not row:
        raise HTTPException(404, "comando no encontrado")
    if row.get("status") not in {"queued", "window_wait", "reference"}:
        raise HTTPException(400, "solo se cancelan pendientes o referencias")
    await db.comandos.update_one(
        {"_id": row["_id"]},
        {"$set": {"status": "canceled", "reason": "user", "canceled_at": _now()}},
    )
    await broadcast({"type": "comando", "action": "canceled", "queue_id": body.queue_id})
    return {"ok": True, "queue_id": body.queue_id}


@app.get("/api/reglas/catalog")
async def reglas_catalog(ident: str = "POLLO_BEBE", ip: str | None = None, addr: str | None = None):
    latest = await _latest_by_kind(ident, ip)
    if not latest.get("info") and not latest.get("relay"):
        latest = await _latest_by_kind(ident, None)
    names = await _relay_names_for(ident)
    info = ((latest.get("info") or {}).get("snapshot") or {})
    relay = latest.get("relay") or {}
    rsnap = relay.get("snapshot") or {}
    relays = []
    for r in relay.get("relays") or []:
        rid = r.get("id")
        relays.append(
            {
                **r,
                "name": r.get("name") or names.get(rid) or f"RELAY{rid}",
            }
        )
    motores = []
    for a in relay.get("analogs") or []:
        motores.append(
            {
                "id": a.get("id"),
                "label": f"Motor {a.get('id')}",
                "source": a.get("label"),
                "volts": a.get("volts"),
                "speed_pct": a.get("speed_pct"),
            }
        )
    online, sess = await _is_online(addr, ip, None)
    return {
        "ident": ident,
        "online": online,
        "session_id": (sess or {}).get("session_id"),
        "tables": regl.tables(),
        "live": {
            "info": info,
            "relays": relays,
            "motores": motores,
            "humidity_pct": info.get("humidity_pct") if info.get("humidity_pct") is not None else rsnap.get("humidity_pct"),
        },
        "nota": "Acciones con tiempo: no reemplazan consignas MP-5000 ni SET_RELE. Motores = 4 analógicas de RELAY_DATA.",
    }


class ReglasPreviewBody(BaseModel):
    ident: str = "POLLO_BEBE"
    modo: str = "DEC"
    reglas: list[dict[str, Any]] = Field(default_factory=list)


@app.post("/api/reglas/preview")
async def reglas_preview(body: ReglasPreviewBody):
    try:
        built = regl.build_program(body.reglas, ident=body.ident, modo=body.modo or "DEC")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return built


@app.post("/api/comandos/queue/clear")
async def comandos_queue_clear():
    now = _now()
    result = await db.comandos.update_many(
        {"status": {"$in": ["queued", "window_wait", "reference"]}},
        {"$set": {"status": "canceled", "reason": "cleared", "canceled_at": now}},
    )
    await broadcast({"type": "comando", "action": "cleared", "count": result.modified_count})
    return {"ok": True, "canceled": result.modified_count}


async def _unit_context(ident: str) -> tuple[dict[str, Any], bool, dict[str, Any] | None]:
    latest = await _latest_by_kind(ident, None)
    ip = None
    addr = None
    for kind in ("info", "relay", "mp5000"):
        row = latest.get(kind) or {}
        ip = ip or row.get("ip")
        addr = addr or row.get("addr")
    online, sess = await _is_online(addr, ip, None)
    if not online:
        dev = await db.devices.find_one({"is_connected": True})
        if dev:
            return latest, True, {
                "session_id": dev.get("session_id"),
                "ip": dev.get("ip"),
                "addr": dev.get("addr"),
            }
    if sess and addr:
        sess = {**sess, "addr": sess.get("addr") or addr, "ip": sess.get("ip") or ip}
    return latest, online, sess


@app.post("/api/client/login")
async def client_login(body: ClientLoginBody):
    key = (body.username or "").strip().lower()
    user = CLIENT_USERS.get(key)
    if not user or user["password"] != (body.password or ""):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    return {
        "ok": True,
        "role": user["role"],
        "name": user["name"],
        "username": key,
        "ident": capi.IDENT_DEFAULT,
    }


@app.get("/api/client/live")
async def client_live(ident: str = capi.IDENT_DEFAULT):
    latest, online, sess = await _unit_context(ident)
    names = await _relay_names_for(ident)
    snap = capi.build_live(latest, ident=ident, online=online, names=names)
    snap["session_id"] = (sess or {}).get("session_id")
    snap["ip"] = (sess or {}).get("ip")
    snap["addr"] = (sess or {}).get("addr")
    return snap


@app.get("/api/client/series")
async def client_series(ident: str = capi.IDENT_DEFAULT, hours: int = 6):
    hours = max(1, min(hours, 168))
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    q = {"i": ident, "kind": "info", "ts": {"$gte": since}}
    rows = await db.seguimiento.find(q, {"_id": 0}).sort("ts", 1).to_list(4000)
    return capi.build_series(rows, hours)


@app.post("/api/client/setpoints")
async def client_setpoints(body: ClientSetpointsBody):
    ident = (body.ident or capi.IDENT_DEFAULT).strip() or capi.IDENT_DEFAULT
    latest, online, sess = await _unit_context(ident)
    addr = (sess or {}).get("addr")
    ip = (sess or {}).get("ip")
    session_id = (sess or {}).get("session_id")
    writes: list[tuple[str, int, float]] = []
    if body.temperature_c is not None:
        writes.append(("temperature_c", 0, float(body.temperature_c)))
    if body.humidity_pct is not None:
        writes.append(("humidity_pct", 4, float(body.humidity_pct)))
    if body.co2_pct is not None:
        writes.append(("co2_pct", 3, float(body.co2_pct)))
    if not writes:
        raise HTTPException(400, "indique temperature_c, humidity_pct o co2_pct")
    queued = []
    for key, idx, value in writes:
        built = cmdb.build_mp5000(idx, value, None, ident)
        item = await comandos_enqueue(
            ComandoBody(
                ident=ident,
                addr=addr,
                ip=ip,
                session_id=session_id,
                kind="mp5000_write",
                idx=idx,
                value=value,
                fp=built.get("fp"),
            )
        )
        queued.append({"key": key, "idx": idx, "value": value, **item})
    return {"ok": True, "online": online, "count": len(queued), "items": queued}


@app.get("/api/unit-status")
async def list_unit_status(
    ident: str | None = None,
    ip: str | None = None,
    date: str | None = None,
    limit: int = 50,
):
    """Alias de /api/seguimiento (compatibilidad)."""
    return await list_seguimiento(date=date, ident=ident, ip=ip, limit=limit)


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
