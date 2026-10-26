"""Comando dejado listo para salir cuando una IP abre la conexión."""

from __future__ import annotations


def clean_ipv4(raw: str | None) -> str:
    ip = (raw or "").strip()
    parts = ip.split(".")
    if len(parts) != 4:
        raise ValueError("IP no válida")
    try:
        nums = [int(part) for part in parts]
    except ValueError:
        raise ValueError("IP no válida")
    if any(n < 0 or n > 255 or str(n) != part for n, part in zip(nums, parts)):
        raise ValueError("IP no válida")
    return ip


def prepare_connect_message(message: str | None, encoding: str | None, crlf: bool) -> tuple[str, str]:
    """Devuelve el texto listo para el bridge y la codificación normalizada."""
    enc = (encoding or "hex").strip().lower()
    if enc not in {"hex", "string", "int"}:
        raise ValueError("codificación no válida")
    text = str(message or "").strip()
    if not text:
        raise ValueError("escribe el comando")
    if enc == "hex":
        cleaned = "".join(ch for ch in text if ch not in " \t:")
        if not cleaned or len(cleaned) % 2 or any(c not in "0123456789abcdefABCDEF" for c in cleaned):
            raise ValueError("el HEX debe tener longitud par")
        text = cleaned.upper()
        if crlf:
            text += "0D0A"
    elif enc == "int":
        try:
            int(text, 10)
        except ValueError:
            raise ValueError("el entero no es válido")
        if crlf:
            text += "\r\n"
    elif crlf:
        text += "\r\n"
    return text, enc
