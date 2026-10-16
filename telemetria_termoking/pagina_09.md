# Página 9 — Telegramas: compatibilidad y sistema

Secciones **4**, **4.1** y **4.2**.

## 4.1 Cómo crece un telegrama

Con el tiempo un telegrama puede alargarse o acortarse. Lo que ya estaba definido no cambia de sitio: lo nuevo se agrega **al final**.

Al interpretar hay que usar solo la longitud que llegó:

- Si el bloque trae más bytes que la tabla vieja, los primeros siguen significando lo mismo y el sobrante es información nueva.
- Si el bloque trae menos bytes que la tabla, la posición que no vino **no es válida**, aunque el manual la tenga descrita. No se rellena con cero ni con el último valor bueno.

Eso explica las respuestas de sensor que traen pares `FE 7F` de más al final del mapa publicado: son extensión o reserva, y el decodificador las acepta sin mover los campos anteriores. Si un día llega una respuesta corta, los sensores que caerían más allá del último byte recibido se omiten; no se inventan.

La longitud que manda es la del DATA entre el subcomando y el CRC, después de quitar el relleno `1B 1B` y de comprobar el CRC. Un corte a mitad de trama no se completa con el ciclo anterior.

## 4.2 Telegramas de sistema

Son otra familia, distinta del formato `82` de la página 8. El equipo los implementa según lo complejo que sea. Dos obligaciones:

| Quién | Qué tiene que contestar |
|---|---|
| Todo nodo que pueda descargar aplicación | Get Product Information |
| Todo nodo | Software Reset |

Get Product Information es el ejemplo de la página 7 (`02 01`). Sirve para saber revisión de hardware, serie, versión de aplicación y si está corriendo el boot o la aplicación. El detalle está en la página 10.

Software Reset reinicia el controlador. El detalle está en la página 11. No forma parte del ciclo de lectura: un reset corta la sesión y no aporta temperaturas.

## Qué hace la telemetría con esta página

- Decodificar cada respuesta con el largo real. Un byte que no llegó no se publica.
- Dejar los campos nuevos al final del mapa, sin correr los anteriores.
- El ciclo de cada minuto sigue siendo solo los dos pedidos `82 A7 10`. Get Product Information puede pedirse aparte, una vez por conexión, si hace falta identificar hardware. Software Reset no se envía desde la telemetría.
