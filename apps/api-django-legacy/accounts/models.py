from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_ADMIN = "admin"
    ROLE_FARMER = "farmer"
    ROLE_CUSTOMER = "customer"
    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_FARMER, "Farmer"),
        (ROLE_CUSTOMER, "Customer"),
    ]

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default=ROLE_CUSTOMER)
    full_name = models.CharField(max_length=255, blank=True)
    contact = models.CharField(max_length=32, blank=True)
    city = models.CharField(max_length=128, blank=True)
    state = models.CharField(max_length=128, blank=True)
    district = models.CharField(max_length=128, blank=True)
    pincode = models.CharField(max_length=16, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)

    def __str__(self) -> str:
        return self.username


class OtpRequest(models.Model):
    email = models.EmailField()
    scope = models.CharField(max_length=64)
    requested_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["email", "scope", "requested_at"])]


class AuthChallenge(models.Model):
    PURPOSE_LOGIN = "login"
    PURPOSE_PASSWORD_RESET = "password_reset"
    PURPOSE_ADMIN = "admin"
    PURPOSE_CHOICES = [
        (PURPOSE_LOGIN, "Login"),
        (PURPOSE_PASSWORD_RESET, "Password Reset"),
        (PURPOSE_ADMIN, "Admin Login"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="auth_challenges")
    email = models.EmailField()
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES)
    otp_code = models.CharField(max_length=6, blank=True)
    otp_requested_at = models.DateTimeField(null=True, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    credential_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.email} ({self.purpose})"
