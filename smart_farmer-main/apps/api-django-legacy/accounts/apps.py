from django.apps import AppConfig

SQL_AUTO_FIELD = "django.db.models.BigAutoField"
MONGODB_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"


class BaseAccountsConfig(AppConfig):
    name = "accounts"


class AccountsConfig(BaseAccountsConfig):
    default_auto_field = SQL_AUTO_FIELD


class AccountsMongoConfig(BaseAccountsConfig):
    default_auto_field = MONGODB_AUTO_FIELD
