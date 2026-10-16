# Página 36 — MTS, paso activo y respuesta

Sigue la sección **4.3.20**. Dos bytes después de los diez pasos.

| Byte | Qué es | Cuándo vale |
|---:|---|---|
| 43 | Número del paso activo | Solo en la respuesta. Es el paso que está en curso |
| 44 | Código de respuesta | Solo en la respuesta |

El byte 43 numera el paso en marcha, de los diez de la página 35. No se lee en el pedido. Si el estado del byte 1 no es activo, este número no describe un paso que se esté cumpliendo.

### Código de respuesta (byte 44)

| Valor | Resultado |
|---|---|
| 0 | Correcto |
| 1 | No correcto |
| 2 | No está activo |
| 3 | No está en espera |
| 4 | Fuera de rango |
| `FE` | No permitido |

El 4 no está en el tratamiento de frío. Aquí un periodo o una temperatura fuera de lo permitido se señala aparte. Igual que en la página 34, solo el 0 es aceptación. Cualquier otro valor deja el programa como estaba.

## Qué hace la telemetría con esta página

Estos dos bytes cierran la respuesta `82 A7 89`. El minuto no la pide. Si más adelante se lee el multi-temperatura con la acción 0, el paso del gráfico sale del byte 43 y el resultado de la orden, del byte 44.
