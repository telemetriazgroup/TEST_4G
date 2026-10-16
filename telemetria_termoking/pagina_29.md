# Página 29 — Do Calibrate

Sección **4.3.16**. Es una escritura. Pide al controlador que calibre.

## Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `83` |

No lleva qué sonda ni qué valor. El controlador decide el procedimiento. El `82` de la página 28 suelta la calibración; este `83` la ejecuta.

## Respuesta

El controlador no contesta. El resultado no viaja en este telegrama. Si más adelante cambia un offset, se ve al leer otra vez el request 5.

## Qué hace la telemetría con esta página

No se envía al conectar ni dentro del minuto. Una calibración disparada por el enlace 4G alteraría las temperaturas de carga que después se grafican. Si un operador la pide, queda como comando aparte, y la comprobación es la lectura posterior de la configuración.
