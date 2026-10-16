# Página 4 — Generalidades y capa de comunicación

Secciones **2**, **2.1**, **2.2**, **2.3**, **2.3.1** y **2.3.2**.

Esta página no define bytes de telemetría. Define por dónde habla el controlador y a qué velocidad. En el sistema 4G esa velocidad ya la resolvió el módem: al TCP **9915** llega la trama armada, no los bits del RS232.

## 2.1 Conexión MP-4000

El equipo de monitoreo se conecta con un módulo **MP-4000 Com-Module** por RS232 de dos hilos: RxD, TxD y tierra/blindaje. La parte eléctrica está en la especificación de ese módulo, no en este protocolo.

Para la telemetría importa solo esto: el módulo es un puente. Lo que el controlador escribe en TxD es lo que el módem acaba publicando en el socket, y lo que nosotros escribimos en el socket es lo que el módulo entrega en RxD.

## 2.2 Conexión MP-5000

El monitoreo entra directo al controlador, sin ese módulo intermedio. Hay dos tomas:

| Toma | Conector | Uso |
|---|---|---|
| Modem port | J7, pin 7 RxD, pin 9 TxD, pin 11 GND | El módem que deja la unidad en la red |
| Retriever port | Conector externo | Una herramienta de servicio conectada al lado del equipo |

En la rama `test-tk` el cliente TCP es ese módem. Cada conexión nueva es una unidad (o su módem) que acaba de abrir el socket. El ciclo de lectura se hace **por conexión**, porque cada socket es un esclavo distinto.

## 2.3 Capa de comunicación

### 2.3.1 MP-4000

| Parámetro | Valor |
|---|---|
| Baudios | 19200 |
| Formato | 1 start, 8 datos, sin paridad, 1 stop |
| Handshake | RTS/CTS |
| Control de error | La trama tiene inicio, fin y CRC |

RTS/CTS es del cable. No se ve en el hex del TCP. El control de error que sí tenemos que respetar es el de la trama: no interpretar un bloque si el CRC no cierra.

### 2.3.2 MP-5000

Mismo formato de byte (8N1). Cambian la velocidad y el control de flujo:

| Toma | Baudios | Handshake |
|---|---|---|
| Modem port | 19200 | Ninguno |
| Retriever port | 38400 | Ninguno |

El error se sigue controlando con inicio, fin y CRC, igual que en el MP-4000.

## Qué hace la telemetría con esta página

- No configuramos baudios ni RTS/CTS. El módem ya entregó bytes sobre TCP.
- Tratamos cada socket como un esclavo MP-5000 (o un MP-4000 detrás de su módulo).
- No mezclamos pedidos de dos unidades: el ciclo de un minuto vive en esa conexión.
- Una trama se acepta solo si abre con inicio, cierra con fin y el CRC coincide. Eso se comprueba con las reglas de las páginas 6 y 7.
