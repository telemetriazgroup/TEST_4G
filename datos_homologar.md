# Homologación POLLO → JSON estándar

Especificación para implementar el envío automático por POST del JSON estándar definido en `equivalencia.md`, a partir de cómo **realmente llegan** las tramas al sistema (muestra: `historico_hora_todos_2026-09-09_10_00_2026-09-09T21-05-04.json`).

Este documento **no implementa** el envío. Define qué se procesa, cuándo se dispara el POST y qué criterios se valoran.

---

## 1. Objetivo

Cada vez que un equipo envía por TCP **9911** una trama POLLO de datos (campos `d01`…`d05` con payloads `82A7xx`), el sistema debe:

1. Separar los JSON concatenados de esa recepción.
2. Identificar los bloques hex por **opcode** (`82A700`, `82A701`, `82A706`), no solo por el nombre del campo.
3. Construir el JSON **estándar**.
4. Enviarlo por **POST** al link configurado, **solo si** ese link está configurado y la recepción se comprobó.

El resto de tramas (`rs`, cabeceras TCP, TX) **no se envían**. Quedan en MongoDB como estado / histórico.

```
Dispositivo ──TCP:9911──► tcp_bridge ──► MongoDB (todas las tramas)
                              │
                              ▼ (solo trama POLLO de datos)
                         homologar → POST link configurado
```

JSON estándar a enviar:

```json
{
  "i": "POLLO_BEBE",
  "d01": "UNIT111",
  "d02": "<hex Sensor readout 82A700>",
  "d03": "<hex Control readout 82A701>",
  "d08": "<hex Alarm readout 82A706>"
}
```

---

## 2. Cómo llega la información (histórico real)

Fuente: export `historico_hora` del 2026-09-09 10:00 — **242 frames**, dispositivo `132.184.62.24:50601`, `session_id` `35a0a139-…`.

Cada registro persistido tiene:

| Campo | Uso para homologar |
|--------|--------------------|
| `direction` | Solo `rx`. TX no se homologa. |
| `value_type` | `hex` = payload útil. `tcp_header` = CONNECT/DISCONNECT, **ignorar**. |
| `ascii` / `text` | JSON POLLO en texto (misma información). **Esta es la fuente de parseo.** |
| `hex` | Misma trama en hex ASCII. No hace falta reconvertir si ya hay `ascii`. |
| `ts`, `addr`, `ip`, `session_id` | Trazabilidad del POST (log / reintento), no van en el JSON estándar. |

### 2.1 Un `recv` puede traer **varios JSON pegados**

El TCP no entrega un objeto por línea. En el histórico un solo frame (`frame_len` 574) llega así:

```
{"i":"POLLO_BEBE","d01":"...82A700...","d02":"...82A701...","d03":"...82A702...","d04":"...82A703...","d05":"...82A706..."}{"i":"POLLO_BEBE","rs":"MP5000_GET_INFO"}
```

También ocurre:

```
{"i":"POLLO_BEBE","rs":"MP5000_OK"}{"i":"POLLO_BEBE","rs":"MP5000_GET_INFO"}
```

`json.loads` sobre el `ascii` completo **falla**. Hay que **partir por `}{`** (o extraer objetos `{…}` balanceados) y parsear cada uno.

El bridge actual (`parse_chunks`) hace `json.loads(raw[start:end])` del primer `{` al último `}`: con concatenación eso **no produce un objeto válido**. La homologación debe usar su propio splitter.

### 2.2 Ciclo típico de una sesión (no todo es homologable)

Orden observado en el histórico:

| Tipo | Ejemplo ASCII | ¿POST estándar? |
|------|----------------|-----------------|
| Cabecera | `CONNECT ip:port → 9911` | No |
| Comando / status | `{"i":"POLLO_BEBE","rs":"RELAY001_GET_DATA"}` | No |
| Status | `{"rs":"MP5000_GET_DATA"}` | No |
| Status | `{"rs":"MP5000_OK"}` | No |
| Status | `{"rs":"MP5000_GET_INFO"}` | No |
| Status INFO | `{"rs":"INFO:24.6,23.5,…"}` | No |
| Status | `{"rs":"GEN001_GET_DATA"}` / `GEN002_GET_DATA"` | No |
| **Datos POLLO** | `{"i":"…","d01":"…","d02":"…",…}` | **Sí** (si hay opcodes requeridos) |
| Relé con datos | `{"rs":"RELAY001_DATA:46 49 0 1…"}` | No (fase 1) |

Los `rs` se guardan igual; sirven de estado del equipo. Solo el objeto con claves `d0x` dispara la homologación.

### 2.3 El nombre del campo POLLO **no es estable**

En `equivalencia.md` hay **dos formas** de llegar:

