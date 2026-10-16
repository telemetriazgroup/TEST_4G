# Página 35 — MTS command and reply

Sección **4.3.20**. Ajuste multi-temperatura. Existe desde la misma versión que el tratamiento de frío, posterior a la 3.19. Pedido y respuesta se reconocen por el subcomando `89`. El formato de los enteros es el de la página 34: byte bajo primero.

La tabla sigue en la página 36, en el paso que está corriendo y en el código de respuesta.

## Pedido y respuesta

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `89` |
| 3 en adelante | Data | Acción, estado y diez pasos |

En la respuesta, el bit 7 del byte 0 del dataset va en 1, igual que en el `88`.

## Cabecera

| Bytes | Qué es | Cuándo vale |
|---:|---|---|
| 0 | Acción | Siempre |
| 1 | Estado del multi-temperatura | Solo en la respuesta |
| 2 | Subestado | Solo en la respuesta. No está definido |

### Acción (byte 0)

| Valor | Qué pide |
|---:|---|
| 0 | Devolver estado y ajustes |
| 1 | Cargar los parámetros adjuntos. No arrancar |
| 2 | Arrancar con los parámetros adjuntos |
| 3 | Arrancar con los que ya están. Los adjuntos se ignoran |
| 4 | Parar. Los ajustes se ignoran |
| 5 | Aceptar. Los ajustes se ignoran |

No hay acción 6. El cierre con temperatura final y rampa es solo del tratamiento de frío.

### Estado (byte 1)

| Valor | Estado |
|---:|---|
| 0 | No definido |
| 1 | No es una opción |
| 2 | No permitido: hay un tratamiento de frío en marcha |
| 10 | Sin acción |
| 11 | Pendiente de arranque |
| 12 | Activo |
| 13 | Terminado, falta aceptar |
| 14 | Terminación aceptada |
| 15 | Pendiente de parada |

El 15 no existe en el tratamiento de frío. El 2 es el cruce inverso al de la página 34: si el frío por lote está activo, el multi-temperatura no arranca. Tampoco son los códigos del byte 6 de la página 22.

## Los diez pasos

Cada paso ocupa cuatro bytes: temperatura en Fp10 °C y periodo en horas. Empiezan en el byte 3.

| Paso | Temperatura | Periodo |
|---:|---|---|
| 1 | 3–4 | 5–6 |
| 2 | 7–8 | 9–10 |
| 3 | 11–12 | 13–14 |
| 4 | 15–16 | 17–18 |
| 5 | 19–20 | 21–22 |
| 6 | 23–24 | 25–26 |
| 7 | 27–28 | 29–30 |
| 8 | 31–32 | 33–34 |
| 9 | 35–36 | 37–38 |
| 10 | 39–40 | 41–42 |

Fp10 se divide entre 10. El periodo usa la misma regla que el tratamiento de frío: horas, un día son 24, de 1 hora a 31 días.

Un periodo 0 marca el último ajuste y a partir de ahí no vence: es infinito. El periodo del paso 10 tiene que ser 0, porque no hay paso 11. Un 0 en un paso anterior corta el programa ahí. Los pasos que siguen no se ejecutan.

## Qué hace la telemetría con esta página

No se envía en el ciclo. El paso que la unidad dice estar cumpliendo, en el request 7, es un solo byte. Esta trama es el programa completo de diez temperaturas. Leerla sería la acción 0. Cargar o arrancar un programa no sale del enlace de telemetría.
