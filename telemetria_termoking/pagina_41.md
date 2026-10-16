# Página 41 — Prepare log file

Sección **4.5.1**. Empieza la bajada del registro interno. Ya no es el comando `A7` de las lecturas: el comando es `19` y el formato sigue siendo `82`.

Este pedido no trae el log. Le dice al controlador que arme el archivo y con qué límites. Los bloques salen con la página 42.

## Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `19` |
| 2 | Sub Command | `20` |
| 3 | File type | `00`, formato LogView |
| 4–5 | Message Length | Entero de 16 bits. Largo máximo de cada paquete |
| 6–9 | File Length | Entero de 32 bits. Largo máximo del archivo |
| 10 | Log type | `00` todos los datos. `01` desde el inicio de viaje hacia adelante |

El tipo `01` arranca en el primer archivo interno que ya incluye el inicio de viaje. Lo anterior no entra en esa bajada.

El largo de mensaje y el largo de archivo son topes que pone quien pide. No son el tamaño real. Ese tamaño lo contesta el controlador.

## Respuesta

Se reconoce por `82 19 21`.

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 3–6 | Largo del archivo | Entero de 32 bits, byte bajo primero |
| 7 en adelante | Nombre del archivo | Texto terminado en `00` |

Ese largo es el que hay que juntar con los bloques siguientes. El nombre se corta en el primer cero. No se rellena ni se trata como el container ID.

## Qué hace la telemetría con esta página

No va en el minuto. El ciclo publica sensores y control, no el archivo LogView. Preparar el log es una descarga aparte: primero este `20`, y solo con el largo y el nombre de la respuesta se piden los bloques.