**Forma A (histórico 2026-09-09, la más frecuente):**

| Campo POLLO | Opcode en el hex | Significado |
|-------------|------------------|-------------|
| `d01` | `82A700` | Sensor readout (pág. 14) |
| `d02` | `82A701` | Control readout (pág. 16) |
| `d03` | `82A702` | IO readout (pág. 17) |
| `d04` | `82A703` | Caption text (pág. 18) |
| `d05` | `82A706` | Alarm readout (pág. 21) |

**Forma B (`integracion.md` / segunda muestra de `equivalencia.md`):**

| Campo POLLO | Opcode | Significado |
|-------------|--------|-------------|
| `d01` | `82A706` | Alarmas (no sensor) |
| `d02` | `82A701` | Control |
| `d03` | `82A702` | IO |
| `d04` | `82A703` | Caption |
| *(sin `d05`)* | — | El sensor `82A700` **puede no venir** |

Por eso **no se mapea `d01` POLLO → `d02` estándar a ciegas**. Se busca el substring de opcode en el valor hex (mayúsculas, sin espacios):

```
…1B02040000 82A700 … 1B04
…1B02040000 82A701 … 1B04
…1B02040000 82A706 … 1B04
```

Prefijo de bloque visto: `1B02040000` + opcode. Cierre típico: `1B04`.

---

## 3. Tabla de equivalencia (única fuente de verdad)

Mapeo **Estándar ← POLLO**, por opcode:

| Estándar | Origen | Regla |
|----------|--------|--------|
| `i` | `i` de la trama POLLO de datos | Identificador único (IMEI o alias, p. ej. `POLLO_BEBE`). Obligatorio. |
| `d01` | Estático | Siempre `"UNIT111"`. **No existe** en POLLO. |
| `d02` | Valor hex que contiene `82A700` | Sensor readout. Suele ser POLLO `d01` (forma A). |
| `d03` | Valor hex que contiene `82A701` | Control readout. Suele ser POLLO `d02`. |
| `d08` | Valor hex que contiene `82A706` | Alarm readout. Suele ser POLLO `d05` (forma A) o POLLO `d01` (forma B). |

Campos POLLO que **no van** en el POST de fase 1 (sí se pueden guardar como contexto interno):

| Opcode | POLLO típico | Uso interno |
|--------|--------------|-------------|
| `82A702` | `d03` | IO readout |
| `82A703` | `d04` | Caption (`LOSU…` en hex ASCII) |

Ejemplo construido desde el frame real `15:27:55.871Z`:

```json
{
  "i": "POLLO_BEBE",
  "d01": "UNIT111",
  "d02": "1B0204000082A700F600FE7FEB00FB00F200EA00FF7FEF00EF00F000F000F0004300FE7FFE7FFE7FC8013C00560055005600FE7FFE7F000064002003760F0000E2020000DEAF0C00FE7FFE7FF600EB00FE7F000034022000FE7FFF7FFE7FFE7FA9D51B04",
  "d03": "1B0204000082A701010098082D000304016302FE7FFE7FFE7F7D000807030000FFFFFFFFA07F1B04",
  "d08": "1B0204000082A70601003900FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFB3BB1B04"
}
```

El segundo objeto del mismo frame (`MP5000_GET_INFO`) se descarta para el POST.

---

## 4. Pipeline cada vez que llega una trama

Ejecutar **después** de persistir en MongoDB (no bloquear el socket 9911).

```
RX frame (hex/ascii)
  │
  ├─ direction != rx            → stop
  ├─ value_type == tcp_header   → stop
  ├─ ascii/text vacío           → stop
  │
  ▼
split_json_objects(ascii)          // }{  o llaves balanceadas
  │
  ▼
para cada objeto:
  ├─ solo tiene "rs"            → status, no POST
  ├─ no tiene i                 → inválido, log, no POST
  ├─ no tiene ningún d0x        → no es trama de datos, no POST
  │
  ▼
indexar valores hex por opcode (82A700 / 82A701 / 82A706)
  │
  ├─ falta 82A700 y 82A701      → incompleta: no POST (ver §5)
  │
  ▼
payload = { i, d01:"UNIT111", d02?, d03?, d08? }
  │
  ├─ HOMOLOGATE_URL vacío       → no POST, log "sin destino"
  │
  ▼
POST JSON al link configurado
  │
  ├─ 2xx                        → ok, marcar enviado
  └─ error / timeout            → cola de reintento (no borrar la trama)
```

### 4.1 Splitter de JSON concatenados

Regla mínima suficiente para el histórico actual:

1. Tomar `ascii` o `text`.
2. Reemplazar `}{` por `}\n{` y parsear línea a línea; **o** escanear `{` / `}` con contador.
3. Ignorar objetos que no sean `dict`.
4. Normalizar hex: `value.upper().replace(" ", "")` antes de buscar opcode.

