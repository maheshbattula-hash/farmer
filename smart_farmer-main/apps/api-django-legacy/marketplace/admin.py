from django.contrib import admin
from .models import Crop


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "farmer", "category", "quantity", "price")
    search_fields = ("name", "farmer__username", "farmer__email")
    list_filter = ("category", "state", "district")
