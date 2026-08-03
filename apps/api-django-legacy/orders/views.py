from __future__ import annotations

from collections import Counter, defaultdict
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView

from accounts.serializers import UserSerializer
from common.db import atomic_if_supported, using_mongodb
from common.permissions import IsAdminRole, IsCustomer, IsFarmer
from common.responses import err, ok
from marketplace.models import Crop
from marketplace.serializers import CropMarketplaceSerializer

from .models import Order
from .serializers import AdminOrderSerializer, CustomerOrderSerializer, FarmerDashboardOrderSerializer
from .services import (
    estimate_delivery,
    notify_customer_farmer_approved,
    notify_customer_payment_confirmed,
    notify_farmer_new_order,
    record_order_update,
)

User = get_user_model()


class PlaceOrderView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        crop_id = request.data.get("crop_id")
        quantity = Decimal(str(request.data.get("quantity") or "0"))
        crop = Crop.objects.select_related("farmer").filter(id=crop_id).first()
        if not crop:
            return err("Crop not found", "crop_not_found", 404)
        if quantity <= 0:
            return err("Requested quantity must be greater than zero", "invalid_quantity", 400)

        with atomic_if_supported():
            crop_queryset = Crop.objects.select_related("farmer")
            if not using_mongodb():
                crop_queryset = crop_queryset.select_for_update()
            crop = crop_queryset.get(id=crop.id)
            if crop.quantity < quantity:
                return err("Requested quantity not available", "insufficient_stock", 400)
            total_price = quantity * crop.price
            order = Order.objects.create(
                customer=request.user,
                crop=crop,
                quantity=quantity,
                total_price=total_price,
                estimated_delivery=estimate_delivery(request.user, crop.farmer),
                current_location=crop.farmer.city or crop.farmer.state,
            )
            record_order_update(order, "Order Placed", crop.farmer.city or crop.farmer.state)
            crop.quantity = crop.quantity - quantity
            crop.save(update_fields=["quantity", "updated_at"])

        notify_farmer_new_order(order)
        return ok(
            "Order placed! Proceed to payment.",
            {
                "order": CustomerOrderSerializer(Order.objects.select_related("crop", "crop__farmer").get(id=order.id)).data,
                "order_id": order.id,
                "redirect": f"/checkout/{order.id}",
            },
            status.HTTP_201_CREATED,
        )


class MyOrdersView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        orders = Order.objects.filter(customer=request.user).select_related("crop", "crop__farmer").all()
        serialized = CustomerOrderSerializer(orders, many=True).data
        active_orders = [order for order in serialized if order["status"] not in ["Delivered", "Cancelled"]]
        order_history = [order for order in serialized if order["status"] in ["Delivered", "Cancelled"]]
        return ok("Orders loaded", {"active_orders": active_orders, "order_history": order_history})


class OrderDetailView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request, order_id: str):
        order = Order.objects.filter(id=order_id, customer=request.user).select_related("crop", "crop__farmer").first()
        if not order:
            return err("Order not found", "order_not_found", 404)
        return ok("Order loaded", {"order": CustomerOrderSerializer(order).data})


class CancelOrderView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, order_id: str):
        order = Order.objects.filter(id=order_id, customer=request.user).select_related("crop", "crop__farmer").first()
        if not order:
            return err("Order not found or unauthorized.", "order_not_found", 404)
        if order.status not in ["pending", "Paid", "Order Confirmed"]:
            return err("Cannot cancel an order that has already been shipped or completed.", "order_not_cancellable", 400)
        order.status = "Cancelled"
        order.save(update_fields=["status"])
        record_order_update(order, "Cancelled", "System")
        return ok("Order has been cancelled successfully.")


class ConfirmPaymentView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        order_id = request.data.get("order_id")
        order = Order.objects.filter(id=order_id, customer=request.user).select_related("crop", "crop__farmer", "customer").first()
        if not order:
            return err("Order not found", "order_not_found", 404)
        order.status = "Paid"
        order.save(update_fields=["status"])
        record_order_update(order, "Paid", order.current_location or "Payment confirmed")
        notify_customer_payment_confirmed(order)
        return ok("Payment successful! A confirmation email has been queued.")


class FarmerUpdateOrderView(APIView):
    permission_classes = [IsFarmer]

    def post(self, request):
        order_id = request.data.get("order_id")
        new_status = request.data.get("status") or "pending"
        location = request.data.get("location") or ""
        order = Order.objects.filter(id=order_id, crop__farmer=request.user).select_related("crop", "crop__farmer", "customer").first()
        if not order:
            return err("Order not found or unauthorized", "order_not_found", 404)
        previous_status = order.status
        order.status = new_status
        order.current_location = location
        order.save(update_fields=["status", "current_location"])
        record_order_update(order, new_status, location)
        if new_status == "Order Confirmed" and previous_status != "Order Confirmed":
            notify_customer_farmer_approved(order)
        return ok(f"Order #{order.id} status updated to {new_status}")


class AdminUpdateOrderView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, order_id: str):
        order = Order.objects.filter(id=order_id).select_related("crop", "crop__farmer", "customer").first()
        if not order:
            return err("Order not found", "order_not_found", 404)
        status_value = request.data.get("status") or order.status
        order.status = status_value
        order.save(update_fields=["status"])
        record_order_update(order, status_value, order.current_location or "Admin dashboard")
        return ok(f"Order #{order.id} status updated to {status_value}")


class AdminDashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        users = list(User.objects.all().order_by("id"))
        crops = list(Crop.objects.select_related("farmer").all())
        orders = list(Order.objects.select_related("customer", "crop", "crop__farmer").all())

        total_farmers = sum(1 for user in users if user.role == User.ROLE_FARMER)
        total_crops = len(crops)
        total_orders = len(orders)

        paid_orders = [order for order in orders if order.status == "Paid"]
        total_revenue = sum(float(order.total_price or 0) for order in paid_orders)

        category_counts = Counter((crop.category or "Uncategorized") for crop in crops)
        revenue_by_day = defaultdict(float)
        for order in paid_orders:
            if not order.order_date:
                continue
            day = timezone.localtime(order.order_date).date().isoformat()
            revenue_by_day[day] += float(order.total_price or 0)

        revenue_trend = [[day, total] for day, total in sorted(revenue_by_day.items(), reverse=True)[:7]]

        return ok(
            "Admin dashboard loaded",
            {
                "users": UserSerializer(users, many=True).data,
                "crops": CropMarketplaceSerializer(crops, many=True).data,
                "orders": AdminOrderSerializer(orders, many=True).data,
                "total_farmers": total_farmers,
                "total_crops": total_crops,
                "total_orders": total_orders,
                "total_revenue": total_revenue,
                "category_counts": [[category, count] for category, count in category_counts.items()],
                "revenue_trend": revenue_trend,
            },
        )
