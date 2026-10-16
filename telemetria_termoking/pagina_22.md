# Página 22 — Information A

Sección **4.3.9**. Request 7. Estado de marcha del frío y del módem de monitoreo. La respuesta se reconoce por `82 A7 07`.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `07` |
| 3 | Request `07` | Nueve bytes de estado |

## Mapa

| Byte | Qué es | Valores |
|---:|---|---|
| 0 | Modo de la unidad | Los códigos 0 a 29 están en la página 44 |
| 1 | Apagada por el operador | Minutos que faltan |
| 2 | En rango | 0 falso, 1 verdadero |
| 3 | Enfriamiento por agua | 0 falso, 1 verdadero |
| 4 | Frío limitado | Máscara de bits |
| 5 | Estado del tratamiento de frío | Máscara |
| 6 | Estado multi-temperatura | Máscara |
| 7 | Paso multi-temperatura | El paso actual |
| 8 | Estado del módem de monitoreo remoto | 0 no disponible, 1 offline, 2 zombie, 3 online |

### Frío limitado (byte 4)

Los bits se suman. Puede haber más de un límite a la vez.

| Bit | Valor | Límite |
|---|---:|---|
| 0 | `01` | Limitado |
| 1 | `02` | Límite de enfriamiento del condensador |
| 2 | `04` | Límite de agua |
| 3 | `08` | Límite de corriente |
| 4 | `10` | Límite de potencia |

`0C` es agua y corriente a la vez. No es un código único.

### Tratamiento de frío (byte 5)

| Valor | Estado |
|---:|---|
| `01` | Activo |
| `02` | Aprobado |

### Multi-temperatura (byte 6)

| Valor | Estado |
|---:|---|
| `01` | Activo |
| `02` | Acercándose al escalón |
| `04` | Manteniendo |
| `80` | Último paso |

El byte 7 dice cuál es ese paso. Tiene sentido cuando el viaje USDA de la página 16 está encendido y las cuatro cargas no comparten un solo setpoint.

### Módem (byte 8)

| Valor | Estado |
|---:|---|
| 0 | No disponible |
| 1 | Offline |
| 2 | Zombie |
| 3 | Online |

Es el propio módem diciendo cómo se ve. Zombie es un enlace que no está caído del todo ni está en línea. No reemplaza el hecho de que el socket TCP esté abierto: se puede tener sesión en el puerto 9915 y este byte en offline si el controlador aún no dio por bueno al módem.

El byte 1, minutos restantes, solo cuenta si el operador apagó la unidad con temporizador. En cero, o si el byte no aplica, no se muestra una cuenta regresiva.

## Qué hace la telemetría con esta página

El request 7 no va en el minuto de `d02`/`d03`. El bit “en rango” se compara con el límite de la página 20 y con las temperaturas de carga, no se calcula otra vez desde el gráfico. El byte 0 se traduce con la tabla de la página 44.
