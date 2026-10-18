"""
Django settings for SMEHUB project.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if os.getenv('DEBUG', 'True').lower() in ('true', '1', 't'):
        SECRET_KEY = 'django-insecure-smehub-development-mvp-local-key-2026'
    else:
        raise ValueError("DJANGO_SECRET_KEY environment variable must be set in production!")

DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', '1', 't')

_env_hosts = os.getenv('ALLOWED_HOSTS')
if _env_hosts:
    ALLOWED_HOSTS = [h.strip() for h in _env_hosts.split(',') if h.strip()]
else:
    ALLOWED_HOSTS = [
        'getsmehub.com',
        'www.getsmehub.com',
        '173.214.172.222',
        'localhost',
        '127.0.0.1',
        'web',
    ]

# Reverse Proxy SSL & Header Forwarding
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'drf_spectacular',

    # SMEHUB Modular Domain Apps
    'apps.core',
    'apps.merchants',
    'apps.payments',
    'apps.transactions',
    'apps.analytics',
    'apps.contracts',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# Database configuration: PostgreSQL with automatic container detection and persistent fallback
POSTGRES_HOST = os.getenv('POSTGRES_HOST', '')
POSTGRES_DB = os.getenv('POSTGRES_DB', '')
DB_ENGINE_ENV = os.getenv('DB_ENGINE', '').lower()

# Automatically use PostgreSQL if explicitly configured or if PostgreSQL host/db is present
_is_postgres = DB_ENGINE_ENV == 'postgres' or bool(POSTGRES_HOST) or bool(POSTGRES_DB)

if _is_postgres:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': POSTGRES_DB or 'smehub_db',
            'USER': os.getenv('POSTGRES_USER', 'smehub_user'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'smehub_secure_password_2026'),
            'HOST': POSTGRES_HOST or 'db',
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
        }
    }
else:
    # If explicitly SQLite, write to persistent data directory if available
    _sqlite_dir = BASE_DIR / 'data'
    _sqlite_dir.mkdir(parents=True, exist_ok=True)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': _sqlite_dir / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# CSRF & Session Security Configuration
CSRF_TRUSTED_ORIGINS = [
    'https://getsmehub.com',
    'http://getsmehub.com',
    'https://www.getsmehub.com',
    'http://www.getsmehub.com',
    'https://173.214.172.222',
    'http://173.214.172.222',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:8008',
    'http://127.0.0.1:8008',
]
_env_csrf = os.getenv('CSRF_TRUSTED_ORIGINS')
if _env_csrf:
    for origin in _env_csrf.split(','):
        clean_origin = origin.strip()
        if clean_origin and clean_origin not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(clean_origin)

CSRF_COOKIE_SECURE = os.getenv('CSRF_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = 'Lax'
LOGIN_REDIRECT_URL = '/admin/'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'apps.core.exceptions.custom_exception_handler',
    'NON_FIELD_ERRORS_KEY': 'error',
}

# OpenAPI / Swagger / ReDoc (drf-spectacular) Configuration
SPECTACULAR_SETTINGS = {
    'TITLE': 'PayarMove Pay API',
    'DESCRIPTION': 'Institutional cross-border mobility payments...',
    'VERSION': '1.0.0',
    # Pin to a stable version without the import.meta bundle bug:
    'REDOC_DIST': 'https://cdn.jsdelivr.net/npm/redoc@2.1.5',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': True,
    },
    'TAGS': [
        {'name': 'Merchants', 'description': 'Merchant registration, business profiles, and Stellar wallet integration'},
        {'name': 'Payments', 'description': 'Payment request / invoice generation, QR code rendering, SEP-0007 URIs'},
        {'name': 'Checkout', 'description': 'Public customer checkout, invoice review, and payment authorization'},
        {'name': 'Transactions', 'description': 'Stellar Testnet transaction tracking, blockchain verification, and audit logs'},
        {'name': 'Analytics', 'description': 'Merchant dashboard metrics, volume summaries, and payment statuses'},
        {'name': 'Contracts', 'description': 'Soroban & EVM Smart Contract routing and parameters'},
    ],
    'ENUM_NAME_OVERRIDES': {
        'PaymentStatusEnum': 'apps.payments.models.PaymentStatus',
        'BlockchainTransactionStatusEnum': 'apps.transactions.models.TransactionStatus',
    },
}

# CORS settings
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'True').lower() in ('true', '1', 't')
_env_cors = os.getenv('CORS_ALLOWED_ORIGINS')
if _env_cors:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _env_cors.split(',') if origin.strip()]
else:
    CORS_ALLOWED_ORIGINS = [
        'https://getsmehub.com',
        'http://getsmehub.com',
        'https://www.getsmehub.com',
        'http://www.getsmehub.com',
        'https://173.214.172.222',
        'http://173.214.172.222',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]
CORS_ALLOW_CREDENTIALS = True

# Stellar Testnet Configuration
STELLAR_NETWORK = os.getenv('STELLAR_NETWORK', 'TESTNET')
STELLAR_HORIZON_URL = os.getenv('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org')
STELLAR_PASSPHRASE = os.getenv('STELLAR_PASSPHRASE', 'Test SDF Network ; September 2015')
STELLAR_NETWORK_PASSPHRASE = STELLAR_PASSPHRASE
USDC_ASSET_CODE = os.getenv('USDC_ASSET_CODE', 'USDC')
# SDF Testnet USDC issuer or standard testnet issuer
USDC_ISSUER_ADDRESS = os.getenv(
    'USDC_ISSUER_ADDRESS',
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
)
STELLAR_EXPERT_BASE_URL = os.getenv('STELLAR_EXPERT_BASE_URL', 'https://stellar.expert/explorer/testnet/tx/')
SMEHUB_BASE_CHECKOUT_URL = os.getenv('SMEHUB_BASE_CHECKOUT_URL', 'https://getsmehub.com/checkout/')
SOROBAN_CONTRACT_ID = os.getenv('SOROBAN_CONTRACT_ID', 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC')
