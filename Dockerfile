# Smart Leilões API — Docker
# Build: docker build -t smart-leiloes-api .
# Run:   docker run -p 8000:8000 --env-file .env smart-leiloes-api

FROM python:3.12-slim

WORKDIR /app

# Instalar dependências do sistema (psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependências Python
COPY requirements_api.txt .
RUN pip install --no-cache-dir -r requirements_api.txt

# Copiar código da API
COPY smart_leiloes_api/ ./smart_leiloes_api/
COPY fetch_caixa.py .
COPY fetch_djen.py .
COPY geocode.py .
COPY extract.py .

# Variáveis de ambiente (sobrescritas via --env-file em produção)
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "smart_leiloes_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
