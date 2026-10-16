# Página 14 — Sensor readout, primera mitad

Sección **4.3.2**. Es la respuesta al request 0 de la página 13. Ese hex es el `d02`.

## Pedido y respuesta

Pedido: `82 A7 10 00` (formato, comando, subcomando de pedido, request de sensores).

Respuesta:

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Reply | `A7` |
| 2 | Sub Reply | `00` |
| 3 … n | Data | El mapa de abajo |

Los números de byte del mapa son el offset **dentro de ese Data**, el primer par justo después de `82 A7 00`.

## Cómo se lee cada valor

Casi todo es entero de 16 bits con el byte bajo primero.

En esta sección la escala es la del dataset, no la tabla genérica de la página 5:

| Nombre | Exponente | 123 crudo |
|---|---:|---|
| Fp1 | 0 | 123 |
| Fp10 | −1 | 12,3 |
| Fp100 | −2 | 1,23 |

Las temperaturas de esta página son Fp10: se dividen entre 10. `38 FF` es el entero con signo −200 y se publica como −20,0 °C.

A partir de `0x7FF0` el número no es una lectura. En la trama se ve al revés (`FE 7F` = `0x7FFE`).

| Valor | Significado |
|---|---|
| `0x7FFF` | El sensor está inicializando |
| `0x7FFE` | No aplica |
| `0x7FFD` | Error de sensor |
| `0x7FFC` | Sensor abierto |
| `0x7FFB` | Sensor en corto |
| `0x7FFA` | Por encima de rango |
| `0x7FF9` | Por debajo de rango |
| `0x7FF8` | Sin comunicación |
| `0x7FF7` | Calentando |
| `0x7FEF` | Máximo numérico que un sensor puede valer |

Esos códigos se dejan vacíos. No se grafican como −0,2 °C ni como 3276 °C.

## Mapa, bytes 0 a 35

| Bytes | Qué es | Escala |
|---:|---|---|
| 0–1 | Aire de suministro 1 | Fp10 °C |
| 2–3 | Aire de suministro 2 | Fp10 °C |
| 4–5 | Aire de retorno | Fp10 °C |
| 6–7 | Serpentín evaporador 1 | Fp10 °C |
| 8–9 | Serpentín condensador | Fp10 °C |
| 10–11 | Serpentín compresor | Fp10 °C |
| 12–13 | Serpentín compresor 2 | Fp10 °C |
| 14–15 | Aire ambiente | Fp10 °C |
| 16–17 | Carga 1 | Fp10 °C |
| 18–19 | Carga 2 | Fp10 °C |
| 20–21 | Carga 3 | Fp10 °C |
| 22–23 | Carga 4 | Fp10 °C |
| 24–25 | Humedad relativa | Fp1 % |
| 26–27 | AVL | Fp1 CMH |
| 28–29 | Presión de succión | Fp100 bar relativos |
| 30–31 | Presión de descarga | Fp100 bar relativos |
| 32–33 | Tensión de línea | Fp1 V |
| 34–35 | Frecuencia de línea | Fp1 Hz |

Suministro, retorno y las cuatro cargas son las curvas del histórico. Una carga en código `7FF0` o más alto no es una zona fría: es sensor ausente o dañado.

La página 15 sigue en el byte 36.
