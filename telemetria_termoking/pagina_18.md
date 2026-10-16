# Página 18 — Caption text readout

Sección **4.3.5**. Request 3. Es el rótulo del contenedor, no una temperatura.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `03` |
| 3 | Request `03` | |
| 3 … 13 | | Container ID, en caracteres |

La respuesta usa los bytes de dato 3 a 13 para el identificador. Son 11 caracteres, el largo de un número de contenedor (cuatro letras y siete dígitos). Se leen como texto, no como BCD ni como Fp.

No trae un cero final como el nombre de producto de la página 11. El tope es el byte 13. Si la trama llega más corta, valen solo los caracteres recibidos.

## No es el IMEI

| Identidad | De dónde sale | Ejemplo |
|---|---|---|
| IMEI | El módem lo antepone, en ASCII, antes de `FF FF FF FF` y del `1B 02` | `869387065275548` |
| Container ID | Este telegrama, dentro de la trama `82 A7 03` | el número pintado en el contenedor |
| Serie de hardware | Get Product Information, página 10, en BCD | año, semana y número de placa |

El JSON de cada minuto pone el IMEI en `i`. El container ID no entra en ese JSON hasta que se pida el request 3 y se guarde aparte. Mezclarlos haría que el mismo equipo cambie de `i` según quién contestó.

## Qué hace la telemetría con esta página

El ciclo actual no envía `82 A7 10 03`. Cuando haga falta el rótulo, se pide una vez por conexión, se toman los bytes 3 a 13 como texto y se dejan fuera de `d02` y `d03`.
