from django.urls import path

from .views import SubmitReviewView

urlpatterns = [
    path("submit/", SubmitReviewView.as_view(), name="api-submit-review"),
]
