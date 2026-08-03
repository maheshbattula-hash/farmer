from __future__ import annotations

from django.contrib.admin.apps import AdminConfig
from django.contrib.auth.apps import AuthConfig
from django.contrib.contenttypes.apps import ContentTypesConfig

MONGODB_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"


class MongoAdminConfig(AdminConfig):
    default_auto_field = MONGODB_AUTO_FIELD


class MongoAuthConfig(AuthConfig):
    default_auto_field = MONGODB_AUTO_FIELD


class MongoContentTypesConfig(ContentTypesConfig):
    default_auto_field = MONGODB_AUTO_FIELD


SQL_DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

MONGO_DJANGO_APPS = [
    "config.apps.MongoAdminConfig",
    "config.apps.MongoAuthConfig",
    "config.apps.MongoContentTypesConfig",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
]


def build_local_apps(use_mongodb: bool) -> list[str]:
    suffix = "MongoConfig" if use_mongodb else "Config"
    return [
        f"accounts.apps.Accounts{suffix}",
        f"marketplace.apps.Marketplace{suffix}",
        f"orders.apps.Orders{suffix}",
        f"reviews.apps.Reviews{suffix}",
    ]


def build_installed_apps(use_mongodb: bool) -> list[str]:
    django_apps = MONGO_DJANGO_APPS if use_mongodb else SQL_DJANGO_APPS
    return [*django_apps, *THIRD_PARTY_APPS, *build_local_apps(use_mongodb)]
