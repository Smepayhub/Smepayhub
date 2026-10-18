#!/usr/bin/env bash
set -e

echo "Starting SMEHUB Stellar Platform Backend..."

PG_HOST="${POSTGRES_HOST:-db}"
PG_PORT="${POSTGRES_PORT:-5432}"

if [ "$DB_ENGINE" = "postgres" ] || [ -n "$POSTGRES_HOST" ] || [ -n "$POSTGRES_DB" ]; then
    echo "Waiting for PostgreSQL ($PG_HOST:$PG_PORT)..."
    while ! nc -z "$PG_HOST" "$PG_PORT"; do
      sleep 1
    done
    echo "PostgreSQL is available at $PG_HOST:$PG_PORT!"
fi

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files for WhiteNoise..."
python manage.py collectstatic --noinput

echo "Validating OpenAPI 3.0 schema..."
python manage.py spectacular --file openapi_schema.yaml --validate || true

# Auto-create superuser if credentials supplied via environment
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "Checking / creating administrative superuser ($DJANGO_SUPERUSER_USERNAME)..."
    python manage.py createsuperuser --noinput || true
fi

# Auto-seed demo data ONLY if explicitly requested via environment variable AND database is empty
if [ "$AUTO_POPULATE_DEMO_DATA" = "true" ] || [ "$AUTO_POPULATE_DEMO_DATA" = "True" ] || [ "$AUTO_POPULATE_DEMO_DATA" = "1" ]; then
    echo "Checking merchant count before seeding demo data..."
    MERCHANT_COUNT=$(python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.merchants.models import Merchant
print(Merchant.objects.count())
" 2>/dev/null || echo "0")
    if [ "$MERCHANT_COUNT" = "0" ]; then
        echo "Database is empty and AUTO_POPULATE_DEMO_DATA is true. Populating demo data once..."
        python manage.py populate_demo_data --with-requests || true
    else
        echo "Existing database detected ($MERCHANT_COUNT merchants found). Preserving database, skipping demo seed."
    fi
else
    echo "AUTO_POPULATE_DEMO_DATA is disabled (production mode). Existing database preserved."
fi

if [ "$1" = "runserver" ]; then
    echo "Starting Django development server on 0.0.0.0:8000..."
    exec python manage.py runserver 0.0.0.0:8000
else
    echo "Starting production Gunicorn server on 0.0.0.0:8000..."
    exec gunicorn config.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers "${GUNICORN_WORKERS:-3}" \
        --timeout "${GUNICORN_TIMEOUT:-120}" \
        --access-logfile - \
        --error-logfile -
fi
