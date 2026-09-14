FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY bridge.py .

EXPOSE 9914 8085
CMD ["python", "-u", "bridge.py"]
