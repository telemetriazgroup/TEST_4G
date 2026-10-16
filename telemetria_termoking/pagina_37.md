# Página 37 — Night time y madurador

Sección **4.3.21**. Dos comandos. El primero es el silencio nocturno, subcomando `8A`. El segundo, que sigue en la página 38, es el madurador, subcomando `8C`.

El párrafo de introducción repite el texto del tratamiento de frío. El dataset que viene debajo es el de silencio. Existe desde la versión de software del MP-4000 posterior a la 3.19. Pedido y respuesta comparten formato. En la respuesta, el bit 7 del byte 0 del dataset va en 1. Un entero de 16 bits viaja con el byte bajo primero.

## Silencio nocturno

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `8A` |
| 3 en adelante | Data | El dataset |

| Byte | Qué es | Cómo se lee |
|---:|---|---|
| 0 | Acción | Ver la tabla. En la respuesta, más el bit 7 |
| 1–2 | Pausa de la maquinaria | Minutos. 0 = no hay pausa. Es de una sola vez |
| 3 | Operación silenciosa | 0 apagada, 1 encendida |
| 4–5 | Hora de inicio del silencio | Ranuras de 5 minutos desde la medianoche |
| 6–7 | Hora de fin del silencio | La misma unidad |
| 8 | Nivel de silencio | 0 = no definido |
| 9 | Máquina detenida | Solo en la respuesta. 0 normal, 1 en silencio o parada |
| 10 | Respuesta | Solo en la respuesta. 0 correcto, 1 error de rango |

### Acción (byte 0)

| Valor | Qué pide |
|---:|---|
| `00` | Devolver estado y ajustes |
| `01` | Configurar la operación silenciosa y contestar el estado |
| `02` | Configurar la pausa de maquinaria y contestar el estado |
| `03` | Desactivar todo |

La hora de inicio y la de fin no son un reloj `hhmm`. Cada unidad son 5 minutos del día. El valor 0 es medianoche. El 12 es la 01:00, porque 12 × 5 minutos son 60. Un día completo cabe en 288 ranuras.

La pausa del byte 1–2 para la maquinaria durante esos minutos y no se repite sola. Cero la deja inactiva. El byte 9 es de solo lectura: dice si ahora mismo la unidad está en silencio o parada.

## Madurador

Sección **4.3.21.2**, identificador `82 A7 8C`. Formato `82`, función `A7`. Existe desde la versión 3.30 incluida, y solo si la opción está seleccionada en el equipo. El dataset sigue en la página 38.

| Byte | Qué es | Cuándo vale |
|---:|---|---|
| 0 | Acción | 0 devolver estado y ajustes. 1 cargar los parámetros y permitir la marcha. En la respuesta, más el bit 7 |
| 1 | Estado | Solo en la respuesta |
| 2 | Respuesta | Solo en la respuesta. 0 correcto. Cualquier otro valor es error |
| 3–4 | Opción de madurador | 0 no habilitada, 1 habilitada. `FFFF` no cambia el campo |

### Estado (byte 1)

| Valor | Estado |
|---:|---|
| 0 | No definido |
| 1 | No es una opción de este equipo |
| 2 | No permitido |
| 3 | No activo |
| 4 | En marcha, esperando el retardo |
| 5 | En marcha, inyectando |
| 6 | Inyectando, pero el frío de la unidad no está activo |

`FFFF` en un campo de ajuste significa “dejarlo como está”. No es una lectura.

## Qué hace la telemetría con esta página

Ni el `8A` ni el `8C` van en el minuto. La acción 0 de cada uno solo lee. De la 1 en adelante cambian silencio, pausa o inyección. La telemetría no pausa la maquinaria ni habilita el madurador.
