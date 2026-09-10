#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador de condicionales - Cámara POLLO_BEBE
-----------------------------------------------
Construye tramas del tipo:

    INICIO_IF + ENTRADA + OPERADOR + VALOR(2B) + SALIDA + ESTADO(2B) + TIEMPO(2B)

Ejemplo:  "Si Suministro > 22.0 °C, activar RELAY1 durante 5 s"
          50 10 58 0220 20 0000 0005      (relés: lógica invertida, 0 = activado)

Trama final:
    {"i":"POLLO_BEBE","rs":"PANTALLA_CMD:50105802202000000005"}

Requiere solo la librería estándar (tkinter).
"""

import json
import tkinter as tk
from tkinter import ttk, messagebox

# --------------------------------------------------------------------------
# TABLAS DEL PROTOCOLO
# --------------------------------------------------------------------------

# nombre: (codigo, factor_escala, unidad, min_ing, max_ing)
ENTRADAS = {
    "Suministro": (0x10, 10, "°C", -50.0, 100.0),
    "Retorno":    (0x11, 10, "°C", -50.0, 100.0),
    "CO2":        (0x12, 10, "%",    0.0, 100.0),
    "USDA1":      (0x13, 10, "°C", -50.0, 100.0),
    "USDA2":      (0x14, 10, "°C", -50.0, 100.0),
    "USDA3":      (0x15, 10, "°C", -50.0, 100.0),
    "USDA4":      (0x16, 10, "°C", -50.0, 100.0),
}

# Lógica invertida de los relés: la bobina se energiza con 0.
ESTADO_RELAY = [("ACTIVAR  (0)", 0), ("DESACTIVAR  (1)", 1)]

# <<< AJUSTAR AQUÍ si el firmware usa otros valores para las compuertas >>>
ESTADO_COMPUERTA = [("OPEN  (1)", 1), ("CLOSE  (0)", 0)]

# nombre: (codigo, tipo, min, max, descripcion_rango)
#   tipo "relay"     -> combo ACTIVAR / DESACTIVAR
#   tipo "compuerta" -> combo OPEN / CLOSE
#   tipo "num"       -> spinbox con rango
SALIDAS = {
    "RELAY1":   (0x20, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY2":   (0x21, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY3":   (0x22, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY4":   (0x23, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY5":   (0x24, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY6":   (0x25, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY7":   (0x26, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY8":   (0x27, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY9":   (0x28, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "RELAY10":  (0x29, "relay", 0, 1, "Lógica invertida: 0 activa, 1 apaga"),
    "MOTORES":  (0x2A, "num", 0, 100, "0 - 100 %"),
    "Inferior": (0x2B, "compuerta", 0, 1, "Compuerta inferior"),
    "Medio":    (0x2C, "compuerta", 0, 1, "Compuerta media"),
    "Superior": (0x2D, "compuerta", 0, 1, "Compuerta superior"),
    "Setpoint": (0x2E, "num", 0, 400, "0 - 400 (décimas de °C)"),
}

OPERADORES = {
    "IGUAL  (==)":         (0x54, "=="),
    "IGUAL o MENOR  (<=)": (0x55, "<="),
    "IGUAL o MAYOR  (>=)": (0x56, ">="),
    "MENOR  (<)":          (0x57, "<"),
    "MAYOR  (>)":          (0x58, ">"),
}

INICIO_IF = 0x50
FIN_IF    = 0x51
IF        = 0x52
ELSE      = 0x53

TIEMPO_PERMANENTE = 0xFEFE


# --------------------------------------------------------------------------
# UTILIDADES
# --------------------------------------------------------------------------

def b1(valor: int) -> str:
    """1 byte -> 2 caracteres hex."""
    return f"{valor & 0xFF:02X}"


def b2(valor: int, modo: str = "DEC") -> str:
    """Codifica un campo de 2 bytes.

    modo "DEC": los 4 dígitos son el número en decimal (BCD).
                22.0 °C -> 220 -> "0220"
    modo "HEX": entero de 16 bits con signo (complemento a 2).
                22.0 °C -> 220 -> "00DC" ; -18.5 °C -> -185 -> "FF47"
    """
    if modo == "DEC":
        if not 0 <= valor <= 9999:
            raise ValueError(f"{valor} no se puede representar en BCD de 4 dígitos "
                             f"(0-9999). Use el formato HEX.")
        return f"{valor:04d}"
    return f"{valor & 0xFFFF:04X}"


def agrupar(hexstr: str, tam: int = 2) -> str:
    """Devuelve el string hex separado en bytes, solo para lectura."""
    return " ".join(hexstr[i:i + tam] for i in range(0, len(hexstr), tam))


def etiqueta_estado(salida: str, estado: int) -> str:
    """Texto legible del estado según el tipo de salida."""
    tipo = SALIDAS[salida][1]
    tabla = ESTADO_RELAY if tipo == "relay" else ESTADO_COMPUERTA if tipo == "compuerta" else None
    if tabla:
        for txt, val in tabla:
            if val == estado:
                return txt.split("(")[0].strip()
    if salida == "Setpoint":
        return f"{estado / 10:.1f} °C"
    if salida == "MOTORES":
        return f"{estado} %"
    return str(estado)


class Regla:
    """Una condicional completa o un token suelto (ELSE / FIN IF)."""

    def __init__(self, codigo: str, descripcion: str):
        self.codigo = codigo
        self.descripcion = descripcion

    @classmethod
    def condicional(cls, entrada, operador, valor_ing, salida, estado,
                    tiempo, permanente, modo="DEC"):
        cod_ent, factor, unidad, _, _ = ENTRADAS[entrada]
        cod_op, simbolo = OPERADORES[operador]
        cod_sal = SALIDAS[salida][0]

        valor_raw = int(round(valor_ing * factor))
        tiempo_hex = (f"{TIEMPO_PERMANENTE:04X}" if permanente else b2(tiempo, modo))

        codigo = (b1(INICIO_IF) + b1(cod_ent) + b1(cod_op) + b2(valor_raw, modo)
                  + b1(cod_sal) + b2(estado, modo) + tiempo_hex)

        t_txt = "permanente" if permanente else f"{tiempo} s"
        desc = (f"SI {entrada} {simbolo} {valor_ing:g} {unidad} "
                f"→ {salida} = {etiqueta_estado(salida, estado)} ({t_txt})")
        return cls(codigo, desc)


# --------------------------------------------------------------------------
# INTERFAZ
# --------------------------------------------------------------------------

class App(ttk.Frame):

    def __init__(self, master):
        super().__init__(master, padding=12)
        self.grid(sticky="nsew")
        master.columnconfigure(0, weight=1)
        master.rowconfigure(0, weight=1)
        self.columnconfigure(0, weight=1)
        self.rowconfigure(2, weight=1)

        self.reglas: list[Regla] = []

        self._construir_editor()
        self._construir_botones()
        self._construir_lista()
        self._construir_salida()

        self._on_entrada_change()
        self._on_salida_change()
        self._refrescar()

    # ---------------- editor de condicional ----------------
    def _construir_editor(self):
        box = ttk.LabelFrame(self, text="Nueva condicional", padding=10)
        box.grid(row=0, column=0, sticky="ew")
        for c in (1, 3, 5):
            box.columnconfigure(c, weight=1)

        # --- fila 1: condición ---
        ttk.Label(box, text="Entrada").grid(row=0, column=0, sticky="w", padx=4, pady=4)
        self.cb_entrada = ttk.Combobox(box, values=list(ENTRADAS), state="readonly", width=14)
        self.cb_entrada.current(0)
        self.cb_entrada.grid(row=0, column=1, sticky="ew", padx=4, pady=4)
        self.cb_entrada.bind("<<ComboboxSelected>>", self._on_entrada_change)

        ttk.Label(box, text="Operador").grid(row=0, column=2, sticky="w", padx=4, pady=4)
        self.cb_operador = ttk.Combobox(box, values=list(OPERADORES), state="readonly", width=18)
        self.cb_operador.current(4)          # MAYOR
        self.cb_operador.grid(row=0, column=3, sticky="ew", padx=4, pady=4)
        self.cb_operador.bind("<<ComboboxSelected>>", self._refrescar)

        ttk.Label(box, text="Valor").grid(row=0, column=4, sticky="w", padx=4, pady=4)
        self.var_valor = tk.StringVar(value="22.0")
        self.var_valor.trace_add("write", self._refrescar)
        ttk.Entry(box, textvariable=self.var_valor, width=10).grid(
            row=0, column=5, sticky="w", padx=4, pady=4)
        self.lbl_unidad = ttk.Label(box, text="°C", width=24)
        self.lbl_unidad.grid(row=0, column=6, sticky="w", padx=4)

        # --- fila 2: acción ---
        ttk.Label(box, text="Salida").grid(row=1, column=0, sticky="w", padx=4, pady=4)
        self.cb_salida = ttk.Combobox(box, values=list(SALIDAS), state="readonly", width=14)
        self.cb_salida.current(0)
        self.cb_salida.grid(row=1, column=1, sticky="ew", padx=4, pady=4)
        self.cb_salida.bind("<<ComboboxSelected>>", self._on_salida_change)

        ttk.Label(box, text="Estado").grid(row=1, column=2, sticky="w", padx=4, pady=4)
        self.var_estado = tk.StringVar(value="0")
        self.var_estado.trace_add("write", self._refrescar)
        # dos widgets alternos en la misma celda: combo (relay/compuerta) o spinbox (numérico)
        self.cb_estado = ttk.Combobox(box, state="readonly", width=16)
        self.cb_estado.bind("<<ComboboxSelected>>", self._on_estado_combo)
        self.sp_estado = ttk.Spinbox(box, from_=0, to=1, textvariable=self.var_estado, width=8)
        self.cb_estado.grid(row=1, column=3, sticky="w", padx=4, pady=4)
        self.sp_estado.grid(row=1, column=3, sticky="w", padx=4, pady=4)
        self.lbl_rango = ttk.Label(box, text="")
        self.lbl_rango.grid(row=1, column=4, columnspan=3, sticky="w", padx=4)

        # --- fila 3: tiempo y formato ---
        ttk.Label(box, text="Tiempo (s)").grid(row=2, column=0, sticky="w", padx=4, pady=4)
        self.var_tiempo = tk.StringVar(value="5")
        self.var_tiempo.trace_add("write", self._refrescar)
        self.sp_tiempo = ttk.Spinbox(box, from_=0, to=65534, textvariable=self.var_tiempo, width=10)
        self.sp_tiempo.grid(row=2, column=1, sticky="w", padx=4, pady=4)

        self.var_perm = tk.BooleanVar(value=False)
        ttk.Checkbutton(box, text="Permanente (FEFE)", variable=self.var_perm,
                        command=self._on_perm_change).grid(
            row=2, column=2, columnspan=2, sticky="w", padx=4, pady=4)

        fmt = ttk.Frame(box)
        fmt.grid(row=2, column=4, columnspan=3, sticky="w", padx=4)
        ttk.Label(fmt, text="Campos de 2 bytes:").pack(side="left")
        self.var_modo = tk.StringVar(value="DEC")
        ttk.Radiobutton(fmt, text="BCD (0220 = 22.0)", value="DEC",
                        variable=self.var_modo, command=self._refrescar).pack(side="left", padx=6)
        ttk.Radiobutton(fmt, text="HEX (00DC = 22.0)", value="HEX",
                        variable=self.var_modo, command=self._refrescar).pack(side="left")

        self.lbl_preview = ttk.Label(box, text="", font=("Courier New", 11, "bold"),
                                     foreground="#0B5")
        self.lbl_preview.grid(row=3, column=0, columnspan=7, sticky="w", padx=4, pady=(8, 0))

    # ---------------- botones ----------------
    def _construir_botones(self):
        barra = ttk.Frame(self)
        barra.grid(row=1, column=0, sticky="ew", pady=8)
        ttk.Button(barra, text="Agregar condicional", command=self.agregar).pack(side="left")
        ttk.Button(barra, text="Agregar ELSE (53)",
                   command=lambda: self.agregar_token(ELSE, "ELSE")).pack(side="left", padx=6)
        ttk.Button(barra, text="Agregar FIN IF (51)",
                   command=lambda: self.agregar_token(FIN_IF, "FIN IF")).pack(side="left")
        ttk.Button(barra, text="Subir", command=lambda: self.mover(-1)).pack(side="left", padx=(20, 3))
        ttk.Button(barra, text="Bajar", command=lambda: self.mover(1)).pack(side="left", padx=3)
        ttk.Button(barra, text="Eliminar", command=self.eliminar).pack(side="left", padx=3)
        ttk.Button(barra, text="Limpiar todo", command=self.limpiar).pack(side="left", padx=3)

    # ---------------- lista de reglas ----------------
    def _construir_lista(self):
        box = ttk.LabelFrame(self, text="Programa", padding=6)
        box.grid(row=2, column=0, sticky="nsew")
        box.columnconfigure(0, weight=1)
        box.rowconfigure(0, weight=1)

        cols = ("n", "desc", "code")
        self.tree = ttk.Treeview(box, columns=cols, show="headings", height=8)
        self.tree.heading("n", text="#")
        self.tree.heading("desc", text="Descripción")
        self.tree.heading("code", text="Código")
        self.tree.column("n", width=40, anchor="center", stretch=False)
        self.tree.column("desc", width=430)
        self.tree.column("code", width=250, anchor="w")
        self.tree.grid(row=0, column=0, sticky="nsew")

        sb = ttk.Scrollbar(box, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=sb.set)
        sb.grid(row=0, column=1, sticky="ns")

    # ---------------- salida final ----------------
    def _construir_salida(self):
        box = ttk.LabelFrame(self, text="Trama a enviar", padding=10)
        box.grid(row=3, column=0, sticky="ew", pady=(10, 0))
        box.columnconfigure(1, weight=1)

        ttk.Label(box, text='ID ("i")').grid(row=0, column=0, sticky="w", padx=4)
        self.var_id = tk.StringVar(value="POLLO_BEBE")
        self.var_id.trace_add("write", self._refrescar)
        ttk.Entry(box, textvariable=self.var_id, width=20).grid(row=0, column=1, sticky="w", padx=4)

        ttk.Label(box, text="Prefijo").grid(row=0, column=2, sticky="w", padx=4)
        self.var_prefijo = tk.StringVar(value="PANTALLA_CMD:")
        self.var_prefijo.trace_add("write", self._refrescar)
        ttk.Entry(box, textvariable=self.var_prefijo, width=20).grid(row=0, column=3, sticky="w", padx=4)

        self.txt_salida = tk.Text(box, height=5, wrap="char", font=("Courier New", 10))
        self.txt_salida.grid(row=1, column=0, columnspan=4, sticky="ew", pady=(10, 6))

        ttk.Button(box, text="Copiar trama JSON",
                   command=self.copiar_json).grid(row=2, column=0, sticky="w", padx=4)
        ttk.Button(box, text="Copiar solo HEX",
                   command=self.copiar_hex).grid(row=2, column=1, sticky="w", padx=4)

    # ---------------- eventos ----------------
    def _on_entrada_change(self, *_):
        _, factor, unidad, mn, mx = ENTRADAS[self.cb_entrada.get()]
        self.lbl_unidad.config(text=f"{unidad}   (x{factor} → 2 bytes)")
        self._refrescar()

    def _on_salida_change(self, *_):
        salida = self.cb_salida.get()
        _, tipo, mn, mx, desc = SALIDAS[salida]
        self.lbl_rango.config(text=desc)

        if tipo in ("relay", "compuerta"):
            tabla = ESTADO_RELAY if tipo == "relay" else ESTADO_COMPUERTA
            self.sp_estado.grid_remove()
            self.cb_estado.grid()
            self.cb_estado.config(values=[t for t, _ in tabla])
            self.cb_estado.current(0)
            self.var_estado.set(str(tabla[0][1]))
        else:
            self.cb_estado.grid_remove()
            self.sp_estado.grid()
            self.sp_estado.config(from_=mn, to=mx)
            try:
                v = int(self.var_estado.get())
            except ValueError:
                v = mn
            self.var_estado.set(str(min(max(v, mn), mx)))
        self._refrescar()

    def _on_estado_combo(self, *_):
        tipo = SALIDAS[self.cb_salida.get()][1]
        tabla = ESTADO_RELAY if tipo == "relay" else ESTADO_COMPUERTA
        for txt, val in tabla:
            if txt == self.cb_estado.get():
                self.var_estado.set(str(val))
                break
        self._refrescar()

    def _on_perm_change(self):
        self.sp_tiempo.config(state="disabled" if self.var_perm.get() else "normal")
        self._refrescar()

    # ---------------- lógica ----------------
    def _leer_formulario(self):
        """Devuelve una Regla o lanza ValueError con el mensaje del problema."""
        entrada = self.cb_entrada.get()
        _, factor, unidad, mn_v, mx_v = ENTRADAS[entrada]
        try:
            valor = float(self.var_valor.get().replace(",", "."))
        except ValueError:
            raise ValueError("El valor a comparar no es un número válido.")
        if not mn_v <= valor <= mx_v:
            raise ValueError(f"El valor debe estar entre {mn_v:g} y {mx_v:g} {unidad}.")

        salida = self.cb_salida.get()
        _, tipo, mn_e, mx_e, _ = SALIDAS[salida]
        try:
            estado = int(self.var_estado.get())
        except ValueError:
            raise ValueError("El estado de salida no es un entero válido.")
        if not mn_e <= estado <= mx_e:
            raise ValueError(f"El estado de {salida} debe estar entre {mn_e} y {mx_e}.")

        permanente = self.var_perm.get()
        tiempo = 0
        if not permanente:
            try:
                tiempo = int(self.var_tiempo.get())
            except ValueError:
                raise ValueError("El tiempo no es un entero válido.")
            if not 0 <= tiempo <= 65534:
                raise ValueError("El tiempo debe estar entre 0 y 65534 segundos.")

        return Regla.condicional(entrada, self.cb_operador.get(), valor,
                                 salida, estado, tiempo, permanente,
                                 self.var_modo.get())

    def _refrescar(self, *_):
        try:
            regla = self._leer_formulario()
            self.lbl_preview.config(text=f"→  {agrupar(regla.codigo)}", foreground="#0B5")
        except ValueError as e:
            self.lbl_preview.config(text=f"→  {e}", foreground="#C33")
        self._refrescar_salida()

    def _refrescar_salida(self):
        hexstr = "".join(r.codigo for r in self.reglas)
        trama = json.dumps(
            {"i": self.var_id.get(), "rs": self.var_prefijo.get() + hexstr},
            ensure_ascii=False, separators=(",", ":"))
        self.txt_salida.delete("1.0", "end")
        if hexstr:
            self.txt_salida.insert("end", agrupar(hexstr) + "\n\n" + trama)
        else:
            self.txt_salida.insert("end", "(sin condicionales)")

    def _repintar_lista(self):
        self.tree.delete(*self.tree.get_children())
        for i, r in enumerate(self.reglas, 1):
            self.tree.insert("", "end", values=(i, r.descripcion, agrupar(r.codigo)))
        self._refrescar_salida()

    # ---------------- acciones ----------------
    def agregar(self):
        try:
            self.reglas.append(self._leer_formulario())
        except ValueError as e:
            messagebox.showerror("Dato inválido", str(e))
            return
        self._repintar_lista()

    def agregar_token(self, codigo, nombre):
        self.reglas.append(Regla(b1(codigo), f"--- {nombre} ---"))
        self._repintar_lista()

    def _seleccion(self):
        sel = self.tree.selection()
        if not sel:
            return None
        return self.tree.index(sel[0])

    def eliminar(self):
        i = self._seleccion()
        if i is None:
            return
        self.reglas.pop(i)
        self._repintar_lista()

    def mover(self, delta):
        i = self._seleccion()
        if i is None:
            return
        j = i + delta
        if not 0 <= j < len(self.reglas):
            return
        self.reglas[i], self.reglas[j] = self.reglas[j], self.reglas[i]
        self._repintar_lista()
        self.tree.selection_set(self.tree.get_children()[j])

    def limpiar(self):
        if self.reglas and messagebox.askyesno("Confirmar", "¿Borrar todas las condicionales?"):
            self.reglas.clear()
            self._repintar_lista()

    def _copiar(self, texto):
        self.clipboard_clear()
        self.clipboard_append(texto)
        self.update()

    def copiar_json(self):
        hexstr = "".join(r.codigo for r in self.reglas)
        self._copiar(json.dumps({"i": self.var_id.get(),
                                 "rs": self.var_prefijo.get() + hexstr},
                                ensure_ascii=False, separators=(",", ":")))

    def copiar_hex(self):
        self._copiar("".join(r.codigo for r in self.reglas))


def main():
    root = tk.Tk()
    root.title("Generador de condicionales — Cámara POLLO_BEBE")
    root.geometry("940x700")
    try:
        ttk.Style().theme_use("clam")
    except tk.TclError:
        pass
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
