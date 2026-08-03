from django.apps import AppConfig

SQL_AUTO_FIELD = "django.db.models.BigAutoField"
MONGODB_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"


class BaseOrdersConfig(AppConfig):
    name = "orders"


class OrdersConfig(BaseOrdersConfig):
    default_auto_field = SQL_AUTO_FIELD


class OrdersMongoConfig(BaseOrdersConfig):
    default_auto_field = MONGODB_AUTO_FIELD
