# Página 15 — Sensor readout, segunda mitad

Sigue el dataset **4.3.2.3**, desde el byte 36 hasta el 83. Los offsets siguen siendo los del Data que va después de `82 A7 00`.

| Bytes | Qué es | Escala |
|---:|---|---|
| 36–37 | Corriente fase 1 | Fp10 A |
| 38–39 | Corriente fase 2 | Fp10 A |
| 40–41 | Corriente fase 3 | Fp10 A |
| 42–43 | CO₂ | Fp10 % |
| 44–45 | O₂ | Fp10 % |
| 46–47 | Velocidad ventilador evaporador | Fp1 % |
| 48–49 | Velocidad ventilador condensador | Fp1 % |
| 50–51 | Tensión de batería del data logger | Fp10 V |
| 52–55 | Medidor de energía | Fp10 kWh |
| 56–59 | Medidor de energía del viaje | Fp10 kWh |
| 60–63 | Duración del viaje en el medidor | Fp1 s |
| 64–65 | Temperatura de succión 1 | Fp10 °C |
| 66–67 | Temperatura de descarga 1 | Fp10 °C |
| 68–69 | Aire de suministro 2 | Fp10 °C |
| 70–71 | Aire de retorno 2 | Fp10 °C |
| 72–73 | Temperatura de batería del data logger | Fp100 °C |
| 74–75 | Corriente de carga de esa batería | Fp100 A |
| 76–77 | Consumo | Fp100 kW |
| 78–79 | Consumo promedio por hora | Fp100 kW |
| 80–81 | Presión de succión 2 | Fp10 bar relativos |
| 82–83 | Temperatura de succión 2 | Fp10 °C |

Al pie de la tabla el manual anota: **nota 1, calculado; nota 2, mostrado.** Esas dos marcas corresponden a succión/descarga (64–67), que el equipo calcula, y al segundo suministro/retorno (68–71), que es el valor que muestra. El suministro y el retorno de los bytes 0–5 siguen siendo la medición principal.

## Los campos de cuatro bytes

52–55, 56–59 y 60–63 no son palabras de 16 bits: cada uno ocupa cuatro bytes, el bajo primero. Hay que leerlos como entero de 32 bits y después aplicar el Fp. Partirlos en dos palabras de 16 bits mezcla el acumulado con ceros y da un kWh o un tiempo que no existió.

Ejemplo de escala Fp10 en 32 bits: el entero 3886 es 388,6 kWh.

## Qué hace la telemetría con las páginas 14 y 15

- `d02` se conserva entero para el POST. Esta tabla es para cuando ese hex se traduzca a números.
- CO₂ y O₂ se dividen entre 10. Humedad y velocidad de ventilador no.
- Un código de sensor (`FE 7F` y el resto de la lista de la página 14) no entra al gráfico.
- Si la respuesta trae bytes después del 83, son extensión (página 9) y no corren este mapa. Si se corta antes, el campo que no llegó queda vacío.
