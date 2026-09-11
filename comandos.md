# Comandos al equipo (MP-5000 y RELAY001)

Especificación de la casuística para **probar y enviar** comandos por la misma conexión TCP 9912. Este documento **no implementa** el envío. Define ventanas del bus, cola, constructor de tramas, UI y criterios de confirmación.

Fuentes: manual de ventanas TX del bus POLLO, referencia de escritura MP5000/RELAY001, `equivalencia2.md` (INFO / RELAY_DATA) y el seguimiento ya decodificado.

---

## 1. Objetivo

Hoy el monitor puede mandar bytes crudos (`POST /api/send` → `tcp_bridge` → socket). Eso **no es seguro** en este bus: el maestro RS485 recorre una rejilla fija y cualquier TX fuera de una ventana libre **colisiona**.

Se necesita:

1. Una **interfaz de comandos** que muestre el valor actual (pantalla / control / equipo) y el valor a escribir.
2. Un **constructor** que arme el JSON `{ "i", "rs" }` con el `fp` correcto.
3. Una **cola**: si hay varios comandos, se ejecuta **uno por cada ventana libre**.
4. Un **disparador de ventana** anclado a la última trama RX, no a un reloj absoluto.

```
UI constructor ──► cola comandos ──► espera ventana TX ──► TCP 9912 ──► gateway ──► RS485
                         ▲
                         └── confirmación = releer INFO / RELAY_DATA / 82A701
```

El POST de homologación (`d01`–`d08` estándar) **no entra** aquí. Son procesos distintos.

---

## 2. Transporte

| Tramo | Qué viaja |
|--------|-----------|
| UI → backend | JSON de comando + metadatos (idx, valor, origen) |
| Backend → `tcp_bridge` | El mismo sobre, encoding **string** + **CRLF** (cada trama POLLO es una línea) |
| Gateway → RS485 | El contenido de `rs`; el prefijo elige el esclavo (`MP5000_`, `RELAY001_`) |

Sobre único:

```json
{ "i": "POLLO_BEBE", "rs": "<PREFIJO>:<cuerpo o comando>" }
```

`i` es el identificador de cámara (hoy `POLLO_BEBE`), no el nodo. El gateway no añade fecha/hora.

Presupuesto de TX por ventana: **3,5 s**. Si el comando no cabe, no se parte: se espera la siguiente ventana.

---

## 3. Ventanas del bus (cuándo se puede transmitir)

El maestro recorre **6 slots de ~5,05 s** → ciclo **~30,3 s**. Dentro de cada ciclo hay **tres huecos** (V1, V2, V3) donde la plataforma puede transmitir sin pisar al maestro.

Dispara la transmisión **la trama de respuesta**, nunca la de consulta. Una trama con `_GET_` significa que el maestro tomó el bus: **cerrar TX al instante**.

Medido con GEN001/GEN002 desconectados (ciclo 09:22:20–09:25:32, 5 ciclos):

```
slot 1  RELAY001_GET_DATA → RELAY001_DATA:     ~5,13 s   V1 libre tras la respuesta
slot 2  MP5000_GET_DATA → d0x / OK / GET_INFO / INFO:   ocupado (~4,6–5,2 s)
slot 3  (silencio hasta GEN001)                ~4,88 s   V2 libre tras INFO:
slot 4  GEN001_GET_DATA → timeout              ~5,06 s   no es ventana
slot 5  GEN002_GET_DATA → timeout              ~5,06 s   no es ventana
slot 6  (sin dueño)                            ~5,27 s   V3 libre
```

### 3.1 Ventanas aprovechables

| Ventana | Disparo (RX) | Duración típica | Notas |
|---------|----------------|-----------------|--------|
| **V1** | `RELAY001_DATA:` | **5,13 s** (mín ~4,87) | La más amplia y estable. RELAY responde ~7 ms después del GET. |
| **V2** | `INFO:` | **4,88 s** (mín ~4,83) | Cierra el bloque MP5000. Silencio hasta `GEN001_GET_DATA`. |
| **V3** | timeout de `GEN002_GET_DATA` + ~5,2 s **o** slot 6 sin dueño | **5,27 s** | Sin dispositivo asignado. Si GEN002 vuelve y contesta, el hueco se encoge. |

Presupuesto operativo dentro de la ventana: **3,5 s** de TX + guarda ~1,3 s.

### 3.2 Tramas que NO abren pausa

No encolar/disparar TX al ver estas:

