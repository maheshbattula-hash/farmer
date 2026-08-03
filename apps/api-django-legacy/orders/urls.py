from django.urls import path

from .views import (
    AdminDashboardView,
    AdminUpdateOrderView,
    CancelOrderView,
    ConfirmPaymentView,
    FarmerUpdateOrderView,
    MyOrdersView,
    OrderDetailView,
    PlaceOrderView,
)

urlpatterns = [
    path("place/", PlaceOrderView.as_view(), name="api-place-order"),
    path("my/", MyOrdersView.as_view(), name="api-my-orders"),
    path("<str:order_id>/", OrderDetailView.as_view(), name="api-order-detail"),
    path("<str:order_id>/cancel/", CancelOrderView.as_view(), name="api-cancel-order"),
    path("confirm-payment/", ConfirmPaymentView.as_view(), name="api-confirm-payment"),
    path("farmer/update-status/", FarmerUpdateOrderView.as_view(), name="api-farmer-update-order"),
    path("admin/dashboard/", AdminDashboardView.as_view(), name="api-admin-dashboard"),
    path("admin/orders/<str:order_id>/status/", AdminUpdateOrderView.as_view(), name="api-admin-update-order"),
]
