# Condicionales (reglas de control en el controlador)

Especificación de casuística **antes de implementar** la pestaña de reglas complejas. Este archivo **no implementa** el módulo. Cruza `Proceo.md`, `generador_condicionales.py` y lo ya vivo en TEST_4G (seguimiento, comandos, ventanas TX, cola, TTL 2 h).

---

## 1. Qué es (y qué no es)

El escritorio actual construye un **programa** `IF / ELSE / FIN IF` que el **controlador de cámara (nodo PANTALLA)** evalúa solo. No es lógica que corra en nuestro backend.

> *Si Suministro > 22.0 °C, activar RELAY1 durante 5 s*

Una vez cargado en el equipo, el IF vive allí aunque TEST_4G se apague. Nosotros solo:

1. Ayudamos a **armar** el programa (didáctico, con valores actuales).
2. Lo **empaquetamos** en un JSON `rs`.
3. Lo **encolamos / registramos** con las mismas reglas que Comandos.
4. Lo **mandamos en una ventana TX libre**.

```
UI reglas ──► programa (lista IF/ELSE/FIN) ──► un solo rs PANTALLA_CMD
                      │
                      ▼
              cola comandos (kind=pantalla_cmd)
                      │
                      ▼
         ventana V1/V2 ──► TCP 9911 ──► gateway ──► RS485 PANTALLA
```

| Módulo | Quién decide | Qué se envía | Persistencia en equipo |
|--------|----------------|--------------|-------------------------|
| **Comandos** | Operador / TEST_4G, un disparo | `MP5000_Trama_Write` / `SET_RELE` / `SET_POT` | El valor queda; no hay “programa” |
| **Condicionales** | Firmware PANTALLA, en ciclo | `PANTALLA_CMD:<hex>` | El programa queda cargado hasta otro `PANTALLA_CMD` |
| **Seguimiento** | Solo lectura | — | INFO / RELAY / MP-5000 para umbrales actuales |
| **Homologación POST** | No interviene | — | — |

No mezclar: una condicional **no** se traduce a `SET_RELE` en nuestro servidor. Si lo hiciéramos, perderíamos el IF local y saturaríamos la cola.

---

## 2. Trama emitida (comando propio)

Sobre idéntico al resto de POLLO:

```json
{"i":"POLLO_BEBE","rs":"PANTALLA_CMD:50105802202000000005"}
```

| Pieza | Valor | Notas |
|--------|--------|--------|
| `i` | `POLLO_BEBE` | Misma cámara |
| Prefijo | `PANTALLA_CMD:` | Elige el esclavo RS485 “pantalla”, no `MP5000_` ni `RELAY001_` |
| Cuerpo | hex mayúsculas, **sin espacios** | Concatenación de todas las reglas del programa, en orden |
| Línea socket | JSON + **CRLF** | Igual que Comandos |

Ejemplo de una regla (10 bytes):

```
50 10 58 0220 20 0000 0005
│  │  │  │    │  │    └ tiempo 5 s
│  │  │  │    │  └ estado ACTIVAR (relé: 0 = ON)
│  │  │  │    └ RELAY1 (0x20)
│  │  │  └ 22.0 °C → 220 ×10 → BCD 0220
│  │  └ MAYOR 0x58
│  └ Suministro 0x10
└ INICIO_IF 0x50
```

Programa de varias reglas = hex pegado:

```
{IF1}{ELSE}{IF2}{FIN IF} → PANTALLA_CMD:50…5350…51
```

**Un encolar = un programa completo = un ítem de cola.** No se parte por regla ni por ventana. Si no cabe en el presupuesto TX (3,5 s) se espera la siguiente ventana; no se fragmenta.

Hipótesis de carga en el equipo (no hay comando de “append” en el generador): **cada `PANTALLA_CMD` reemplaza el programa anterior**. Documentar en la UI: “enviar este programa pisa el que está en la cámara”.

