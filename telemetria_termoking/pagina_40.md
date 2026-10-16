# Página 40 — Firmware update epilog

Sección **4.4.3**. Cierra la carga abierta en la página 39. Mismo formato `01`.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `01` | Format `01` |
| 1 | Command `42` | ACK o NAK |

| Byte de respuesta | Significado |
|---|---|
| `06` | La carga terminó y el controlador la dio por válida |
| `15` | La validación falló |

El `42` no lleva dirección ni bloque de código. Llega después del último `45` que contestó `06`. El controlador revisa entonces lo que recibió.

Un `06` aquí no es el “listo para el siguiente” del paquete. Es el cierre: la actualización quedó completa. Un `15` es un error de validación. El prólogo también usa `15`, pero allí significa que ni siquiera iba a empezar. En el epílogo significa que la carga no pasó la comprobación.

## Qué hace la telemetría con esta página

No se envía, igual que el `41` y el `45`. La versión de firmware que la telemetría puede mostrar es la que se lee en la página 23, request 8, no la que se grabaría con esta secuencia.