| Trama RX | Por qué |
|----------|---------|
| `RELAY001_GET_DATA` | Consulta. La respuesta llega en ~7 ms; no hay margen. |
| `MP5000_GET_DATA` | Consulta. El maestro espera al MP5000 4,58–5,15 s (slot más largo). |
| `d01` / `d02` / `d03` / `d04` / `d05` | Van en el mismo paquete que `MP5000_GET_INFO`. |
| `MP5000_OK` | Concatenado con `MP5000_GET_INFO`, no es fin de transmisión. |
| `GEN001_GET_DATA` / `GEN002_GET_DATA` | Timeout de ~5,06 s si el generador está desconectado; no es inicio de TX real. |

### 3.3 Intervalos medidos (referencia)

| Desde | Hasta | Promedio | Estado |
|--------|--------|----------|--------|
| `RELAY001_DATA:` | `MP5000_GET_DATA` | 5,13 s | **Libre (V1)** |
| `MP5000_GET_DATA` | `d0x` / `MP5000_OK` | 4,91 s | Ocupado |
| `d0x` / `OK` | `MP5000_GET_INFO` | ~0 s | Mismo paquete |
| `MP5000_GET_INFO` | `INFO:` | 0,01 s | Ocupado |
| `INFO:` | `GEN001_GET_DATA` | 4,88 s | **Libre (V2)** |
| `GEN001_GET_DATA` | `GEN002_GET_DATA` | 5,06 s | Timeout |
| `GEN002_GET_DATA` | `RELAY001_GET_DATA` | 10,33 s | Timeout + slot 6 (**V3**) |
| `RELAY001_GET_DATA` | `RELAY001_DATA:` | 0,008 s | Ocupado |

### 3.4 Si GEN001 / GEN002 vuelven a la red

El ciclo **no se acorta ni se alarga** (~30,3 s). Los slots 4 y 5 dejan de ser silencio y pasan a transmisión real.

- **V1 y V2 no se tocan** (siguen ancladas a `RELAY001_DATA:` e `INFO:`).
- **V3 no desaparece** (slot 6 sigue sin dueño).
- Pueden aparecer **V4 / V5** tras la respuesta de cada generador (tamaño según latencia; presupuesto ~3,5 s, no se gana un ciclo extra).
- Recalcular por sesión: si el periodo deja de ser ~30,3 s, avisar y no usar tiempos fijos.

### 3.5 Reglas del disparador (socket)

1. Separar JSON concatenados (`}{`). Un `json.loads` del primer `{` al último `}` pierde el disparo.
2. Ordenar por ventana; **no enviar a mitad de un slot ocupado**.
3. No hardcodear lista de dispositivos. V1/V2 solo necesitan la **última respuesta**.
4. Watchdog: **>12 s sin trama** → sesión caída. Cerrar TX hasta ver una trama y resincronizar.
5. Remedir en cada sesión. GEN001/GEN002 en línea cambian slots 4 y 5.

Pseudológica (constantes medidas):

```
SLOT = 5.05 s
GUARDA = 1.3 s
MIN_TX = 0.5 s

al recibir rs:
  etiqueta = rs.split(":", 1)[0]          # RELAY001_DATA / INFO / MP5000_GET_DATA …

  si "_GET_" en etiqueta:                 # maestro tomó el bus
      cerrar_tx()
      slot_inicio = ahora
      return

  si slot_inicio es None:                 # respuesta huérfana
      resincronizar; cerrar_tx(); return

  restante = SLOT - (ahora - slot_inicio) - GUARDA
  si restante > MIN_TX:
      abrir_tx(hasta = ahora + restante)  # V1 hoy; V2 tras INFO; V3 slot 6
```

Una consulta (`_GET_`) **nunca** abre ventana. Una respuesta (`_DATA:` / `INFO:`) sí, hasta el próximo slot.

---

## 4. Cola de comandos

Varios comandos **no se mandan en ráfaga**. Se encolan y sale **uno por ventana libre**.