No existe en el material un `PANTALLA_GET_CMD` / lectura del programa cargado. Confirmación ≠ ACK.

---

## 3. Protocolo (tablas canónicas)

Fuente: `generador_condicionales.py`. Cualquier UI web debe generar **el mismo hex**.

### 3.1 Estructura de una condicional

```
INICIO_IF(1) + ENTRADA(1) + OPERADOR(1) + VALOR(2) + SALIDA(1) + ESTADO(2) + TIEMPO(2)
= 10 bytes
```

### 3.2 Tokens de control (1 byte, van sueltos en la lista)

| Token | Código | ¿Emitir en v1? | Uso |
|--------|--------|----------------|-----|
| INICIO_IF | `0x50` | Sí (cabeza de cada IF) | No se inserta a mano; lo pone el constructor |
| FIN IF | `0x51` | Sí | Cierra el bloque |
| IF | `0x52` | **No** | Reservado. Anidación no especificada |
| ELSE | `0x53` | Sí | Rama alternativa |

### 3.3 Entradas (lo que se compara) — factor ×10

| Nombre | Código | Unidad | Rango ingeniería | Campo seguimiento (INFO) |
|--------|--------|--------|------------------|---------------------------|
| Suministro | `0x10` | °C | −50 … 100 | `info.snapshot.supply_air_c` |
| Retorno | `0x11` | °C | −50 … 100 | `info.snapshot.return_air_c` |
| CO2 | `0x12` | % | 0 … 100 | `info.snapshot.co2_pct` |
| USDA1 | `0x13` | °C | −50 … 100 | `info.snapshot.usda1_c` |
| USDA2 | `0x14` | °C | −50 … 100 | `info.snapshot.usda2_c` |
| USDA3 | `0x15` | °C | −50 … 100 | `info.snapshot.usda3_c` |
| USDA4 | `0x16` | °C | −50 … 100 | `info.snapshot.usda4_c` |

No hay entrada de **humedad** ni de **setpoint** en esta tabla. Una regla “si humedad > 80” **no se puede** expresar con el protocolo actual. El operador debe saberlo.

`valor_raw = round(valor_ing × 10)`. 22.0 °C → 220.

### 3.4 Operadores

| UI | Código | Símbolo |
|----|--------|---------|
| IGUAL | `0x54` | `==` |
| IGUAL o MENOR | `0x55` | `<=` |
| IGUAL o MAYOR | `0x56` | `>=` |
| MENOR | `0x57` | `<` |
| MAYOR | `0x58` | `>` |

### 3.5 Salidas

| Nombre | Código | Tipo | Estado | Notas |
|--------|--------|------|--------|--------|
| RELAY1–10 | `0x20`–`0x29` | relay | 0 = ACTIVAR, 1 = DESACTIVAR | Invertido, igual que `SET_RELE` |
| MOTORES | `0x2A` | num | 0–100 % | No es `SET_POT` (otro nodo) |
| Inferior / Medio / Superior | `0x2B`–`0x2D` | compuerta | 1 = OPEN, 0 = CLOSE | Ajustable si el firmware discrepa |
| Setpoint | `0x2E` | num | 0–400 | **Décimas de °C** (220 = 22.0 °C). Distinto del `fp=100` de `Trama_Write` |

Nombres de relé en UI: los de `equivalencia2.md` / `/api/relay-labels` (libre, renovación, bypass, aire, agua…). El hex sigue siendo RELAY1=0x20.

### 3.6 Tiempo

| Modo | Codificación | Rango |
|------|--------------|--------|
| Duración | 2 bytes (BCD o HEX según modo) | 0 … 65534 s |
| Permanente | `FEFE` | El actuador no vuelve solo |

Tiempo `0` + no permanente: válido en el generador; efecto en firmware **no documentado** (¿pulso 0 = no hace nada?). La UI debe advertirlo.

