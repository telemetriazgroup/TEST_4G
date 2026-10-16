# Página 43 — Retrieve log data by index

Sección **4.5.3**. Otro camino al registro. No baja el archivo LogView de las páginas 41 y 42. Pide registros por índice.

## Rango de índices

El pedido es comando `19`, subcomando `30`. No lleva datos.

La respuesta se reconoce por `82 19 31`.

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 3–6 | Índice más antiguo | Entero de 32 bits, byte bajo primero |
| 7–10 | Índice más nuevo | Entero de 32 bits, byte bajo primero |

El más antiguo es el primero que el controlador todavía guarda. El más nuevo es el último que agregó. Un pedido de datos tiene que caer entre los dos.

## Un tramo

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `19` |
| 2 | Sub Command | `32` |
| 3–6 | Index | Entero de 32 bits. Índice por el que se empieza |
| 7–8 | Max size | Entero de 16 bits, byte bajo primero. Tope de bytes de la respuesta |

La respuesta se reconoce por `82 19 33`.

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 3–6 | Primer índice | El primero que se pidió, 32 bits, byte bajo primero |
| 7–10 | Último índice | El último que entró en este telegrama |
| 11–12 | Byte count | Cuántos bytes trae el campo de datos, 16 bits, byte bajo primero |
| 13 en adelante | Data | Los registros |

El primer y el último índice dicen qué tramo vino. Si el último no llegó al más nuevo, el siguiente pedido arranca en el índice que sigue.

El formato de cada registro no está en este manual. La página lo remite a la especificación de log del MP-4000. Con este documento solo se puede guardar el bloque, no traducirlo a temperaturas.

## Qué hace la telemetría con esta página

No va en el minuto. El historial que ya se grafica sale de las lecturas en vivo, no de este índice. Si más adelante se baja el log, primero se leen el índice viejo y el nuevo con el `30`, y cada tramo se pide con el `32` sin pasarse del max size.