| Campo | Uso |
|--------|-----|
| `queue_id` | Id interno |
| `i` | Cámara (`POLLO_BEBE`) |
| `addr` / `ip` / `session_id` | Socket destino |
| `rs` | Comando ya construido |
| `payload` | JSON `{i, rs}` a escribir en el socket |
| `kind` | `mp5000_write` · `relay_set` · `relay_pot` · `raw` |
| `origin` | `ui` · `test` |
| `label` | Texto humano (ej. «Setpoint temperatura → 22.0 °C») |
| `expected` | Valor pedido (para confirmar luego) |
| `status` | `queued` · `window_wait` · `sent` · `confirmed` · `unconfirmed` · `error` · `canceled` |
| `window` | `V1` / `V2` / `V3` / `any` (preferencia; default `any` = primera libre) |
| `enqueued_at` / `sent_at` / `confirmed_at` | Trazas |
| `error` | Motivo si falla |

Reglas:

1. FIFO. Un solo envío en vuelo por `addr`.
2. **Solo se encola para envío si el equipo está en línea y hay sesión activa.** Si no, el constructor guarda un comando de **referencia** (`reference`): no viaja por el socket.
3. Referencias, `queued` y `window_wait` **caducan a las 2 horas** (`canceled` / `expired_2h`). La cola queda limpia; el registro histórico permanece.
4. Al abrir ventana: sacar cabeza de cola → `send` string+CRLF → marcar `sent`.
5. Si la ventana se cierra antes de enviar: el comando **sigue en cola** (no se pierde).
6. Si el socket se cae: no drenar. Sin sesión no se promueve referencia a cola.
7. Reintentos: **no** reenviar el mismo comando en la misma ventana. Siguiente ciclo.
8. Cancelar: solo si `queued`, `window_wait` o `reference`. `sent` ya viajó.
9. **Registro completo** de todos los comandos (referencia, cola, enviado, error, cancelado).
10. Confirmación (ver §7) es asíncrona y **no bloquea** el siguiente comando de la cola.

Persistir la cola en Mongo (como la de homologación) para sobrevivir un restart del backend.

---

## 5. Interfaz (qué debe mostrar y hacer)

Espacio propio (pestaña **Comandos**), no el recuadro HEX del serial. El serial crudo se mantiene para depuración; **no** es el camino de escritura al bus.

### 5.1 Identificar valor actual + valor a modificar

La UI no pide al operador que recuerde índices. Parte del **último seguimiento** de esa cámara:

| Bloque | Fuente | Para qué |
|--------|--------|----------|
| Pantalla local | `kind=info` (`INFO:`) | Lo que ve el display: supply, return, SP temp, USDA, CO₂, humedad, SP CO₂, SP humedad |
| Control relés | `kind=relay` (`RELAY001_DATA`) | 10 relés (nombres editables) + 4 pot + humedad / SP humedad del módulo |
| Equipo MP-5000 | `kind=mp5000` (`82A701` / sensores) | Setpoints, modos, alarmas, contenedor |

Cada fila editable:

1. Nombre del parámetro.
2. **Estado actual** (último JSON de seguimiento).
3. Campo **nuevo valor** (unidad de ingeniería, no el entero escalado).
4. Botón **Encolar** → el sistema elige índice, `fp` y arma `rs`.

Ejemplo: pantalla INFO dice SP 22.0 °C → el operador pone 20.3 → se encola

```json
{"i":"POLLO_BEBE","rs":"MP5000_Trama_Write(0,20.3,100)"}
```

### 5.2 Constructor visible

Antes de encolar se muestra la trama resultante (JSON + `rs`) y, si aplica, el entero escalado (`20.3 × 100 = 2030`). El operador confirma.

Acciones peligrosas (PTI, reset, restart, pause) piden **confirmación explícita** extra.

### 5.3 Cola en pantalla

Lista: posición, etiqueta, `rs`, estado, ventana usada, hora de envío, confirmación (sí/no/pendiente). Acciones: cancelar pendientes, pausar/reanudar cola.

### 5.4 Prueba / laboratorio

Modo «texto libre» (JSON `rs` a mano) **solo** entra a la misma cola y al mismo disparador de ventana. Nunca `send` inmediato al socket, salvo un interruptor explícito de emergencia (fuera de alcance de la v1).

---

## 6. Sintaxis de escritura

### 6.1 MP5000 — `Trama_Write`

```
{"i":"POLLO_BEBE","rs":"MP5000_Trama_Write(<idx>,<valor>,<fp>)"}
```

| Pieza | Significado |
|--------|-------------|
| `i` | ID de cámara (11 chars en la trama RS485, bytes 0..10) |
| `MP5000_Trama_Write` | Esclavo + comando |
| `idx` | 0..38 |
| `valor` | Unidades reales (20.3 °C, no 2030) |
| `fp` | Factor. El gateway hace `valor × fp` → int32 little-endian |

