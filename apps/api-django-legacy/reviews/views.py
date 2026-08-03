from rest_framework import status
from rest_framework.views import APIView

from common.permissions import IsCustomer
from common.responses import err, ok
from orders.models import Order

from .models import Review
from .serializers import ReviewSerializer


class SubmitReviewView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        order_id = request.data.get("order_id")
        farmer_id = request.data.get("farmer_id")
        rating = int(request.data.get("rating") or 0)
        comment = request.data.get("comment") or ""

        order = Order.objects.filter(id=order_id, customer=request.user).first()
        if not order:
            return err("Order not found or unauthorized.", "order_not_found", 404)
        if rating < 1 or rating > 5:
            return err("Rating must be between 1 and 5.", "invalid_rating", 400)

        review = Review.objects.create(
            order=order,
            customer=request.user,
            farmer_id=farmer_id,
            rating=rating,
            comment=comment,
        )
        return ok("Review submitted! Thank you for your feedback.", {"review": ReviewSerializer(review).data}, status.HTTP_201_CREATED)
