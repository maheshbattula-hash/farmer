from django.apps import AppConfig

SQL_AUTO_FIELD = "django.db.models.BigAutoField"
MONGODB_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"


class BaseReviewsConfig(AppConfig):
    name = "reviews"


class ReviewsConfig(BaseReviewsConfig):
    default_auto_field = SQL_AUTO_FIELD


class ReviewsMongoConfig(BaseReviewsConfig):
    default_auto_field = MONGODB_AUTO_FIELD
