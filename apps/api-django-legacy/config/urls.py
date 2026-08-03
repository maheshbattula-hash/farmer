from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def api_index(request):
    base_url = request.build_absolute_uri("/").rstrip("/")
    return JsonResponse(
        {
            "name": "Smart Farmer API",
            "status": "ok",
            "endpoints": {
                "health": f"{base_url}/health/",
                "admin": f"{base_url}/admin/",
                "auth": f"{base_url}/api/auth/",
                "marketplace": f"{base_url}/api/marketplace/",
                "orders": f"{base_url}/api/orders/",
                "reviews": f"{base_url}/api/reviews/",
            },
        }
    )


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", api_index),
    path("admin/", admin.site.urls),
    path("health/", healthcheck),
    path("api/auth/", include("accounts.urls")),
    path("api/marketplace/", include("marketplace.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/reviews/", include("reviews.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
