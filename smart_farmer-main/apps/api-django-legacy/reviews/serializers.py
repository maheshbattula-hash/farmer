from rest_framework import serializers

from common.serializers import AppModelSerializer

from .models import Review


class ReviewSerializer(AppModelSerializer):
    order = serializers.CharField(source="order_id", read_only=True, allow_null=True)
    customer = serializers.CharField(source="customer_id", read_only=True)
    farmer = serializers.CharField(source="farmer_id", read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "order", "customer", "customer_name", "farmer", "rating", "comment", "created_at"]
