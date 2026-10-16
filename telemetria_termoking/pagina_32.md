# Página 32 — Respuesta del Do Set

Sección **4.3.17.2**. Cierra la escritura de las páginas 30 y 31. El Do Set sí contesta. La respuesta se reconoce por `82 A7 85`.

## Respuesta

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Reply | `A7` |
| 2 | Sub Reply | `85` |
| 3 en adelante | Data | Resultado y el índice que se intentó |

El pedido era el subcomando `84`. La contestación sube un número, a `85`. No se confunde con una lectura `82 A7 10`.

## Dataset

| Bytes | Qué es |
|---:|---|
| 0 | Resultado |
| 1–2 | Índice, el mismo entero de 16 bits del pedido, byte bajo primero |

### Resultado (byte 0)

| Valor | Qué pasó |
|---|---|
| `00` | Aceptado |
| `01` | El ID del contenedor no es el de esta unidad |
| `02` | No permitido: bloqueado |
| `03` | No permitido |
| `04` | Se dejó pasar; hay que reintentar más tarde |
| `11` | Índice fuera de rango |
| `12` | Índice no permitido con esta configuración |
| `13` | Índice no permitido en este estado |
| `14` | Índice desconocido |
| `20` | Valor fuera de rango |
| `21` | Valor con formato incorrecto |
| `22` | Valor por encima del tope |
| `23` | Valor por debajo del mínimo |
| `24` | Valor o texto demasiado corto |
| `25` | Valor o texto demasiado largo |

Solo el `00` graba el cambio. El `04` no es un fallo definitivo: el controlador pide otro intento. El `01` sale cuando los once caracteres del pedido no coinciden con el rótulo de la unidad. Los códigos `2x` rechazan el valor; los `1x` rechazan el índice.

## Qué hace la telemetría con esta página

El ciclo no envía el `84`, así que esta respuesta no aparece en el minuto. Si un operador dispara un Do Set, el registro del comando espera `82 A7 85` y publica el texto del byte 0. Sin esa trama no se da el cambio por hecho: las páginas 26 a 29 no contestan, pero esta sí.
