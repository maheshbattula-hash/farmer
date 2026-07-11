from __future__ import annotations

from rest_framework import serializers

from common.constants import ORDER_STAGES
from common.serializers import AppModelSerializer

from .models import Order, OrderUpdate


class OrderUpdateSerializer(AppModelSerializer):
    update_date_display = serializers.SerializerMethodField()

    class Meta:
        model = OrderUpdate
        fields = ["id", "status", "update_date", "update_date_display", "location"]

    def get_update_date_display(self, obj: OrderUpdate) -> str:
        return obj.update_date.strftime("%Y-%m-%d %H:%M") if obj.update_date else ""


class CustomerOrderSerializer(AppModelSerializer):
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    crop_image = serializers.SerializerMethodField()
    farmer_name = serializers.CharField(source="crop.farmer.full_name", read_only=True)
    farmer_id = serializers.CharField(source="crop.farmer.id", read_only=True)
    tracking = OrderUpdateSerializer(source="updates", many=True, read_only=True)
    order_date_display = serializers.SerializerMethodField()
    stage_index = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "crop_name",
            "crop_image",
            "farmer_name",
            "farmer_id",
            "status",
            "order_date",
            "order_date_display",
            "quantity",
            "total_price",
            "estimated_delivery",
            "current_location",
            "tracking",
            "stage_index",
        ]

    def get_crop_image(self, obj: Order) -> str:
        return obj.crop.image.name if obj.crop.image else ""

    def get_order_date_display(self, obj: Order) -> str:
        return obj.order_date.strftime("%Y-%m-%d") if obj.order_date else ""

    def get_stage_index(self, obj: Order) -> int:
        index = 0
        seen = {update.status for update in obj.updates.all()}
        for stage_position, stage in enumerate(ORDER_STAGES):
            if stage in seen:
                index = stage_position
        return index


class FarmerDashboardOrderSerializer(AppModelSerializer):
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "crop_name",
            "customer_name",
            "customer_email",
            "quantity",
            "total_price",
            "status",
            "order_date",
            "estimated_delivery",
            "current_location",
        ]


class AdminOrderSerializer(AppModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    crop_name = serializers.CharField(source="crop.name", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "customer_name",
            "crop_name",
            "quantity",
            "total_price",
            "status",
            "order_date",
            "estimated_delivery",
            "current_location",
        ]
