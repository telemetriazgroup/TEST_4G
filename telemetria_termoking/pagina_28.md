# Página 28 — Release Calibration

Sección **4.3.15**. Es una escritura. Suelta la calibración que el controlador tenga tomada.

## Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `82` |

No lleva datos. El subcomando `82` no es una lectura: las lecturas usan `10` y un número de request.

## Respuesta

El controlador no contesta. No hay acuse de que la calibración haya quedado libre. Los offsets de las sondas de carga siguen leyéndose con el request 5 de la página 20.

## Qué hace la telemetría con esta página

No se envía. Soltar la calibración desde el servidor movería la referencia de las sondas sin aviso. El minuto sigue siendo solo el request 0 y el request 1.
