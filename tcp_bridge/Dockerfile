FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY bridge.py .

EXPOSE 9916 19800
CMD ["python", "-u", "bridge.py"]
