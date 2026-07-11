from django.urls import path

from .views import CropListView, FarmerCropCreateView, FarmerCropDetailView, FarmerDashboardView, FarmerProfileView

urlpatterns = [
    path("crops/", CropListView.as_view(), name="api-crops"),
    path("farmers/<str:farmer_id>/profile/", FarmerProfileView.as_view(), name="api-farmer-profile"),
    path("farmer/dashboard/", FarmerDashboardView.as_view(), name="api-farmer-dashboard"),
    path("farmer/crops/", FarmerCropCreateView.as_view(), name="api-farmer-crop-create"),
    path("farmer/crops/<str:crop_id>/", FarmerCropDetailView.as_view(), name="api-farmer-crop-detail"),
]
