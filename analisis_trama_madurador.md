# Análisis de tramas del madurador

Fuente: `archivo_dia_todos_2026-11-12_2026-11-12T03-57-18.json` (día UTC 2026-11-12, 6864 tramas, equipo `185.166.245.59`). Horas en America/Lima. El valor que se controla es el campo 12 de `PGet` (índice 11, el que en el ejemplo vale `119.5`).

## Qué hace el código hoy

La homologación de `backend/homologate.py` no arma el JSON de `conexion_api.md` con estas tramas.

- Pide `d01` (`82A700`) y `d02` (`82A701`) dentro del mismo JSON. En este archivo eso no ocurre ni una vez: cada opcode llega en su propio RX.
- Ese JSON ni siquiera es JSON válido. El separador es punto y coma: `"d02";"1B02..."`. Hay 1993 tramas así. `PGet` sí usa dos puntos.
- El `i` del JSON interno es `MAD000`. El identificador que pide el enlace es el IMEI que va delante, `869387065279607` (6823 tramas).
- `d3` sale fijo, si es que sale. No se lee el campo 12 de `PGet`.
- `HOMOLOGATE_URL` en este compose está vacío, así que no hay POST. La cola y `_post_standard` sí están, pero no reciben un grupo de 20 s.
- No hay panel ni lazo que envíe `RELE(1,N)_` según un objetivo. Los 37 TX de este archivo son manuales.

Un grupo real, de `19:00:18` a `19:00:40`, cabe en 22 s y se repite cada ~35 s (mediana 35.5 s):

```
Server_Get
PGet
PPM:114.6
Server_Get
{"i":"MAD000","d02";"…82A701…"}
{"i":"MAD000","d03";"…82A702…"}
{"i":"MAD000","d01";"…82A700…"}
{"i":"MAD000","d05";"…82A706…"}
{"i":"MAD000","d04";"…82A703…"}
{"i":"MAD000","rs":"PGet:21.5,…,114.6,…"}
PPM:114.7
```

Todas llevan el prefijo `869387065279607`. El JSON a enviar, con este grupo, sería:

```json
{
  "i": "869387065279607",
  "d1": "<hex de d01, contiene 82A700>",
  "d2": "<hex de d02, contiene 82A701>",
  "d3": "1 32516 1051 0 0 0 114.6",
  "d4": "UNIT111"
}
```

`PGet` trae siempre 38 números. El que reemplaza el `0.0` final de `d3` es el duodécimo: índice 11.

## Cómo se mueve el valor

Sin inyección baja solo, del orden de 0.3 a 0.7 por minuto. De 19:00 a 19:24 pasó de 114.9 a 96.8 (−0.73/min). De 21:02 a 21:24, de 123.5 a 110.8 (−0.60/min).

Hay 13 lecturas falsas entre 910 y 920 (915.8, 919.8, 911.9, 912.3, 916.7, 913.0, 911.4…). Duran una muestra y la siguiente vuelve al nivel real. No son el gas. `PPM:` a veces copia ese salto y a veces copia el nivel bueno; no sirve como lazo.

Esas muestras no se usan. `LevelGuard` en `backend/homologate.py` las descarta al guardar el RX, y deja en la trama `level` (el valor que sigue) y `level_raw` (lo que llegó). La regla es:

- Cualquier lectura mayor de 350 es errónea. Ahí caen los picos de ~900.
- Con dos muestras buenas ya hay pendiente. Si la nueva se aleja más de 15 por cada 35 s de esa pendiente, también es errónea.
- La corrección no es cero ni el tope: es el número que la pendiente anticipaba. El salto real más grande de este día fue +7.8, así que una dosis no se confunde con un pico.
- Si el pico llega antes de tener pendiente, se ignora y no arranca la serie.

| Hora | Inicio | Fin | Qué pasó |
|---|---:|---:|---|
| 19 | 114.9 | 118.8 | Caía hasta 95.4. Cuatro `RELE(1,5)_` y un `RELE(1,10)_` la subieron a ~126 y luego aflojó |
| 20 | 118.8 | 122.9 | Varios `N=3` casi no movieron ~117. A las 20:17 sí subió. `N=5` y `N=10` la sacaron de 109 |
| 21 | 123.2 | 118.8 | Sin dosis bajó hasta 106. `N=15` y `N=10` la llevaron a 126 y volvió a caer |
| 22 | 118.2 | 131.4 | Dosis chicas la sostuvieron. El salto a 133 es el paquete de las 22:38, no una sola orden |

## Efecto de RELE(1,N)_

