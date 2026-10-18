FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install system runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    netcat-openbsd \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy application files
COPY . /app/

# Make entrypoint and manage.py executable
RUN chmod +x /app/docker-entrypoint.sh /app/manage.py

# Ensure staticfiles, media, and persistent data directories exist and collect static files during build
RUN mkdir -p /app/staticfiles /app/media /app/data && \
    DJANGO_SECRET_KEY=build-collectstatic-key python manage.py collectstatic --noinput --clear

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
