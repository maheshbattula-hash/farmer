from __future__ import annotations

from rest_framework import serializers

from common.serializers import AppModelSerializer

from .models import Crop


class CropMarketplaceSerializer(AppModelSerializer):
    farmer_name = serializers.CharField(source="farmer.full_name", read_only=True)
    farmer_city = serializers.CharField(source="farmer.city", read_only=True)
    farmer_id = serializers.CharField(source="farmer.id", read_only=True)
    is_verified = serializers.BooleanField(source="farmer.is_verified", read_only=True)
    image_url = serializers.SerializerMethodField()
    quality_proof = serializers.SerializerMethodField()

    class Meta:
        model = Crop
        fields = [
            "id",
            "farmer_id",
            "name",
            "category",
            "quantity",
            "price",
            "harvest_date",
            "state",
            "district",
            "village",
            "pincode",
            "description",
            "image_url",
            "quality",
            "quality_proof",
            "farmer_name",
            "farmer_city",
            "is_verified",
        ]

    def get_image_url(self, obj: Crop) -> str:
        return obj.image.name if obj.image else ""

    def get_quality_proof(self, obj: Crop) -> str:
        return obj.quality_proof.name if obj.quality_proof else ""
