from django.conf import settings
from django.db import models


class Crop(models.Model):
    farmer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="crops")
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=128, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    harvest_date = models.DateField(null=True, blank=True)
    state = models.CharField(max_length=128, blank=True)
    district = models.CharField(max_length=128, blank=True)
    village = models.CharField(max_length=128, blank=True)
    pincode = models.CharField(max_length=16, blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="uploads/", blank=True, null=True)
    quality = models.CharField(max_length=128, blank=True)
    quality_proof = models.ImageField(upload_to="uploads/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name
