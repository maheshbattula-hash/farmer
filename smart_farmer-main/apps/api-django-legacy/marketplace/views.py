from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView

from accounts.serializers import UserSerializer
from common.constants import MARKETPLACE_CATEGORIES, MARKETPLACE_STATES
from common.db import ids_match
from common.permissions import IsFarmer
from common.responses import err, ok
from reviews.models import Review
from reviews.serializers import ReviewSerializer

from .models import Crop
from .serializers import CropMarketplaceSerializer

User = get_user_model()


def file_too_large(upload) -> bool:
    return bool(upload and getattr(upload, "size", 0) > 2 * 1024 * 1024)


class CropListView(APIView):
    def get(self, request):
        query = (request.query_params.get("query") or "").strip()
        state = (request.query_params.get("state") or "").strip()
        district = (request.query_params.get("district") or "").strip()
        category = (request.query_params.get("category") or "").strip()

        crops = Crop.objects.select_related("farmer").all()
        if query:
            crops = crops.filter(Q(name__icontains=query) | Q(description__icontains=query))
        if state:
            crops = crops.filter(state=state)
        if district:
            crops = crops.filter(district=district)
        if category:
            crops = crops.filter(category=category)

        return ok(
            "Marketplace loaded",
            {
                "crops": CropMarketplaceSerializer(crops, many=True).data,
                "categories": MARKETPLACE_CATEGORIES,
                "states": MARKETPLACE_STATES,
            },
        )


class FarmerProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, farmer_id: str):
        farmer = User.objects.filter(id=farmer_id, role=User.ROLE_FARMER).first()
        if not farmer:
            return err("Farmer not found", "farmer_not_found", status.HTTP_404_NOT_FOUND)

        crops = Crop.objects.filter(farmer=farmer).select_related("farmer")
        reviews = list(Review.objects.filter(farmer=farmer).select_related("customer").order_by("-created_at"))
        avg_rating = (sum(float(review.rating or 0) for review in reviews) / len(reviews)) if reviews else 0
        return ok(
            "Farmer profile loaded",
            {
                "farmer": UserSerializer(farmer).data,
                "crops": CropMarketplaceSerializer(crops, many=True).data,
                "reviews": ReviewSerializer(reviews, many=True).data,
                "avg_rating": float(avg_rating) if avg_rating else 0,
            },
        )


class FarmerDashboardView(APIView):
    permission_classes = [IsFarmer]

    def get(self, request):
        crops = Crop.objects.filter(farmer=request.user).select_related("farmer")
        from orders.models import Order

        orders = (
            Order.objects.filter(crop__farmer=request.user)
            .select_related("crop", "customer")
            .all()
            .order_by("-order_date")
        )
        from orders.serializers import FarmerDashboardOrderSerializer

        return ok(
            "Farmer dashboard loaded",
            {
                "crops": CropMarketplaceSerializer(crops, many=True).data,
                "orders": FarmerDashboardOrderSerializer(orders, many=True).data,
                "is_verified": request.user.is_verified,
            },
        )


class FarmerCropCreateView(APIView):
    permission_classes = [IsFarmer]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        image = request.FILES.get("image")
        quality_proof = request.FILES.get("quality_proof")
        if file_too_large(image):
            return err("Crop image too large (Max 2MB)", "image_too_large", 400)
        if file_too_large(quality_proof):
            return err("Quality proof too large (Max 2MB)", "proof_too_large", 400)

        crop = Crop.objects.create(
            farmer=request.user,
            name=request.data.get("name") or "",
            category=request.data.get("category") or "Others",
            quantity=request.data.get("quantity") or 0,
            price=request.data.get("price") or 0,
            harvest_date=request.data.get("harvest_date") or None,
            state=request.data.get("state") or "",
            district=request.data.get("district") or "",
            village=request.data.get("village") or "",
            pincode=request.data.get("pincode") or "",
            description=request.data.get("description") or "",
            quality=request.data.get("quality") or "Standard",
            image=image,
            quality_proof=quality_proof,
        )
        return ok("Crop added successfully!", {"crop": CropMarketplaceSerializer(crop).data}, status.HTTP_201_CREATED)


class FarmerCropDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, request, crop_id: str):
        queryset = Crop.objects.select_related("farmer")
        crop = queryset.filter(id=crop_id).first()
        if not crop:
            return None
        if request.user.role == User.ROLE_ADMIN:
            return crop
        if not ids_match(crop.farmer_id, request.user.id):
            return None
        return crop

    def get(self, request, crop_id: str):
        crop = self.get_object(request, crop_id)
        if not crop:
            return err("Crop not found or unauthorized", "crop_not_found", 404)
        return ok("Crop loaded", {"crop": CropMarketplaceSerializer(crop).data})

    def patch(self, request, crop_id: str):
        crop = self.get_object(request, crop_id)
        if not crop:
            return err("Crop not found or unauthorized", "crop_not_found", 404)

        crop.name = request.data.get("name", crop.name)
        crop.quantity = request.data.get("quantity", crop.quantity)
        crop.price = request.data.get("price", crop.price)
        crop.description = request.data.get("description", crop.description)
        crop.save()
        return ok("Crop updated successfully!", {"crop": CropMarketplaceSerializer(crop).data})

    def delete(self, request, crop_id: str):
        crop = self.get_object(request, crop_id)
        if not crop:
            return err("Crop not found or unauthorized", "crop_not_found", 404)
        crop.delete()
        return ok("Crop deleted successfully")