`fp` no es decorativo. Pasarlo mal escala el setpoint ×100.

El campo en el bus es **32 bit LE**. Negativos en complemento a dos: −18.0 °C × 100 = −1800 → `F8 F8 FF FF`.

#### Ejemplos verificados

| idx | Qué | Valor | fp | `rs` | Escalado | Bus (LE) |
|-----|-----|-------|----|------|----------|----------|
| 0 | Temperature set point | 20.3 °C | 100 | `MP5000_Trama_Write(0,20.3,100)` | 2030 | `EE 07 00 00` |
| 0 | Temperature set point | −18 °C | 100 | `MP5000_Trama_Write(0,-18,100)` | −1800 | `F8 F8 FF FF` |
| 1 | Defrost termination | 8 °C | 100 | `MP5000_Trama_Write(1,8,100)` | 800 | `20 03 00 00` |
| 4 | Humidity set point | 65 % | 100 | `MP5000_Trama_Write(4,65,100)` | 6500 | `64 19 00 00` |
| 5 | Fresh air exchange | 45 cmh | 1 | `MP5000_Trama_Write(5,45,1)` | 45 | `2D 00 00 00` |
| 6 | Defrost interval | 21600 s | 1 | `MP5000_Trama_Write(6,21600,1)` | 21600 | `60 54 00 00` |
| 23 | Water cooled condenser | 1 (ON) | 1 | `MP5000_Trama_Write(23,1,1)` | 1 | `01 00 00 00` |
| 29 | Turn On | 1 | 1 | `MP5000_Trama_Write(29,1,1)` | 1 | `01 00 00 00` |
| 30 | Pause unit | 300 s | 1 | `MP5000_Trama_Write(30,300,1)` | 300 | `2C 01 00 00` |

#### Mapa de índices (0–38)

| idx | Qué hace | Tipo | fp | Unidad | UI v1 | Nota |
|-----|----------|------|----|--------|-------|------|
| 0 | Temperature set point | SET POINT | 100 | °C | Sí | Valor actual: INFO / 82A701 |
| 1 | Defrost termination set point | SET POINT | 100 | °C | Sí | 82A701 |
| 2 | O2 set point | SET POINT | 100 | % | Sí | 82A701 |
| 3 | CO2 set point | SET POINT | 100 | % | Sí | INFO + 82A701 |
| 4 | Humidity set point | SET POINT | 100 | % | Sí | Ver idx 35. Actual: INFO / RELAY |
| 5 | Fresh air exchange set point | SET POINT | 1 | cmh | Sí | |
| 6 | Defrost interval time | SET POINT | 1 | s | Sí | |
| 7 | Internal use only | INTERNO | — | — | **No** | No escribir |
| 8 | Humidity mode | MODO | 1? | enum | Diferido | fp/enum no en esta hoja |
| 9 | Fresh air exchange mode | MODO | 1? | enum | Diferido | 0=off, 1=units, 2=demand (lectura) |
| 10 | Controlling Mode | MODO | 1? | enum | Diferido | Ver unit mode §5.1 |
| 11 | Fresh air exchange delay | MODO | 1? | s | Diferido | |
| 12 | Activate Trip Start | ACCIÓN | — | — | Confirmar | Sin parámetros en la hoja |
| 13 | Set Controller time | MODO | 1 | — | No | Formato 32 bit por confirmar |
| 14 | Start Function Test | ACCIÓN | — | — | Confirmar | |
| 15 | Start PTI | ACCIÓN | — | — | Confirmar | |
| 16 | Start Brief PTI | ACCIÓN | — | — | Confirmar | |
| 17 | Start Chilled PTI | ACCIÓN | — | — | Confirmar | |
| 18 | Start AFAM+ PTI | ACCIÓN | — | — | Confirmar | |
| 19 | Start RH PTI | ACCIÓN | — | — | Confirmar | |
| 20 | Start Probe Test | ACCIÓN | — | — | Confirmar | |
| 21 | Start Defrost | ACCIÓN | — | — | Confirmar | |
| 22 | Start Extended Defrost | ACCIÓN | — | — | Confirmar | |
| 23 | Water Cooled Condenser | SET POINT | 1 | 0/1 | Sí | 0=OFF, 1=ON |
| 24 | GoTo Normal Operation | ACCIÓN | — | — | Confirmar | |
| 25 | Set Container Id | TEXTO | — | — | No | `Trama_Write` numérico no cubre texto |
| 26 | Acknowledge alarm number | SET POINT | 1 | nº | Sí | |
| 27 | Internal use only | INTERNO | — | — | **No** | |
| 28 | Internal use only | INTERNO | — | — | **No** | |
| 29 | Turn On / Off | SET POINT | 1 | 0/1 | Sí | Botón frontal |
| 30 | Pause / Stop machinery | SET POINT | 1 | s | Confirmar | |
| 31 | Accept PTI / GoOn | TEXTO | — | — | No | Nombre operador |
| 32 | Save SmartPTI | TEXTO | — | — | No | |
| 33 | Save text to Log | TEXTO | — | — | No | |
| 34 | Internal use only | INTERNO | — | — | **No** | |
| 35 | Humidity set point (rhCtrl) | SET POINT | 100 | % | Diferido | rhCtrl debe estar ON. Probar vs idx 4 |
| 36 | Acknowledge PTI / SmartPTI | ACCIÓN | — | — | Confirmar | Junto a 37/38 |
| 37 | Reset Power Meter | ACCIÓN | — | — | Confirmar | |
| 38 | Reset/Restart Controller | ACCIÓN | — | — | Confirmar | Un dígito de 37: confirmación extra |

