FROM python:3.12-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py homologate.py history_nav.py decode_tk.py decode_rs.py comandos.py reglas.py client_api.py tk_analysis.py tk_probe.py .

EXPOSE 9086
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9086"]
