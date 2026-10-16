# Página 38 — Madurador, continuación

Sigue la sección **4.3.21.2**. El resto del dataset del subcomando `8C`, a partir del byte 5. Los enteros de 16 bits van con el byte bajo primero.

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 5–6 | Control de la inyección de etileno | 0 apagado, 1 encendido. `FFFF` no cambia el campo |
| 7–8 | Consigna de inyección | Entero, ppm. `FFFF` se ignora |
| 9–10 | Retardo antes de inyectar | Entero, horas. `FFFF` se ignora |
| 11–12 | Duración de la inyección | Entero, horas. `FFFF` se ignora |
| 13–14 | Lectura de etileno | Solo en la respuesta. Entero, ppm. Vale de 0 a 1000. Fuera de eso es error |
| 15 | Pedido de inyectar | 0 apagado. Cualquier otro valor permite la inyección |

El control del byte 5–6 es el interruptor de la función. La consigna es la concentración buscada, en partes por millón. El retardo y la duración están en horas enteras, no en las ranuras de 5 minutos del silencio nocturno.

La lectura de los bytes 13–14 solo viene en la respuesta. No se escribe. Si el valor cae fuera de 0 a 1000, no se publica como concentración: es un error de rango.

El byte 15 no es un entero de 16 bits. Es un solo byte al final del bloque. Cero niega la inyección. Un valor distinto de cero la autoriza. No hace falta que sea 1.

`FFFF` en los campos de ajuste, igual que en la opción de la página 37, deja el valor que el controlador ya tenía. Sirve para cambiar un solo parámetro sin reescribir los demás.

## Qué hace la telemetría con esta página

Estos bytes completan la respuesta `82 A7 8C`. El ciclo no la pide. La lectura de ppm, si alguna vez se consulta con la acción 0, sale de los bytes 13–14 y solo dentro de 0 a 1000. Activar la inyección es la acción 1 de la página anterior y no sale por el enlace de telemetría.
