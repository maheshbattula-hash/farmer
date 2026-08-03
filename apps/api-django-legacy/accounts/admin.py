from django.contrib import admin
from .models import AuthChallenge, OtpRequest, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "role", "is_verified")
    search_fields = ("username", "email", "full_name")
    list_filter = ("role", "is_verified")


@admin.register(AuthChallenge)
class AuthChallengeAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "purpose", "is_active", "verified_at", "created_at")
    search_fields = ("email",)
    list_filter = ("purpose", "is_active")


@admin.register(OtpRequest)
class OtpRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "scope", "requested_at")
    search_fields = ("email", "scope")
