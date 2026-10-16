# Página 39 — Firmware update

Sección **4.4**. Deja de ser el telegrama de lecturas. El formato pasa de `82` a `01` y el comando ya no es `A7`. Sirve para grabar software en el controlador.

## Prólogo

Sección **4.4.1**. Avisa que va a empezar una carga.

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `01` | Format `01` |
| 1 | Command `41` | ACK o NAK |

| Byte de respuesta | Significado |
|---|---|
| `06` | El controlador está listo para la actualización |
| `15` | No está listo |

Sin un `06` no hay carga. Un `15` la deja sin empezar.

## Paquetes

Sección **4.4.2**. La carga es una serie de telegramas, uno por uno y en orden. El que envía espera la respuesta antes del siguiente. No se adelanta un paquete.

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `01` |
| 1 | Command | `45` |
| 2–5 | Address | Entero de 32 bits. Dirección donde empieza este bloque |
| 6 en adelante | Data | El bloque de código a guardar |

| Byte de respuesta | Significado |
|---|---|
| `06` | Listo para el paquete siguiente |
| `15` | El controlador no está listo, o la dirección está fuera de rango |

La página no dice el orden de los cuatro bytes de la dirección. No se asume el byte bajo primero de las lecturas `A7`.

Un `15` a mitad de la serie corta el avance. El paquete que lo recibió no se da por grabado y no se manda el siguiente encima.

## Qué hace la telemetría con esta página

No se envía. El minuto sigue siendo el request 0 y el request 1, formato `82`. Un `41` o un `45` en la sesión TCP intentaría reescribir el software del controlador. No hay comando de operador en la telemetría que abra esta secuencia.