### 3.7 Modo BCD vs HEX (campos de 2 bytes)

| Modo | 22.0 °C (×10=220) | −18.5 °C (×10=−185) |
|------|-------------------|---------------------|
| **DEC / BCD** | `0220` (dígitos decimales) | **Inválido** (BCD solo 0–9999) |
| **HEX** | `00DC` (uint16) | `FF47` (int16 complemento a 2) |

Implicación: consignas bajo cero **obligan HEX**. Si el operador deja BCD y pone −5 °C, el constructor debe **rechazar** (como el .py), no recortar a 0.

El modo es **del programa entero** (todas las reglas el mismo). Mezclar BCD y HEX en un mismo `PANTALLA_CMD` no está previsto.

Default v1: **BCD** si todos los raw ≥ 0; forzar HEX o bloquear si hay negativo.

---

## 4. Validación del programa (antes de encolar)

Rechazar o pedir confirmación:

| Caso | Acción |
|------|--------|
| Programa vacío | Rechazar |
| IF sin `FIN IF` | Advertir / rechazar en v1 (el firmware puede quedar abierto) |
| `ELSE` sin IF previo o dos ELSE | Rechazar |
| `FIN IF` de más | Rechazar |
| Token `0x52` | No ofrecer |
| BCD + valor_raw < 0 o > 9999 | Rechazar |
| Entrada/salida/operador fuera de tabla | Rechazar |
| Estado fuera de rango de esa salida | Rechazar |
| Tiempo no permanente fuera de 0–65534 | Rechazar |
| Hex de una condicional ≠ 10 bytes (20 nibbles) | Bug interno |
| Hex de token ≠ 2 nibbles | Bug interno |
| `i` vacío | Rechazar |
| Longitud total del `rs` | Advertir si > ~800 hex chars (tamaño de programa desconocido; no partir) |

Anidación: el generador permite `IF` + `ELSE` + `FIN IF` en secuencia plana. **No hay IF dentro de IF** documentado. v1: un nivel (lista lineal). Varios IF seguidos + un FIN: el .py lo permite; el significado (¿AND?, ¿varios bloques?) **no está en el material**. Casuística: tratar cada `50…` como bloque independiente hasta el `51` más cercano, y mostrar advertencia si hay más de un `50` sin `51` intermedio.

---

## 5. Implicancias con lo ya implementado

### 5.1 Cola y registro (obligatorio, mismas reglas)

`PANTALLA_CMD` entra a la colección `comandos` con `kind: pantalla_cmd`.

| Situación | Status | ¿Sale al socket? |
|-----------|--------|------------------|
| Sesión activa + equipo en línea | `queued` / `window_wait` | Sí, **una** ventana (V1 o V2) |
| Sin sesión / offline | `reference` | No. Caduca **2 h** |
| Enviado | `sent` | Queda en registro |
| Error bridge | `error` | Registro |
| TTL 2 h o cancelar / limpiar | `canceled` | Registro; cola limpia |

No crear una cola paralela que ignore ventanas. Un `PANTALLA_CMD` largo **bloquea** un turno de la cola de Comandos (FIFO compartida). Implicación: si hay un `Trama_Write` y un programa, salen en **ciclos distintos** (~30 s). Documentar en ambas UIs.

`origin: reglas` vs `origin: ui` para filtrar el registro.

Campos extra del ítem:

```
kind, rs, payload, label, program_id, program_hex, reglas[], modo (BCD|HEX),
i, addr, ip, session_id, status, enqueued_at, sent_at, window_used
```

`label` humano: primeras N descripciones, ej. `SI Suministro > 22 °C → RELAY1 ACTIVAR (5 s) + ELSE + FIN IF`.

### 5.2 Ventanas TX

Mismo detector (`RELAY001_DATA:` → V1, `INFO:` → V2, `_GET_` cierra).  
`PANTALLA_CMD` **no** abre ni cierra ventana. Es un payload más.

