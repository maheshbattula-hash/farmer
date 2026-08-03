from common.serializers import AppModelSerializer

from .models import User


class UserSerializer(AppModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "full_name",
            "contact",
            "city",
            "state",
            "district",
            "pincode",
            "latitude",
            "longitude",
            "is_verified",
        ]
