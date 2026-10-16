# Página 20 — Configuration readout

Sección **4.3.7**. Request 5. Describe el equipo y cómo están calibradas las sondas de carga. No es una temperatura de proceso.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `05` |
| 3 | Request `05` | Dataset |

La respuesta se reconoce por `82 A7 05`. Los offsets son del Data que sigue a esos tres bytes. Fp100 se divide entre 100, byte bajo primero.

## Mapa

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 0–1 | Offset de calibración, sonda de carga A | Fp100 °C |
| 2–3 | Sonda de carga B | Fp100 °C |
| 4–5 | Sonda de carga C | Fp100 °C |
| 6–7 | Sonda de carga D | Fp100 °C |
| 8–9 | Límite “en rango” | Fp100 °C |
| 10 | Opción de aire | 0 ninguna, 1 AVL, 2 AFAM+ |
| 11 | Tipo de unidad | `01` de 20 pies, `02` slimline |
| 12 | Ventilador del evaporador | 0 estándar, 1 velocidad variable |
| 13 | Ventilador del condensador | 0 estándar, 1 velocidad variable |
| 14 | Calidad de la lectura del medidor de energía | Ver grupos de abajo |
| 15 | Refrigerante | 0 desconocido, 1 R404a, 2 R452a, 3 R134a, 4 R513a, 5 R1234yf |
| 16 | Sin definir | No se interpreta |
| 17 | Largo del contenedor | Ver tabla |
| 18 | Alto del contenedor | 0 desconocido, 1 estándar 8′6″, 2 high cube 9′6″ |

Las sondas A–D son las cuatro cargas de la página 14. El offset se suma a la calibración; no reemplaza la temperatura que ya viene en los bytes 16–23 del sensor readout. El límite “en rango” es la banda, en °C, contra la que el controlador decide el bit de la página 22.

## Calidad del medidor (byte 14)

El manual pide elegir el offset 5 como arranque de cada grupo. El dígito de las unidades afina dentro del grupo; la decena dice de qué clase es la lectura.

| Rango | Clase |
|---|---|
| 0 | No válida o no presente |
| 10–19 | Estimada |
| 20–29 | Calculada por el RMM+ |
| 30–39 | Calculada por el controlador |
| 40–49 | Medida por el controlador, interna |
| 50–59 | Medida por un equipo externo |

Un kWh de las páginas 14 y 15 se publica con esta clase al lado. Calidad 0: el acumulado no se usa como medición.

## Largo del contenedor (byte 17)

El valor es el código ASCII del dígito o la letra, no un entero de pies.

| Valor | Largo |
|---|---|
| `00` | Desconocido |
| `31` | 10′ ISO, carácter `1` |
| `32` | 20′ ISO, carácter `2` |
| `34` | 40′ ISO, carácter `4` |
| `48` | 43′ ISO, carácter `H` |
| `4C` | 45′ ISO, carácter `L` |

## Qué hace la telemetría con esta página

No va en el ciclo de cada minuto. Si se pide, una vez por conexión basta: los offsets y el tipo de contenedor no cambian con la temperatura. El byte 16 se salta.
