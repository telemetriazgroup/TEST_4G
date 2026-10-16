# Página 24 — Information C

Sección **4.3.11**. Request 9. Existe a partir de la versión de software del CM-4000 posterior a la 3.11. Resume el último ensayo que arrancó el controlador. La respuesta se reconoce por `82 A7 09`.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `09` |
| 3 | Request `09` | Dataset |

Un equipo anterior a esa versión no contesta este pedido. La ausencia de respuesta no se toma como “no hay ensayo”.

## Mapa

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 0–5 | Inicio del último ensayo | Seis bytes `YY MM DD hh mm ss` |
| 6–7 | Tipo de ensayo | Entero de 16 bits, byte bajo primero |
| 8–9 | Resultado | Entero de 16 bits, byte bajo primero |
| 10–15 | Fin del último ensayo | Seis bytes, el mismo orden |

El manual avisa que el bloque puede crecer por el final si agregan campos. Lo que no llegó no se inventa.

Las fechas siguen el arreglo de las páginas 19 y 23. Un bloque en cero es un ensayo que el equipo no registró.

### Tipo (bytes 6–7)

| Valor | Ensayo |
|---:|---|
| 0 | PTI |
| 1 | PTI breve |
| 2 | Prueba de función |
| 3 | PTI AFAM |
| 4 | PTI de humedad |
| 5 | PTI de refrigerado |
| `FFFF` | Sin definir |

`FFFF` no es un sexto tipo. Es “no hay tipo”.

### Resultado (bytes 8–9)

| Valor | Significado |
|---|---|
| `FFFF` | No se conoce |
| `FFFE` | Sigue en curso |
| `FFFD` | Aprobado |
| Cualquier otro | Número de la alarma por la que no pasó |

Ese número es el de la alarma, el mismo que los bits 0–11 de la página 21. No se confunde con `FFFD`: aprobado no es una alarma. Mientras el resultado sea `FFFE`, la fecha de fin todavía no cierra el ensayo.

## Qué hace la telemetría con esta página

El request 9 no entra en el minuto. Se pide al conectar, y solo se publica si llegó la respuesta `82 A7 09`. El PTI smart de la página 23 es otro registro: allí está el estado guardado y los días de validez; aquí está el último ensayo que efectivamente arrancó.
