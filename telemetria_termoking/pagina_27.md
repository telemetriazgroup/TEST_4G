# Página 27 — Set Trip Start

Sección **4.3.14**. Es una escritura. Marca en el controlador el inicio de un viaje nuevo, la fecha que después devuelve el request 4 de la página 19.

## Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `81` |

No lleva fecha. El controlador toma su propio reloj en el momento en que recibe el subcomando `81`.

## Respuesta

El controlador no contesta. Igual que en la página 26, no hay acuse. Para saber si el viaje quedó marcado hay que leer otra vez el request 4 y comparar los seis bytes BCD con la hora anterior.

## Qué hace la telemetría con esta página

No se envía al conectar ni dentro del minuto. Un `81` abre un viaje nuevo y mueve el “último inicio de viaje” de la página 23. El arranque de la sesión TCP no es el arranque del viaje. Si un operador lo dispara a propósito, queda registrado como comando, y la confirmación es la lectura posterior del request 4.
