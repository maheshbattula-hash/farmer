from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from django.core.exceptions import ImproperlyConfigured

from .env import BASE_DIR, env_flag, env_value

MONGODB_ENGINE = "django_mongodb_backend"
MONGODB_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"
SQL_AUTO_FIELD = "django.db.models.BigAutoField"


@dataclass(frozen=True)
class DatabaseRuntime:
    use_mongodb: bool
    databases: dict[str, dict[str, Any]]
    default_auto_field: str
    migration_modules: dict[str, str] = field(default_factory=dict)


def build_database_runtime() -> DatabaseRuntime:
    use_mongodb = env_flag("USE_MONGODB", True)
    use_sqlite = env_flag("USE_SQLITE", False)

    if use_mongodb and use_sqlite:
        raise ImproperlyConfigured("USE_MONGODB and USE_SQLITE cannot both be true.")

    if use_mongodb:
        return DatabaseRuntime(
            use_mongodb=True,
            databases={
                "default": {
                    "ENGINE": MONGODB_ENGINE,
                    "HOST": env_value("MONGODB_URI", "mongodb://127.0.0.1:27017"),
                    "NAME": env_value("MONGODB_NAME", "smart_farmer"),
                }
            },
            default_auto_field=MONGODB_AUTO_FIELD,
            migration_modules={
                "admin": "config.mongodb_migrations.admin",
                "auth": "config.mongodb_migrations.auth",
                "authtoken": "config.mongodb_migrations.authtoken",
                "contenttypes": "config.mongodb_migrations.contenttypes",
                "accounts": "accounts.mongo_migrations",
                "marketplace": "marketplace.mongo_migrations",
                "orders": "orders.mongo_migrations",
                "reviews": "reviews.mongo_migrations",
            },
        )

    if use_sqlite:
        return DatabaseRuntime(
            use_mongodb=False,
            databases={
                "default": {
                    "ENGINE": "django.db.backends.sqlite3",
                    "NAME": BASE_DIR / "db.sqlite3",
                }
            },
            default_auto_field=SQL_AUTO_FIELD,
        )

    return DatabaseRuntime(
        use_mongodb=False,
        databases={
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": env_value("POSTGRES_DB", "smart_farmer"),
                "USER": env_value("POSTGRES_USER", "postgres"),
                "PASSWORD": env_value("POSTGRES_PASSWORD", "postgres"),
                "HOST": env_value("POSTGRES_HOST", "localhost"),
                "PORT": env_value("POSTGRES_PORT", "5432"),
            }
        },
        default_auto_field=SQL_AUTO_FIELD,
    )