**UI v1** = constructor + valor actual + encolar.  
**Confirmar** = visible pero con diálogo de riesgo.  
**Diferido** = no cablear hasta tener enum/prueba.  
**No** = oculto.

#### Trampas MP5000

- **idx 4 vs 35**: ambos son humidity set point. El 35 exige `rhCtrl` ON. Antes de fijar uno, escribir y releer INFO / 82A701.
- **Negativos**: el constructor debe enviar el valor real con signo; el gateway escala. Verificar complemento a dos bajo cero.
- **Sin parámetros** (12, 14–22, 24, 36–38): la hoja no dice qué poner en `valor` y `fp`. No inventar `(idx,0,1)` en producción hasta probarlo.
- **Texto** (25, 31–33): otro comando de gateway; no usar `Trama_Write`.
- **Internos** (7, 27, 28, 34): prohibidos aunque el constructor los acepte.
- **No hay ACK de escritura**. `MP5000_OK` responde a `GET_DATA`, no a `Trama_Write`.

### 6.2 RELAY001 — relés

Lógica **invertida**: `0` = encendido (bobina), `1` = apagado. Diez dígitos, **izquierda = relé 1**.

El comando lleva **guion bajo final**; `Trama_Write` no:

```
{"i":"POLLO_BEBE","rs":"RELAY001_SET_RELE(1111111110)_"}
```

| Estado deseado | String | `rs` |
|----------------|--------|------|
| Todos apagados | `1111111111` | `RELAY001_SET_RELE(1111111111)_` |
| Solo relé 10 ON | `1111111110` | `RELAY001_SET_RELE(1111111110)_` |
| Solo relé 1 ON | `0111111111` | `RELAY001_SET_RELE(0111111111)_` |
| Relés 1 y 2 ON | `0011111111` | `RELAY001_SET_RELE(0011111111)_` |
| Todos ON | `0000000000` | `RELAY001_SET_RELE(0000000000)_` |

La UI trabaja con nombres (`equivalencia2.md`), no con el string crudo:

| Relé | Nombre predeterminado | Bit (izq→der) |
|------|------------------------|---------------|
| 1 | libre | pos 1 |
| 2 | libre | pos 2 |
| 3 | renovacion de aire off | pos 3 |
| 4 | renovacion de aire on | pos 4 |
| 5 | Act on bypass | pos 5 |
| 6 | Act off inferior / salida de gases off | pos 6 |
| 7 | Act on inferior / salida de gases on | pos 7 |
| 8 | Act off bypass | pos 8 |
| 9 | Aire | pos 9 |
| 10 | Agua | pos 10 |

Al encolar un relé: partir del **eco actual** (`RELAY001_DATA`, 10 bits invertidos) → cambiar solo ese bit → armar el string de 10. No mandar un patrón que apague el resto por error, salvo que el operador elija «reemplazar los 10».

Nombres editables: mismos que `/api/relay-labels`.

### 6.3 RELAY001 — analógicas 0–10 V

```
{"i":"POLLO_BEBE","rs":"RELAY001_SET_POT(<n>)_"}
```

`n` = entero **0..1000** en décimas de por ciento. Escala lineal a 10 V.

