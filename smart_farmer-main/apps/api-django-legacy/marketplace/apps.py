from django.apps import AppConfig

SQL_AUTO_FIELD = "django.db.models.BigAutoField"
MONGODB_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"


class BaseMarketplaceConfig(AppConfig):
    name = "marketplace"


class MarketplaceConfig(BaseMarketplaceConfig):
    default_auto_field = SQL_AUTO_FIELD


class MarketplaceMongoConfig(BaseMarketplaceConfig):
    default_auto_field = MONGODB_AUTO_FIELD
