from rest_framework import serializers


class AppModelSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
