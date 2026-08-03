from django.contrib import admin
from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "farmer", "customer", "rating", "created_at")
    search_fields = ("farmer__username", "customer__username", "comment")