### 4.2 Dónde engancharlo

Punto natural: backend, al recibir `POST /api/internal/telemetry` (ya persistió el mensaje). Así:

- El monitor / histórico no cambia.
- El POST externo es asíncrono (task / cola).
- Un fallo del destino no corta la recepción TCP.

No reenviar desde el frontend. El histórico solo sirve para **comprobar** y, más adelante, reprocessar a mano si hace falta.

---

## 5. Aspectos que se valoran para implementar

### Disparo (qué sí / qué no)

| Criterio | Valoración |
|----------|------------|
| Solo RX | Cabeceras y TX no disparan. |
| Solo objeto con `d0x` | Un `rs` solo nunca arma el estándar. |
| Opcode, no nombre de campo | `d01` puede ser sensor o alarma. |
| Completitud mínima | POST si hay `i` + al menos `82A700` **o** el par `82A701`+`82A706` según política (ver abajo). |
| `d01` estándar siempre `UNIT111` | Constante de configuración, no leída del equipo. |
| Destino obligatorio | Sin URL configurada no se envía nada. |
| Recepción comprobada | El frame ya está en Mongo (`messages`) antes del POST. |

**Política de completitud recomendada (fase 1):**

- **Enviar** si existen `i` + `82A700` (`d02`) + `82A701` (`d03`).
- `d08` (`82A706`) es **opcional**: si no viene, omitir la clave o no enviar según lo que exija el receptor. En el histórico forma A **sí viene**; en forma B el alarma está en `d01` y el sensor puede faltar.
- Si solo hay alarma (`82A706`) sin sensor: **no enviar** en fase 1 (log `incompleta`). Evita un POST con `d02` vacío.

### Configuración

| Variable | Rol |
|----------|-----|
| `HOMOLOGATE_URL` | Endpoint POST. Vacío = desactivado. |
| `HOMOLOGATE_UNIT` | Default `UNIT111` (`d01` estándar). |
| `HOMOLOGATE_TIMEOUT_S` | Timeout HTTP (p. ej. 5 s). |
| `HOMOLOGATE_ENABLED` | Kill-switch sin borrar la URL. |

Un solo destino en fase 1. El body es **solo** `{ i, d01, d02, d03, d08 }` — sin `ts`, `ip` ni `session_id` (el receptor espera el formato de `equivalencia.md`).

### Confiabilidad

- El POST **no** debe fallar el `insert` en Mongo.
- Reintentos con backoff (p. ej. 3 intentos). Si sigue fallando: cola / flag `homologate_status: pending|ok|error`.
- No borrar tramas originales. Homologar es un **envio derivado**.
- Idempotencia: un mismo `session_id` + hash del payload estándar no debe POSTear dos veces en pocos segundos (el equipo a veces reenvía el mismo bloque).

### Observabilidad

Registrar por cada intento: `ts`, `i`, opcodes hallados, URL (host), HTTP status, error, `message` id. Sin eso no se puede auditar “se recepcionó pero no se envió”.

### Fuera de fase 1

- Decodificar bytes de páginas 14–21 (temperaturas, alarmas, caption).
- Integrar `RELAY001_DATA` / `INFO:` a otra API.
- Reenviar histórico ya guardado (batch) — útil, pero segundo paso.
- Varios destinos POST.

---

## 6. Criterios de aceptación

1. Un frame como el de `15:27:55.871Z` produce **exactamente un** POST con `i=POLLO_BEBE`, `d01=UNIT111`, `d02` = hex `82A700`, `d03` = hex `82A701`, `d08` = hex `82A706`.
2. El `MP5000_GET_INFO` pegado en el mismo `ascii` **no** genera un segundo POST.
3. Frames solo-`rs` y `tcp_header` no generan POST.
4. Si `HOMOLOGATE_URL` no está configurado, no hay tráfico saliente; las tramas siguen guardándose.
5. Si el POST falla, la trama permanece en histórico y queda trazada como error/pendiente.
6. Forma B (`d01` = `82A706`): `d08` se llena desde ese valor; no se copia `d01` POLLO a `d02` estándar.

---

## 7. Relación con archivos del repo

| Archivo | Aporte |
|---------|--------|
| `equivalencia.md` | Contrato del JSON estándar y tabla Estándar ↔ POLLO. |
| `integracion.md` | Ciclo de `rs` vs trama de datos; primera instancia = solo enviar `d0x`. |
| Histórico `historico_hora_todos_2026-09-09_10_00_*.json` | Forma real de llegada: concat `}{`, `value_type=hex`, opcodes en forma A. |
| `contexto.md` | Persistencia previa; el POST es un paso extra, no reemplaza el monitor. |
