"""Control del nivel (campo 12 de PGet) con dosis RELE(1,N)_.

Solo sube el valor. Empieza cuando la lectura cae más del margen configurado
(por defecto un 2 %) por debajo del objetivo.
N sigue la pendiente: proporcional al error, un poco de integral si se queda abajo,
y resta si el nivel ya está subiendo.

La orden no sale en la trama del nivel. Queda armada y se transmite en el
siguiente RX que termina en Server_Get. El equipo confirma con
SET_RELE 1 -> N OK.
"""

from __future__ import annotations

import re
from typing import Any

_ACK_RE = re.compile(r"SET_RELE\s+(\d+)\s*->\s*(\d+)\s+OK\b", re.IGNORECASE)

# 3 s de inyección suben cerca de 2. No se cierra el hueco de una vez.
KP_S_PER_UNIT = 0.6
KI_S_PER_UNIT = 0.08
KD_S_PER_SLOPE = 0.5
N_MAX = 20
DEFAULT_BAND_PCT = 2.0
DEFAULT_GAP_S = 120.0


def _margin_pct(band_pct: float | None) -> float:
    try:
        pct = DEFAULT_BAND_PCT if band_pct is None else float(band_pct)
    except (TypeError, ValueError):
        pct = DEFAULT_BAND_PCT
    if pct < 0:
        return 0.0
    if pct > 100:
        return 100.0
    return pct


def _gap_s(gap_s: float | None) -> float:
    try:
        gap = DEFAULT_GAP_S if gap_s is None else float(gap_s)
    except (TypeError, ValueError):
        gap = DEFAULT_GAP_S
    if gap < 0:
        return 0.0
    if gap > 1800:
        return 1800.0
    return gap


