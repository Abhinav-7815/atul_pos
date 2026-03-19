from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'outlet', 'is_active', 'last_seen']
        read_only_fields = ['id', 'last_seen']
