# Página 26 — Set container ID

Sección **4.3.13**. Es una escritura. Cambia el identificador del contenedor que después leen las páginas 18 y 25.

## Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `80` |
| 3–13 | Container ID | El texto nuevo, en caracteres |

El subcomando ya no es `10`. `10` pide una lectura; `80` escribe el rótulo. Los bytes 3 a 13 son once caracteres, el mismo largo del container ID.

## Respuesta

El controlador no contesta. No hay `82 A7` de vuelta, ni un código de aceptado o rechazado. Quien envía esto no puede saber, por este telegrama, si el texto quedó grabado. La única comprobación es volver a leer el request 3 o el request `20`.

## Qué hace la telemetría con esta página

No se envía. El ciclo de cada minuto solo lee sensores y control. Escribir el rótulo desde el servidor cambiaría el número pintado en el equipo sin que el controlador avise. Si alguna vez se usa, es un comando explícito de un operador, con los once caracteres ya revisados, y después una lectura para confirmar.
