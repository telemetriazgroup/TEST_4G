# Generador de condicionales — Cámara POLLO_BEBE

Aplicación de escritorio en Python que construye tramas hexadecimales para programar reglas condicionales (`IF / ELSE / FIN IF`) en el controlador de la cámara **POLLO_BEBE**.

---

## Funcionalidad

### Objetivo

Permitir al operador definir, sin editar hex manualmente, reglas del tipo:

> *Si Suministro > 22.0 °C, activar RELAY1 durante 5 s*

La aplicación genera la trama binaria codificada y la empaqueta en JSON listo para enviar al dispositivo.

### Estructura de una condicional

Cada regla condicional se compone de:

```
INICIO_IF + ENTRADA + OPERADOR + VALOR(2B) + SALIDA + ESTADO(2B) + TIEMPO(2B)
```

| Campo      | Bytes | Descripción                                      |
|------------|-------|--------------------------------------------------|
| INICIO_IF  | 1     | Token `0x50` — inicio de bloque condicional      |
| ENTRADA    | 1     | Sensor de entrada (temperatura, CO₂, etc.)       |
| OPERADOR   | 1     | Comparación (`>`, `<`, `==`, `>=`, `<=`)         |
| VALOR      | 2     | Umbral de comparación (BCD o HEX)                |
| SALIDA     | 1     | Actuador (relé, compuerta, motor, setpoint)      |
| ESTADO     | 2     | Valor a aplicar en la salida                     |
| TIEMPO     | 2     | Duración en segundos, o `FEFE` si es permanente  |

**Ejemplo:** `50 10 58 0220 20 0000 0005`

- `50` → INICIO_IF  
- `10` → Suministro  
- `58` → MAYOR (`>`)  
- `0220` → 22.0 °C (220 en BCD, factor ×10)  
- `20` → RELAY1  
- `0000` → ACTIVAR (lógica invertida: 0 = energizado)  
- `0005` → 5 segundos  

### Tokens de control

| Token   | Código | Uso                          |
|---------|--------|------------------------------|
| INICIO_IF | `0x50` | Inicio de cada condicional |
| FIN IF    | `0x51` | Cierre de bloque IF        |
| IF        | `0x52` | (reservado en protocolo)   |
| ELSE      | `0x53` | Rama alternativa           |

### Entradas disponibles

| Entrada    | Código | Unidad | Rango      |
|------------|--------|--------|------------|
| Suministro | `0x10` | °C     | -50 … 100  |
| Retorno    | `0x11` | °C     | -50 … 100  |
| CO2        | `0x12` | %      | 0 … 100    |
| USDA1–4    | `0x13`–`0x16` | °C | -50 … 100 |

### Salidas disponibles

| Salida     | Código | Tipo       | Notas                              |
|------------|--------|------------|------------------------------------|
| RELAY1–10  | `0x20`–`0x29` | Relé  | Lógica invertida: 0 activa, 1 apaga |
| MOTORES    | `0x2A` | Numérico   | 0–100 %                            |
| Inferior   | `0x2B` | Compuerta  | OPEN (1) / CLOSE (0)               |
| Medio      | `0x2C` | Compuerta  | OPEN (1) / CLOSE (0)               |
| Superior   | `0x2D` | Compuerta  | OPEN (1) / CLOSE (0)               |
| Setpoint   | `0x2E` | Numérico   | 0–400 (décimas de °C)              |

### Formato de salida JSON

La trama final se emite como:

```json
{"i":"POLLO_BEBE","rs":"PANTALLA_CMD:50105802202000000005"}
```

- `"i"` — identificador del dispositivo (configurable en la GUI).  
- `"rs"` — prefijo + concatenación hex de todas las reglas del programa.

### Interfaz gráfica

La ventana principal permite:

1. **Editor** — definir una condicional (entrada, operador, valor, salida, estado, tiempo).
2. **Vista previa** — muestra el hex de la regla en construcción.
3. **Programa** — lista ordenada de reglas; se pueden subir, bajar o eliminar.
4. **Tokens** — agregar `ELSE (53)` o `FIN IF (51)` entre condicionales.
5. **Trama final** — hex agrupado + JSON; botones para copiar al portapapeles.
6. **Formato BCD/HEX** — campos de 2 bytes en decimal empaquetado (`0220`) o hexadecimal con signo (`00DC`).

---

## Dependencias

### Python (imports)

| Módulo              | Origen        | Uso                          |
|---------------------|---------------|------------------------------|
| `json`              | stdlib        | Serializar trama final       |
| `tkinter`           | stdlib + tk   | Ventana principal            |
| `tkinter.ttk`       | stdlib + tk   | Widgets modernos             |
| `tkinter.messagebox`| stdlib + tk   | Diálogos de error/confirmación |

**No hay dependencias pip.** Ver `requirements.txt`.

### Sistema (Linux / Docker)

- **Python 3.12+**
- **python3-tk** — paquete del sistema que provee `_tkinter`
- **Servidor X11** en el host — necesario para mostrar la GUI desde el contenedor

---

## Ejecución local (sin Docker)

```bash
# Crear entorno virtual (opcional)
python3 -m venv mi_entorno
source mi_entorno/bin/activate

# En Debian/Ubuntu, si tkinter no está disponible:
# sudo apt install python3-tk

python generador_condicionales.py
```

---

## Docker

### Archivos

| Archivo              | Propósito                                      |
|----------------------|------------------------------------------------|
| `Dockerfile`         | Imagen Python 3.12 slim + python3-tk           |
| `docker-compose.yml` | Orquestación con reenvío X11                   |
| `.dockerignore`      | Excluye entorno virtual y cachés               |
| `requirements.txt`   | Documenta que no hay paquetes pip              |

### Construir la imagen

```bash
docker compose build
# o
docker build -t generador-condicionales:latest .
```

### Ejecutar con interfaz gráfica (Linux)

La GUI tkinter necesita acceso al display del host:

```bash
# Permitir conexiones X11 desde contenedores (una vez por sesión)
xhost +local:docker

# Levantar la aplicación
docker compose up

# Al terminar, revocar acceso (recomendado)
xhost -local:docker
```

Alternativa sin compose:

```bash
docker run --rm \
  -e DISPLAY="$DISPLAY" \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --network host \
  generador-condicionales:latest
```

### Verificar imports dentro del contenedor

```bash
docker run --rm generador-condicionales:latest \
  python -c "import json, tkinter; print('OK')"
```

### Notas Docker

- En **Windows/macOS** se requiere un servidor X (VcXsrv, XQuartz) o adaptar la configuración de `DISPLAY`.
- El contenedor no expone puertos HTTP; es una app de escritorio, no un servicio web.
- `network_mode: host` en compose facilita la resolución del display en Linux.

---

## Estructura del proyecto

```
testpy/
├── generador_condicionales.py   # Aplicación principal
├── requirements.txt             # Dependencias pip (vacío — solo stdlib)
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
└── Proceo.md                    # Este documento
```

---

## Referencia rápida del protocolo

```
Operadores:
  0x54  ==     0x55  <=     0x56  >=     0x57  <     0x58  >

Tiempo permanente: FEFE (0xFEFE)

Relés: 0 = ACTIVAR (bobina energizada), 1 = DESACTIVAR
Compuertas: 1 = OPEN, 0 = CLOSE
```
