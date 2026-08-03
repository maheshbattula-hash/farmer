from django.contrib import admin
from .models import Order, OrderUpdate


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "crop", "status", "total_price", "order_date")
    search_fields = ("customer__username", "customer__email", "crop__name")
    list_filter = ("status",)


@admin.register(OrderUpdate)
class OrderUpdateAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "status", "location", "update_date")
    search_fields = ("order__id", "status", "location")
