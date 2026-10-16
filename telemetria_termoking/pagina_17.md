# Página 17 — IO readout

Sección **4.3.4**. Request 2 de la lista de la página 13. No forma parte del ciclo de cada minuto.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `02` |
| 3 | Request `02` | Un byte por señal |

Cada byte del dataset vale 0 si está desactivada, 1 si está activada, o `FF` si esa señal no existe en el equipo. `FF` no es un tercer estado de la máquina: es “este borne no está cableado”.

## Mapa

| Byte | Señal | Nota |
|---:|---|---|
| 0 | DI – LPCO | Entrada. Presostato de baja |
| 1 | DI – HPCO | Entrada. Presostato de alta |
| 2 | DO – válvula economizadora | Salida |
| 3 | DO – válvula digital | Salida |
| 4 | Power DO – calefactor | Salida de potencia |
| 5 | Power DO – compresor | Salida de potencia |
| 6 | Power DO – evaporador alta | Salida de potencia |
| 7 | Power DO – evaporador baja | Salida de potencia |
| 8 | Power DO – ventilador del condensador | Salida de potencia |
| 9 | Relé de fase 1 | Solo MP-5000 |
| 10 | Relé de fase 2 | Solo MP-5000 |

DI es una entrada que el controlador lee. DO es una salida que el controlador manda. En un MP-4000 los bytes 9 y 10 pueden venir en `FF` porque el manual los reserva al MP-5000.

Estas salidas no son los diez relés del tablero de la otra rama. Aquí son los contactores del frío: compresor, evaporador, condensador y válvulas. El estado 0/1 de esta página se consulta; no se escribe con este telegrama.

## Qué hace la telemetría con esta página

Si más adelante se pide el request 2, la respuesta se reconoce por `82 A7 02` y cada byte se publica como apagado, encendido o ausente. Mientras el ciclo solo pida sensores y control, este bloque no viaja en el JSON.
