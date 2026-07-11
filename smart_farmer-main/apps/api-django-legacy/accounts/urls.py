from django.urls import path

from .views import (
    AdminLoginView,
    DeleteUserView,
    ForgotPasswordView,
    LoginView,
    MeView,
    RegisterView,
    RequestOtpView,
    ResetPasswordView,
    ToggleVerificationView,
    VerifyOtpView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="api-register"),
    path("login/", LoginView.as_view(), name="api-login"),
    path("request-otp/", RequestOtpView.as_view(), name="api-request-otp"),
    path("verify-otp/", VerifyOtpView.as_view(), name="api-verify-otp"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="api-forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="api-reset-password"),
    path("admin/login/", AdminLoginView.as_view(), name="api-admin-login"),
    path("me/", MeView.as_view(), name="api-me"),
    path("admin/users/<str:user_id>/toggle-verification/", ToggleVerificationView.as_view(), name="api-toggle-verification"),
    path("admin/users/<str:user_id>/", DeleteUserView.as_view(), name="api-delete-user"),
]
