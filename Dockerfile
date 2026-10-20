# ============================================================
#  Dashboard Empresarial Bitelit — imagen para Railway (y después AWS ECS Fargate)
# ============================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt gunicorn==23.0.0

COPY . .

# Usuario sin privilegios. config/ y data/ deben poder escribirse (sheets_config.json y caché)
# cuando no hay volumen montado.
RUN useradd --create-home --uid 10001 bitelit \
    && mkdir -p /app/config /app/data \
    && chown -R bitelit:bitelit /app
USER bitelit

EXPOSE 8000

# 1 worker con hilos: el caché de datos vive en memoria y así todos los usuarios ven la misma copia.
# timeout alto porque "Sincronizar" lee todas las hojas de Google y puede tardar.
CMD ["sh", "-c", "exec gunicorn app:app --bind 0.0.0.0:${PORT} --workers 1 --threads 8 --timeout 300 --access-logfile - --error-logfile -"]
