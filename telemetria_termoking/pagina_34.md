# Página 34 — CT command and reply

Sección **4.3.19**. Tratamiento de frío. Existe desde la versión de software del MP-4000 posterior a la 3.19. El pedido y la respuesta comparten el formato. Se reconocen por el subcomando `88`.

Un entero de 16 bits viaja con el byte bajo primero: `1234` se envía `34 12`.

## Pedido y respuesta

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `88` |
| 3 en adelante | Data | El dataset |

En la respuesta, el bit 7 del byte 0 del dataset va en 1. El código de acción queda en los bits bajos. Una respuesta a “devolver estado” (acción 0) trae el byte 0 en `80`. Una respuesta a “arrancar” (acción 2) lo trae en `82`.

## Dataset

| Bytes | Qué es | Cuándo vale |
|---:|---|---|
| 0 | Acción | Siempre. En la respuesta, más el bit 7 |
| 1 | Estado del tratamiento | Solo en la respuesta |
| 2 | Subestado | Solo en la respuesta. Esta página no lo define |
| 3–4 | Temperatura del tratamiento | Fp10, °C |
| 5–6 | Periodo | Horas, byte bajo primero |
| 7–8 | Máximo USDA | Fp10, °C |
| 9–10 | Temperatura final | Fp10, °C |
| 11–12 | Retardo de rampa | Pasos de 5 minutos |
| 13 | Código de respuesta | Solo en la respuesta |

Fp10 se divide entre 10. Es la misma escala de la página 25, no la Fp100 de la interfaz vieja.

### Acción (byte 0)

| Valor | Qué pide |
|---:|---|
| 0 | Devolver estado y ajustes. No cambia nada |
| 1 | Cargar los parámetros adjuntos. No arrancar |
| 2 | Arrancar con los parámetros adjuntos |
| 3 | Arrancar con los parámetros que ya están. Los adjuntos se ignoran |
| 4 | Parar. Los ajustes se ignoran |
| 5 | Aceptar. Los ajustes se ignoran |
| 6 | Cargar el cierre: temperatura final y rampa |

La acción 0 es la única lectura. De la 1 a la 6 el controlador mueve el tratamiento.

### Estado (byte 1)

| Valor | Estado |
|---:|---|
| 0 | No definido |
| 1 | No es una opción |
| 2 | No permitido: hay un multi-temperatura en marcha |
| 10 | Sin acción |
| 11 | Pendiente de arranque |
| 12 | Activo |
| 13 | Terminado, falta aceptar |
| 14 | Terminación aceptada |

El 2 y el estado del multi-temperatura se excluyen. No corren a la vez. Estos números no son los del byte 5 de la página 22: allí `01` es activo y `02` es aprobado, en otro pedido.

### Periodo y rampa

El periodo va en horas. Un día son 24. El rango permitido es de 1 hora a 31 días.

El retardo de rampa es el tiempo entre cada cambio de 0,1 K. La unidad del campo son 5 minutos. El valor por defecto es 12, es decir 60 minutos. Cero no es “sin rampa” definida en esta página: el defecto explícito es 12.

### Código de respuesta (byte 13)

| Valor | Resultado |
|---|---|
| 0 | Correcto |
| 1 | No correcto |
| 2 | No está activo |
| 3 | No está en espera |
| `FE` | No permitido |

Cualquier valor distinto de 0 es un error. El byte 13 solo se lee en la respuesta.

## Qué hace la telemetría con esta página

No va en el minuto. El resumen “activo / aprobado” que ya puede verse es el de la página 22, request 7. Este `88` es el detalle y, de la acción 1 en adelante, una orden. La telemetría no arranca ni acepta un tratamiento de frío por su cuenta.
