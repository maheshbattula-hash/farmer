from django.conf import settings
from django.db import models


class Order(models.Model):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders")
    crop = models.ForeignKey("marketplace.Crop", on_delete=models.CASCADE, related_name="orders")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=64, default="pending")
    order_date = models.DateTimeField(auto_now_add=True)
    estimated_delivery = models.CharField(max_length=128, blank=True)
    current_location = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-order_date"]

    def __str__(self) -> str:
        return f"Order #{self.pk}"


class OrderUpdate(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="updates")
    status = models.CharField(max_length=64)
    update_date = models.DateTimeField(auto_now_add=True)
    location = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["update_date"]

    def __str__(self) -> str:
        return f"{self.order_id} - {self.status}"
