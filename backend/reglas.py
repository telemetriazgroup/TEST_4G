"""
Constructor de programas IF/ELSE/FIN IF (Proceo.md / generador_condicionales.py).

Emite PANTALLA_CMD. Acciones CON TIEMPO (no consignas definitivas).
No reemplaza MP5000_Trama_Write / SET_RELE.
"""

from __future__ import annotations

import re
from typing import Any

from comandos import IDENT_DEFAULT, encode_line

ENTRADAS = {
    "Suministro": (0x10, 10, "°C", -50.0, 100.0, "supply_air_c"),
    "Retorno": (0x11, 10, "°C", -50.0, 100.0, "return_air_c"),
    "CO2": (0x12, 10, "%", 0.0, 100.0, "co2_pct"),
    "USDA1": (0x13, 10, "°C", -50.0, 100.0, "usda1_c"),
    "USDA2": (0x14, 10, "°C", -50.0, 100.0, "usda2_c"),
    "USDA3": (0x15, 10, "°C", -50.0, 100.0, "usda3_c"),
    "USDA4": (0x16, 10, "°C", -50.0, 100.0, "usda4_c"),
}

SALIDAS = {
    "RELAY1": (0x20, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY2": (0x21, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY3": (0x22, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY4": (0x23, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY5": (0x24, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY6": (0x25, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY7": (0x26, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY8": (0x27, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY9": (0x28, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY10": (0x29, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "MOTORES": (0x2A, "num", 0, 100, "0-100 %. Estado vivo = 4 salidas analógicas RELAY"),
    "Inferior": (0x2B, "compuerta", 0, 1, "Compuerta inferior"),
    "Medio": (0x2C, "compuerta", 0, 1, "Compuerta media"),
    "Superior": (0x2D, "compuerta", 0, 1, "Compuerta superior"),
    "Setpoint": (0x2E, "num", 0, 400, "0-400 décimas de °C (acción temporal)"),
}

OPERADORES = {
    "IGUAL  (==)": (0x54, "=="),
    "IGUAL o MENOR  (<=)": (0x55, "<="),
    "IGUAL o MAYOR  (>=)": (0x56, ">="),
    "MENOR  (<)": (0x57, "<"),
    "MAYOR  (>)": (0x58, ">"),
}

INICIO_IF, FIN_IF, ELSE = 0x50, 0x51, 0x53
TIEMPO_PERMANENTE = 0xFEFE
PREFIJO = "PANTALLA_CMD:"


def b1(valor: int) -> str:
    return f"{valor & 0xFF:02X}"


def b2(valor: int, modo: str = "DEC") -> str:
    if modo == "DEC":
        if not 0 <= valor <= 9999:
            raise ValueError(f"{valor} no cabe en BCD 0-9999; use HEX")
        return f"{valor:04d}"
    return f"{valor & 0xFFFF:04X}"


def agrupar(hexstr: str) -> str:
    hx = re.sub(r"\s", "", str(hexstr or "")).upper()
    return " ".join(hx[i : i + 2] for i in range(0, len(hx), 2))


def etiqueta_estado(salida: str, estado: int) -> str:
    tipo = SALIDAS[salida][1]
    if tipo == "relay":
        return "ACTIVAR" if estado == 0 else "DESACTIVAR"
    if tipo == "compuerta":
        return "OPEN" if estado == 1 else "CLOSE"
    if salida == "Setpoint":
        return f"{estado / 10:.1f} °C"
    if salida == "MOTORES":
        return f"{estado} %"
    return str(estado)


def build_if(
    entrada: str,
    operador: str,
    valor_ing: float,
    salida: str,
    estado: int,
    tiempo: int,
    permanente: bool,
    modo: str = "DEC",
) -> dict[str, Any]:
    if entrada not in ENTRADAS:
        raise ValueError(f"entrada desconocida: {entrada}")
    if operador not in OPERADORES:
        raise ValueError(f"operador desconocido: {operador}")
    if salida not in SALIDAS:
        raise ValueError(f"salida desconocida: {salida}")
    cod_ent, factor, unidad, mn, mx, _ = ENTRADAS[entrada]
    if not mn <= valor_ing <= mx:
        raise ValueError(f"valor {valor_ing} fuera de {mn}…{mx} {unidad}")
    _, tipo, mn_e, mx_e, _ = SALIDAS[salida]
    if not mn_e <= int(estado) <= mx_e:
        raise ValueError(f"estado de {salida} fuera de {mn_e}…{mx_e}")
    if not permanente and not 0 <= int(tiempo) <= 65534:
        raise ValueError("tiempo 0…65534 s")
    valor_raw = int(round(float(valor_ing) * factor))
    tiempo_hex = f"{TIEMPO_PERMANENTE:04X}" if permanente else b2(int(tiempo), modo)
    codigo = (
        b1(INICIO_IF)
        + b1(cod_ent)
        + b1(OPERADORES[operador][0])
        + b2(valor_raw, modo)
        + b1(SALIDAS[salida][0])
        + b2(int(estado), modo)
        + tiempo_hex
    )
    t_txt = "permanente" if permanente else f"{int(tiempo)} s"
    desc = (
        f"SI {entrada} {OPERADORES[operador][1]} {valor_ing:g} {unidad} "
        f"→ {salida} = {etiqueta_estado(salida, int(estado))} ({t_txt})"
    )
    return {
        "tipo": "if",
        "codigo": codigo,
        "descripcion": desc,
        "entrada": entrada,
        "operador": operador,
        "valor": valor_ing,
        "salida": salida,
        "estado": int(estado),
        "tiempo": None if permanente else int(tiempo),
        "permanente": permanente,
        "timed": not permanente,
    }


def token_else() -> dict[str, Any]:
    return {"tipo": "else", "codigo": b1(ELSE), "descripcion": "--- ELSE ---"}


def token_endif() -> dict[str, Any]:
    return {"tipo": "endif", "codigo": b1(FIN_IF), "descripcion": "--- FIN IF ---"}


def step_from_dict(item: dict[str, Any], modo: str = "DEC") -> dict[str, Any]:
    tipo = (item.get("tipo") or "if").lower()
    if tipo == "else":
        return token_else()
    if tipo in {"endif", "fin", "fin_if"}:
        return token_endif()
    return build_if(
        item["entrada"],
        item["operador"],
        float(item["valor"]),
        item["salida"],
        int(item["estado"]),
        int(item.get("tiempo") or 0),
        bool(item.get("permanente")),
        modo,
    )


def validate_program(steps: list[dict[str, Any]]) -> list[str]:
    errs: list[str] = []
    if not steps:
        errs.append("programa vacío")
        return errs
    depth = 0
    else_open = False
    for i, s in enumerate(steps, 1):
        t = s.get("tipo")
        if t == "if":
            depth += 1
            else_open = False
        elif t == "else":
            if depth <= 0:
                errs.append(f"#{i} ELSE sin IF")
            elif else_open:
                errs.append(f"#{i} ELSE duplicado")
            else_open = True
        elif t == "endif":
            if depth <= 0:
                errs.append(f"#{i} FIN IF de más")
            else:
                depth -= 1
                else_open = False
    return errs


def build_program(
    items: list[dict[str, Any]],
    *,
    ident: str = IDENT_DEFAULT,
    modo: str = "DEC",
) -> dict[str, Any]:
    steps = [step_from_dict(it, modo) for it in items]
    errors = validate_program(steps)
    hexstr = "".join(s["codigo"] for s in steps)
    rs = PREFIJO + hexstr
    payload = {"i": ident, "rs": rs}
    label = " · ".join(s["descripcion"] for s in steps[:3])
    if len(steps) > 3:
        label += f" (+{len(steps) - 3})"
    return {
        "kind": "pantalla_cmd",
        "i": ident,
        "rs": rs,
        "payload": payload,
        "hex": hexstr,
        "hex_grouped": agrupar(hexstr),
        "line": encode_line(payload),
        "reglas": steps,
        "errors": errors,
        "ok": not errors,
        "label": label or "PANTALLA_CMD",
        "timed": any(s.get("tipo") == "if" and s.get("timed") for s in steps),
        "modo": modo,
    }


def tables() -> dict[str, Any]:
    return {
        "entradas": [
            {"name": n, "code": f"0x{v[0]:02X}", "unit": v[2], "min": v[3], "max": v[4], "live_key": v[5]}
            for n, v in ENTRADAS.items()
        ],
        "salidas": [
            {"name": n, "code": f"0x{v[0]:02X}", "tipo": v[1], "min": v[2], "max": v[3], "help": v[4]}
            for n, v in SALIDAS.items()
        ],
        "operadores": [{"name": n, "code": f"0x{v[0]:02X}", "simbolo": v[1]} for n, v in OPERADORES.items()],
        "prefijo": PREFIJO,
    }
