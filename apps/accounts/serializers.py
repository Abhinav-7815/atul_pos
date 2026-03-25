from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    password     = serializers.CharField(write_only=True, required=False, allow_blank=True)
    outlet_name  = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'full_name', 'role', 'phone',
            'outlet', 'outlet_name',
            'is_active', 'last_seen',
            'password',
        ]
        read_only_fields = ['id', 'last_seen']

    def get_outlet_name(self, obj):
        return obj.outlet.name if obj.outlet else None

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