Riesgo: programa muy largo vs 3,5 s. Una línea JSON de unos cientos de bytes cabe; no hay evidencia de MTU del gateway. Si el send falla, `error` y no reenviar en la misma ventana.

### 5.3 Conflicto en actuadores

Tres escritores pueden tocar los mismos relés:

1. Programa `PANTALLA_CMD` (cíclico en el controlador).
2. `RELAY001_SET_RELE` desde Comandos (un disparo).
3. El maestro / otras lógicas internas.

Casuística a mostrar en UI:

- Cargar un IF “RELAY9 Aire ON si supply > 22” y luego un SET_RELE que apaga R9: el IF **puede volver a encenderlo** en el siguiente ciclo de pantalla.
- `SET_POT` y salida `MOTORES` (0x2A) **no son el mismo canal** hasta prueba.
- `Trama_Write(0,…)` (setpoint MP5000) vs salida `Setpoint` 0x2E (pantalla): **dos setpoints distintos** salvo que el firmware los una. No asumir equivalencia.

v1: banner de advertencia, no bloqueo. Opcional v2: al encolar `PANTALLA_CMD`, listar relés que el programa toca.

### 5.4 Valores actuales (didáctica)

El editor debe mostrar, junto a cada entrada, el **último INFO**:

| Entrada | Dato vivo |
|---------|-----------|
| Suministro / Retorno / CO2 / USDA1–4 | `GET /api/comandos/catalog` o `/api/seguimiento?kind=info` |

Y junto a cada relé de salida: estado ON/OFF del último `kind=relay` + nombre editable.

Así el umbral no se elige a ciegas (“supply ahora 24.1, umbral 22”).

No hay humedad en entradas: si INFO trae 80 % RH, **no** se puede usar como condición.

### 5.5 Homologación / POST estándar

`PANTALLA_CMD` **no** se homologa. `classify_frame` ignora `rs` sin `d0x`. Sin cambio.

### 5.6 Serial crudo

No es el camino de carga. El HEX suelto en Serial puede colisionar. La pestaña Reglas usa solo la cola.

---

## 6. Interfaz web (pestaña propia)

No reutilizar el formulario HEX ni mezclar con setpoints MP5000. Pestaña **Reglas** / **Condicionales**.

### 6.1 Bloques

1. **Estado vivo** — supply, return, CO₂, USDA, relés (igual espíritu que Comandos).
2. **Editor de una regla** — entrada, operador, valor (unidad + “ahora X”), salida, estado (combo o número), tiempo / permanente, modo BCD/HEX, **preview hex agrupado** en vivo (como el .py).
3. **Programa** — lista ordenada: descripción + hex. Subir / bajar / borrar. Botones ELSE y FIN IF.
4. **Trama final** — hex agrupado + JSON `PANTALLA_CMD`. Validación (balance IF/FIN).
5. **Encolar programa** — si online → cola; si no → referencia 2 h. Confirmación: “esto reemplaza el programa en la cámara”.
6. **Biblioteca** — guardar/cargar programas con nombre (Mongo `programas`), sin enviar.
7. **Registro** — filtro `kind=pantalla_cmd` sobre el historial de `comandos`.

### 6.2 Copia del generador tkinter (paridad)

Comportamiento a clonar para no divergir hex:

- Preview en rojo si el formulario es inválido; no se puede “Agregar”.
- Permanente deshabilita el spin de segundos y pone `FEFE`.
- Cambio de salida cambia el widget de estado (combo vs número).
- ID `i` y prefijo editables (default `POLLO_BEBE` / `PANTALLA_CMD:`). Prefijo libre solo para laboratorio; en producción fijar `PANTALLA_CMD:`.

### 6.3 Lo que el .py no tiene y TEST_4G sí debe