| n | Salida | Tensión |
|---|--------|---------|
| 0 | 0,0 % | 0,00 V |
| 250 | 25,0 % | 2,50 V |
| 500 | 50,0 % | 5,00 V |
| 750 | 75,0 % | 7,50 V |
| 1000 | 100,0 % | 10,00 V |

La UI pide **voltios** o **%** y convierte: `% = V × 10`, `n = % × 10` → `n = V × 100`. Ejemplo: 3,00 V → 300.

**Pendiente (bloquea v1 de 4 canales):** `SET_POT` recibe **un** entero, pero `RELAY001_DATA` trae **cuatro** tensiones distintas. No está documentado si mueve las 4 juntas o hay direccionamiento por canal. Hasta la prueba de §8, la UI puede encolar `SET_POT` como ensayo de un canal único y mostrar las 4 lecturas al confirmar.

---

## 7. Confirmación (sin ACK)

No asumir que `sent` = aplicado.

| Comando | Releer en el ciclo siguiente | Criterio |
|---------|------------------------------|----------|
| `Trama_Write` idx 0, 1, 2, 3, 4, 5, 6, 23, 29, 30 | `INFO:` y/o `82A701` | El campo decodificado ≈ valor pedido (tolerancia de fp) |
| `SET_RELE` | `RELAY001_DATA` | 10 bits (0=ON) coinciden con el string enviado |
| `SET_POT` | `RELAY001_DATA` (4 pots) | Ver qué canal(es) cambiaron; documentar el resultado |

Estados: `sent` → (siguiente INFO/RELAY/mp5000) → `confirmed` o `unconfirmed`. La cola **no espera** confirmación para sacar el siguiente comando.

`MP5000_OK` **no** cuenta como ACK de escritura.

---

## 8. Pendientes (el material no cierra)

Cada ítem tiene la prueba que lo resuelve. Hasta entonces, no darlo por cerrado en código de producción.

1. **¿SET_POT mueve 4 salidas o 1?**  
   Enviar `SET_POT(300)_` en V1 y mirar el siguiente `RELAY001_DATA`. Si las 4 pots ~3,0 V → mando único. Si cambia una → hay canal sin documentar.

2. **¿Los 10 bits de RELAY_DATA son eco de salidas?**  
   Enviar `SET_RELE(1111111110)_` y luego `SET_RELE(0111111111)_`. Si el bloque 0/1 sigue el patrón → eco. Si no se mueve → son entradas y no se lee el relé de vuelta (la UI no podrá confirmar por DATA).

   *Nota:* las tramas actuales ya vienen como `1 0 1 …` (diez 0/1). Eso encaja con eco de relés. La duda del manual (`46 50 0 1…`) es un formato viejo o mal partido; no mezclarlo con el parser de `equivalencia2.md`.

3. **¿Hay ACK de Trama_Write?**  
   Escribir un setpoint distinto y comparar `d01`–`d04` / `82A701` / `INFO:` del ciclo siguiente. Confirmación = releer.

4. **fp y enumerados de modos (8, 9, 10, 11) y disparadores.**  
   Están en otra sección del manual MP5000. El constructor puede dejar pasar el número; no validar rango hasta tener la tabla.

---

## 9. Qué no hace esta fase

- No envía el JSON estándar de homologación.
- No escribe índices internos (7, 27, 28, 34) ni texto (25, 31–33).
- No usa el formulario HEX del serial como camino de consignas.
- No dispara TX al ver `_GET_` ni a mitad del slot MP5000.
- Implementación v1: pestaña Comandos, constructor, cola/referencia, ventanas V1/V2, registro y TTL 2 h.

---

## 10. Criterios para implementar después

Cuando se implemente, en este orden:

1. **Detector de ventana** en el puente o backend: parsea RX, abre/cierra TX (V1/V2/V3), watchdog 12 s.
2. **Cola persistente** + worker: un comando por ventana → `send` string+CRLF al `addr` seleccionado.
3. **Constructor** (tablas de §6) + API `POST /api/comandos/enqueue`.
4. **UI Comandos**: valor actual desde `/api/seguimiento`, preview de `rs`, cola, estados.
5. **Confirmación** por el siguiente `info` / `relay` / `mp5000` de la misma `i`.
6. Pruebas de §8 (SET_POT, eco de relés) y entonces habilitar esos controles en producción.

Dispositivo destino: la sesión TCP ya seleccionada (misma regla que el serial). Sin dispositivo conectado la cola no drena.
