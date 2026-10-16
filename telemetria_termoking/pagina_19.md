# Página 19 — Trip information readout

Sección **4.3.6**. Request 4. Fecha y hora en que empezó el viaje.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `04` |
| 3 | Request `04` | |
| 3 … 8 | | Inicio del viaje, seis bytes |

## Los seis bytes

Van en orden `YY MM DD HH mm ss`, cada uno en BCD. El año 2002 es el byte `02`; el siglo es 2000.

| Byte | Campo | Rango BCD |
|---|---|---|
| 3 | Año | 00–99 |
| 4 | Mes | 01–12 |
| 5 | Día | 01–31 |
| 6 | Hora | 00–23 |
| 7 | Minuto | 00–59 |
| 8 | Segundo | 00–59 |

`26 10 16 14 05 00` es 2026-10-16 14:05:00. Cada byte se lee como dos dígitos hexadecimales, no como entero: `16` es el día 16, no el día 22.

Esta hora es el arranque del viaje dentro del controlador. No es la hora en que el módem abrió el TCP ni la hora del POST. El `fecha` del JSON de Enviadas sigue siendo el instante en que llegó la trama.

Si un byte cae fuera de su rango, o la trama no trae los seis, ese inicio de viaje no se publica. No se completa con la hora del servidor.

## Qué hace la telemetría con esta página

El request 4 no se manda en el minuto de sensores y control. Sirve para rotular el viaje cuando se pida aparte: la respuesta se reconoce por `82 A7 04` y los bytes 3 a 8 se convierten de BCD a fecha. Las temperaturas de ese viaje siguen saliendo del `d02`.
