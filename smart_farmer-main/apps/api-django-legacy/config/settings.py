from __future__ import annotations

from .apps import build_installed_apps
from .database import build_database_runtime
from .env import BASE_DIR, env_flag, env_int, env_list, env_value

DATABASE_RUNTIME = build_database_runtime()
USE_MONGODB = DATABASE_RUNTIME.use_mongodb
DATABASES = DATABASE_RUNTIME.databases
DEFAULT_AUTO_FIELD = DATABASE_RUNTIME.default_auto_field
MIGRATION_MODULES = DATABASE_RUNTIME.migration_modules

SECRET_KEY = env_value("DJANGO_SECRET_KEY", "change-me")
DEBUG = env_flag("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "[::1]", "*"])

INSTALLED_APPS = build_installed_apps(USE_MONGODB)

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

AUTH_PASSWORD_VALIDATORS = []
AUTH_USER_MODEL = "accounts.User"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env_value("MAIL_SERVER", "smtp.gmail.com")
EMAIL_PORT = env_int("MAIL_PORT", 587)
EMAIL_USE_TLS = env_flag("MAIL_USE_TLS", True)
EMAIL_USE_SSL = env_flag("MAIL_USE_SSL", False)
EMAIL_HOST_USER = env_value("MAIL_USERNAME", "") or ""
EMAIL_HOST_PASSWORD = (env_value("MAIL_PASSWORD", "") or "").replace(" ", "")
DEFAULT_FROM_EMAIL = env_value("MAIL_DEFAULT_SENDER") or EMAIL_HOST_USER or "noreply@smartfarmer.local"
MAIL_SUPPRESS_SEND = env_flag("MAIL_SUPPRESS_SEND", False)

CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    ["http://localhost:3000", "http://127.0.0.1:3000", "http://0.0.0.0:3000"],
)
CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    ["http://localhost:3000", "http://127.0.0.1:3000", "http://0.0.0.0:3000"],
)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

SMART_FARMER = {
    "OTP_EXPIRY_SECONDS": env_int("OTP_EXPIRY_SECONDS", 300),
    "OTP_MAX_PER_HOUR": env_int("OTP_MAX_PER_HOUR", 3),
    "EXPOSE_TEST_OTP": env_flag("EXPOSE_TEST_OTP", False),
    "ADMIN_EMAIL": (env_value("ADMIN_EMAIL", "") or "").strip().lower(),
    "ADMIN_PASSWORD": env_value("ADMIN_PASSWORD", "") or "",
    "ADMIN_USERNAME": env_value("ADMIN_USERNAME", "admin") or "admin",
    "ADMIN_FULL_NAME": env_value("ADMIN_FULL_NAME", "System Administrator") or "System Administrator",
}
