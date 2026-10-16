# Página 12 — Get Application Information

Sección **4.2.4**. Sigue siendo telegrama de sistema (formato `02`), no el `82` de los sensores.

Si el equipo lo tiene implementado, puede mandarlo además de un pedido de información de aplicación. No sustituye a Get Product Information.

## 4.2.4.1 Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `02` |
| 1 | Command | `09` |
| 2 | Info type | `00` = versión de aplicación. Otro valor lo define la aplicación |

## 4.2.4.2 Respuesta

Se reconoce por formato `02` y reply `08`.

| Bytes | Campo | Tipo | Si no se usa |
|---|---|---|---|
| 0 | Format | `02` | |
| 1 | Reply | `08` | |
| siguiente | Version Type | 1 byte | Identifica de qué versión es el bloque |
| 2 | Version Major | palabra, LSB primero | `FF FF` |
| 2 | Version Minor | palabra, LSB primero | `FF FF` |
| 2 | Version Revision | palabra, LSB primero | `FF FF` |
| 2 | Version Build | palabra, LSB primero | `FF FF` |
| 1 | Release Year | BCD | `FF` |
| 1 | Release Month | BCD | `FF` |
| 1 | Release Day | BCD | `FF` |
| 1 | Release Version | BCD | `FF` |
| 4 | Subversion Revision | long, LSB primero | `FF FF FF FF` |

La tabla impresa numera Version Type como byte 1 y Version Major como bytes 2 y 3, mientras Format y Reply ya ocupan 0 y 1. Las filas se leen en ese orden, sin inventar un byte por el índice repetido: después de `02 08` va el tipo y luego las cuatro palabras.

LSB primero: el entero 300 viaja `2C 01`, no `01 2C`. Un campo en `FF FF` (o cuatro `FF` en la subversión) no es una versión enorme: es “sin dato”, igual que el `FF` de la página 8.

El año, el mes, el día y la versión de release son BCD de un byte, no las fechas `AAMMDDVV` de la página 10. `26` en el año es 2026. `FF` es año ausente.

## Qué hace la telemetría con esta página

- No entra en el ciclo de cada minuto. Si se pide, es una vez por conexión y con info type `00`.
- Una palabra `FF FF` se guarda como vacía, no como 65535.
- El `i` del JSON sigue siendo el IMEI del módem. Esta versión es la de la aplicación del controlador.
