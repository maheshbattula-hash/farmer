from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from accounts.services import send_email_message

from .models import Order, OrderUpdate


def estimate_delivery(customer, farmer) -> str:
    days = 5
    if farmer.state and customer.state and farmer.state == customer.state:
        days = 3
        if farmer.city and customer.city and farmer.city == customer.city:
            days = 1
    target_date = timezone.localtime(timezone.now()) + timedelta(days=days)
    return target_date.strftime("%d %b, %Y")


def record_order_update(order: Order, status: str, location: str = "") -> OrderUpdate:
    return OrderUpdate.objects.create(order=order, status=status, location=location or "")


def notify_farmer_new_order(order: Order) -> None:
    farmer = order.crop.farmer
    customer = order.customer
    if not farmer.email:
        return
    send_email_message(
        farmer.email,
        "New Order Request - Smart Farmer Market",
        (
            f"Hello {farmer.full_name},\n\n"
            f"You have received a new order request for {order.crop.name}.\n"
            f"Customer: {customer.full_name}\n"
            f"Quantity: {order.quantity} kg\n"
            f"Order value: Rs. {order.total_price:.2f}\n"
            f"Estimated delivery: {order.estimated_delivery}\n\n"
            "Please review the order in your farmer dashboard and approve it when ready."
        ),
    )


def notify_customer_farmer_approved(order: Order) -> None:
    customer = order.customer
    farmer = order.crop.farmer
    if not customer.email:
        return
    send_email_message(
        customer.email,
        "Farmer Approved Your Order - Smart Farmer Market",
        (
            f"Hello {customer.full_name},\n\n"
            f"The farmer has approved your order for {order.crop.name}.\n"
            f"Farmer: {farmer.full_name}\n"
            f"Quantity: {order.quantity} kg\n"
            f"Order value: Rs. {order.total_price:.2f}\n\n"
            "You can track the latest status from your customer dashboard."
        ),
    )


def notify_customer_payment_confirmed(order: Order) -> None:
    customer = order.customer
    if not customer.email:
        return
    send_email_message(
        customer.email,
        "Order Confirmed - Smart Farmer Market",
        (
            f"Hello {customer.full_name},\n\n"
            f"Your order for {order.crop.name} has been confirmed. "
            f"Total paid: Rs. {order.total_price}\n\n"
            "Thank you for shopping local!"
        ),
    )