- Encolar / ventanas / TTL / registro (el .py solo copia al portapapeles).
- Relés con **nombres** de negocio.
- Umbral vs **valor actual**.
- Persistencia de programas entre sesiones de navegador.
- Confirmación de reemplazo del programa remoto.

---

## 7. Modelo de datos (cuando se implemente)

### 7.1 Programa (borrador)

```
programas: {
  program_id, i, name, modo, prefijo,
  reglas: [{ tipo: "if"|"else"|"endif", codigo, descripcion, campos… }],
  hex, rs, updated_at
}
```

### 7.2 Envío

Reutilizar `comandos` + `kind=pantalla_cmd` + `program_id`. No duplicar cola.

API prevista (no implementar aún):

| Método | Ruta | Rol |
|--------|------|-----|
| GET | `/api/reglas/catalog` | Tablas + valores actuales |
| POST | `/api/reglas/preview` | Valida y devuelve hex + JSON + errores |
| POST | `/api/reglas/programas` | Guardar borrador |
| GET | `/api/reglas/programas` | Listar |
| POST | `/api/comandos/enqueue` | `kind=pantalla_cmd`, `rs` ya construido |

El enqueue existente se **extiende** con `kind=pantalla_cmd` (no inventar `/send` directo).

---

## 8. Confirmación y operación

No hay ACK de `PANTALLA_CMD` en el material.

| Qué podemos ver | Qué no |
|-----------------|--------|
| `sent` en registro + TX en serial | Que el firmware aceptó el programa |
| Cambio de relés en el siguiente `RELAY001_DATA` **si** la condición ya se cumple | Distinguir eco del IF vs un SET_RELE |
| INFO no cambia por cargar un IF | Lectura del programa residente |

Prueba de aceptación (cuando exista hardware):

1. Programa mínimo: `SI Suministro > (actual−1) → RELAY1 ACTIVAR 5 s` + FIN IF.
2. Encolar en línea, esperar V1/V2, ver `sent`.
3. Observar bit RELAY1 en `RELAY001_DATA`.
4. Cargar programa vacío o FIN-only (si el firmware lo vacía) — **pendiente**; no enviar hex vacío.

---

## 9. Pendientes / trampas

1. **¿Reemplazo o append?** El generador solo emite un blob. Asumir reemplazo hasta prueba.
2. **Varios IF sin ELSE** — semántica AND/OR/secuencial desconocida.
3. **0x52 IF** — no usar.
4. **Compuertas OPEN/CLOSE** — el .py marca “ajustar si el firmware usa otros valores”.
5. **Setpoint 0x2E vs MP5000 idx 0** — escalas distintas (×10 vs ×100).
6. **MOTORES vs SET_POT** — nodos distintos.
7. **Tamaño máximo** del programa en el controlador.
8. **Humedad / SP** no son entradas.
9. **Negativos en BCD** — prohibidos.
10. **Conflicto IF local vs Comandos** — advertir, no serializar en un solo “plan”.
11. **Programa vacío** — no enviar `PANTALLA_CMD:` sin hex (efecto desconocido).
12. **Watchdog 12 s / offline** — igual que Comandos; no drenar referencias.

---

## 10. Criterios para implementar después (orden)

1. Extraer a `backend/reglas.py` las tablas y `Regla.condicional` / tokens (tests con el ejemplo `50105802202000000005` y el JSON del .py).
2. Extender `ComandoBody` + cola con `kind=pantalla_cmd` (mismas reglas online / referencia / 2 h / registro).
3. API preview + CRUD de `programas`.
4. Pestaña **Reglas**: editor + lista + preview + encolar + registro filtrado.
5. Banner de conflicto con relés y de “reemplaza el programa en cámara”.
6. No portar tkinter ni Docker X11; la GUI de escritorio queda como referencia de hex.

Hasta que esto exista, el operador puede seguir usando `generador_condicionales.py` y pegar el JSON en Serial **solo en laboratorio** (riesgo de colisión). En operación, el camino es esta pestaña + cola.