def decide(
    state: dict[str, Any] | None,
    *,
    now: float,
    level: float,
    setpoint: float,
    band_pct: float | None = None,
    gap_s: float | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    prev = dict(state or {})
    integral = float(prev.get("integral") or 0.0)
    prev_level = prev.get("prev_level")
    prev_t = prev.get("prev_t")
    last_dose_t = prev.get("last_dose_t")

    dt_s = 35.0 if prev_t is None else max(1.0, now - float(prev_t))
    dt_min = dt_s / 60.0
    slope = 0.0 if prev_level is None else (level - float(prev_level)) / dt_min
    error = setpoint - level
    pct = _margin_pct(band_pct)
    wait_s = _gap_s(gap_s)
    band = setpoint * (1.0 - pct / 100.0)
    pct_label = f"{pct:g}%"

    p = KP_S_PER_UNIT * max(error, 0.0)
    i = KI_S_PER_UNIT * integral
    d = -KD_S_PER_SLOPE * slope
    n = 0
    send = False
    reason = ""

    if level >= setpoint:
        integral *= 0.5
        reason = "en o sobre el objetivo, no inyecto"
    elif level >= band:
        integral *= 0.8
        reason = f"dentro del {pct_label} ({band:.1f}), espero sin dosis"
    else:
        integral = min(40.0, integral + max(error, 0.0) * dt_min)
        i = KI_S_PER_UNIT * integral
        raw = p + i + d
        n = int(round(raw))
        if n < 1:
            n = 0
            reason = f"bajo el {pct_label}, la dosis calculada es nula"
        elif n > N_MAX:
            n = N_MAX
        gap = None if last_dose_t is None else now - float(last_dose_t)
        if n >= 1 and gap is not None and gap < wait_s:
            reason = (
                f"bajo el {pct_label}, dosis {n}s en espera "
                f"(faltan {int(wait_s - gap)}s de {int(wait_s)}s) para ver el efecto"
            )
            n = 0
        elif n >= 1:
            send = True
            reason = (
                f"bajo {band:.1f}: error {error:.1f}, "
                f"P {p:.1f}s I {i:.1f}s D {d:.1f}s → RELE(1,{n})_ al llegar Server_Get"
            )

    nxt = {
        "integral": round(integral, 3),
        "prev_level": level,
        "prev_t": now,
        "last_dose_t": last_dose_t,
    }
    decision = {
        "level": level,
        "setpoint": setpoint,
        "band": round(band, 2),
        "band_pct": pct,
        "gap_s": wait_s,
        "error": round(error, 2),
        "slope": round(slope, 2),
        "p": round(p, 2),
        "i": round(i, 2),
        "d": round(d, 2),
        "n": n,
        "send": send,
        "reason": reason,
        "tx": f"RELE(1,{n})_" if send else None,
    }
    return nxt, decision


def is_server_get(text: str) -> bool:
    return (text or "").strip().endswith("Server_Get")


def parse_rele_ack(text: str) -> tuple[int, int] | None:
    match = _ACK_RE.search(text or "")
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def commit_tx(state: dict[str, Any] | None, now: float) -> dict[str, Any]:
    """La dosis ya salió por TX. El hueco de 2 min cuenta desde aquí."""
    nxt = dict(state or {})
    pending = dict(nxt.get("pending") or {})
    nxt["last_dose_t"] = now
    nxt["awaiting"] = {"n": pending.get("n"), "tx": pending.get("tx")}
    nxt.pop("pending", None)
    return nxt


def on_frame(
    state: dict[str, Any] | None,
    *,
    now: float,
    text: str,
    level: float | None,
    setpoint: float,
    band_pct: float | None = None,
    gap_s: float | None = None,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Una trama RX.

    El nivel arma la dosis y no transmite. Solo Server_Get pide el envío.
    SET_RELE c -> N OK cierra la orden que estaba en curso.
    """
    prev = dict(state or {})
    ack = parse_rele_ack(text)
    if ack:
        channel, seconds = ack
        waiting = prev.get("awaiting") or {}
        expected = waiting.get("n")
        if not waiting:
            return prev, None
        if channel == 1 and expected is not None and int(expected) == seconds:
            token = waiting.get("token")
            prev.pop("awaiting", None)
            prev["ack_done"] = f"SET_RELE {channel} -> {seconds} OK"
            prev["ack_token"] = token
            return prev, {
                "kind": "ack",
                "ack": True,
                "ack_text": prev["ack_done"],
                "token": token,
                "send": False,
                "sent": True,
                "n": seconds,
                "tx": waiting.get("tx"),
                "level": prev.get("prev_level"),
                "setpoint": setpoint,
                "reason": f"el equipo confirmó SET_RELE {channel} -> {seconds} OK",
            }
        if channel == 1:
            token = waiting.get("token")
            prev.pop("awaiting", None)
            got = f"SET_RELE {channel} -> {seconds} OK"
            prev["ack_token"] = token
            return prev, {
                "kind": "ack",
                "ack": False,
                "ack_text": got,
                "token": token,
                "send": False,
                "sent": True,
                "n": seconds,
                "tx": waiting.get("tx"),
                "level": prev.get("prev_level"),
                "setpoint": setpoint,
                "reason": f"{got} no coincide con {waiting.get('tx')}",
            }
        return prev, None

    if is_server_get(text):
        pending = prev.get("pending")
        if not pending:
            return prev, None
        return prev, {
            "kind": "tx",
            "send": True,
            "armed": True,
            "sent": False,
            "ack": None,
            "n": pending.get("n"),
            "tx": pending.get("tx"),
            "level": pending.get("level"),
            "setpoint": setpoint,
            "error": pending.get("error"),
            "p": pending.get("p"),
            "i": pending.get("i"),
            "d": pending.get("d"),
            "reason": f"Server_Get: envío {pending.get('tx')}",
        }

    if level is None:
        return prev, None

    nxt, decision = decide(
        prev,
        now=now,
        level=float(level),
        setpoint=setpoint,
        band_pct=band_pct,
        gap_s=gap_s,
    )
    if prev.get("awaiting"):
        nxt["awaiting"] = prev.get("awaiting")
    if prev.get("ack_done"):
        nxt["ack_done"] = prev.get("ack_done")
        nxt["ack_token"] = prev.get("ack_token")
    decision["kind"] = "level"
    decision["ack"] = None
    decision["sent"] = False
    if decision["send"]:
        nxt["pending"] = {
            "tx": decision["tx"],
            "n": decision["n"],
            "level": decision["level"],
            "error": decision["error"],
            "p": decision["p"],
            "i": decision["i"],
            "d": decision["d"],
        }
        decision["armed"] = True
        decision["send"] = False
    else:
        nxt.pop("pending", None)
        decision["armed"] = False
    return nxt, decision