La subida no se ve en la muestra siguiente (~35 s). Se mide a los 2 y 5 minutos, ignorando los picos de 900. `RELE(1,3)_` no suma 2 de forma fija: a veces no mueve y, cuando el nivel venía cayendo, a los 5 minutos suma cerca de 2.

| Hora | Orden | Base | +2 min | +5 min |
|---|---|---:|---:|---:|
| 19:24:58 | RELE(1,5)_ | 96.8 | +2.0 | +17.3 |
| 19:25:33 | RELE(1,5)_ | 95.4 | +3.4 | +18.7 |
| 19:26:15 | RELE(1,5)_ | 95.4 | +7.3 | +24.3 |
| 19:27:03 | RELE(1,5)_ | 97.3 | +9.8 | +23.6 |
| 19:28:31 | RELE(1,10)_ | 102.7 | +11.4 | +21.1 |
| 19:53:55 | RELE(1,2)_ | 117.9 | +1.2 | +1.2 |
| 19:54:15 | RELE(1,2)_ | 117.9 | +1.2 | +1.2 |
| 20:02:19 | RELE(1,3)_ | 117.5 | 0.0 | −0.8 |
| 20:06:22 | RELE(1,3)_ | 117.2 | +0.3 | +0.3 |
| 20:11:18 | RELE(1,3)_ | 117.6 | +0.3 | +0.5 |
| 20:17:02 | RELE(1,3)_ | 117.5 | +2.3 | +3.5 |
| 20:17:13 | RELE(1,3)_ | 117.5 | +2.3 | +3.5 |
| 20:40:48 | RELE(1,5)_ | 110.1 | +0.3 | +7.8 |
| 20:41:51 | RELE(1,10)_ | 109.4 | +6.7 | +9.8 |
| 20:55:27 | RELE(1,10)_ | 118.1 | +3.1 | +5.1 |
| 21:02:47 | RELE(1,2)_ | 123.7 | +0.4 | +0.4 |
| 21:24:43 | RELE(1,2)_ | 110.8 | −0.9 | −1.9 |
| 21:33:52 | RELE(1,15)_ | 106.1 | +5.0 | +15.1 |
| 21:36:21 | RELE(1,10)_ | 111.1 | +8.1 | +13.6 |
| 22:00:29 | RELE(1,2)_ | 118.2 | −0.6 | +0.4 |
| 22:02:21 | RELE(1,3)_ | 117.9 | +0.6 | +2.1 |
| 22:05:15 | RELE(1,5)_ | 118.5 | +1.5 | +2.7 |
| 22:23:04 | RELE(1,10)_ | 114.4 | +3.2 | +4.4 |
| 22:38:17 | RELE(1,20)_ | 115.7 | +7.2 | +14.0 |
| 22:45:07 | RELE(1,2)_ | 130.2 | +1.2 | +3.1 |

Las filas de las 19:24 a 19:28 se pisan: el +17 de la primera ya incluye las dosis que vinieron detrás. Lo mismo el `N=15` de las 21:33 con el `N=10` de las 21:36.

Lectura usable, cuando la dosis va sola:

- `N=2` suma alrededor de 1, o nada si el nivel ya está alto y cayendo (21:24).
- `N=3` suma 0 a 2 en cinco minutos. El caso 22:02 (+2.1) se parece a la regla «3 s ≈ +2». El de las 20:02 no.
- `N=5` solo (20:40, base 110) suma ~8 a los 5 minutos. Repetido sobre 96 empuja más de 20 porque se acumula.
- `N=10` solo suma entre 5 y 10 a los 5 minutos.
- `N=15` (21:33) suma ~15 a los 5 minutos, y sigue subiendo porque a los 2.5 min entra otro `N=10`.
- `N=20` (22:38) no está solo: un minuto antes salieron `RELE(2,60)` y `RELE(3,40)`. El +14 es del paquete.

`RELE(2,N)` y `RELE(3,N)` no se pueden separar del relé 1 en este archivo, salvo el cierre: a las 22:49, con el nivel en 133, `RELE(2,300)_` y `RELE(3,280)` no lo subieron (−0.1 y −1.6 a los 5 minutos). El equipo contestó `SET_RELE c -> N OK` en los tres canales.

Para un objetivo de 130, el 2 % es 2.6, así que el lazo tendría que mirar 127.4. En este día el nivel solo cruzó 127 después de las 22:41, ya con dosis grandes encima, y se quedó entre 131 y 133. El lazo tiene que leer `level`, no el crudo: un 915 no debe contar como que el objetivo ya se pasó.
