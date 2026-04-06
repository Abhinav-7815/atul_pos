"""
Serializers for Advanced User Management
- Client Management
- Role & Permission Management
- API Token Management
- User Activity Logs
"""
from rest_framework import serializers
from apps.accounts.models import User, UserRole
from apps.accounts.models_advanced import (
    Client, ClientType, ClientStatus,
    Permission, PermissionCategory,
    Role,
    APIToken, APITokenType,
    UserActivity, UserActivityType,
    ClientSettings
)


# ============================================================================
# CLIENT SERIALIZERS
# ============================================================================

class ClientListSerializer(serializers.ModelSerializer):
    """Serializer for listing clients"""
    outlets_count = serializers.SerializerMethodField()
    users_count = serializers.SerializerMethodField()
    is_subscription_active = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id', 'name', 'slug', 'email', 'phone',
            'client_type', 'status',
            'outlets_count', 'users_count',
            'subscription_start', 'subscription_end',
            'is_subscription_active',
            'created_at', 'updated_at'
        ]

    def get_outlets_count(self, obj):
        return obj.outlets_count()

    def get_users_count(self, obj):
        return obj.users_count()

    def get_is_subscription_active(self, obj):
        return obj.is_subscription_active()


class ClientDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for single client"""
    outlets_count = serializers.SerializerMethodField()
    users_count = serializers.SerializerMethodField()
    is_subscription_active = serializers.SerializerMethodField()
    can_add_outlet = serializers.SerializerMethodField()
    can_add_user = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = '__all__'

    def get_outlets_count(self, obj):
        return obj.outlets_count()

    def get_users_count(self, obj):
        return obj.users_count()

    def get_is_subscription_active(self, obj):
        return obj.is_subscription_active()

    def get_can_add_outlet(self, obj):
        return obj.can_add_outlet()

    def get_can_add_user(self, obj):
        return obj.can_add_user()


class ClientCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating clients"""

    class Meta:
        model = Client
        fields = [
            'name', 'slug', 'email', 'phone',
            'business_type', 'gstin',
            'address', 'city', 'state', 'country',
            'client_type', 'status',
            'max_outlets', 'max_users', 'max_products',
            'subscription_start', 'subscription_end', 'trial_end',
            'features', 'settings',
            'billing_email', 'billing_address',
            'notes'
        ]

    def validate_email(self, value):
        """Ensure email is unique"""
        if Client.objects.filter(email=value).exists():
            raise serializers.ValidationError("Client with this email already exists")
        return value

    def validate_slug(self, value):
        """Ensure slug is unique and valid"""
        if Client.objects.filter(slug=value).exists():
            raise serializers.ValidationError("Client with this slug already exists")
        return value


class ClientUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating clients"""

    class Meta:
        model = Client
        fields = [
            'name', 'email', 'phone',
            'business_type', 'gstin',
            'address', 'city', 'state', 'country',
            'client_type', 'status',
            'max_outlets', 'max_users', 'max_products',
            'subscription_start', 'subscription_end', 'trial_end',
            'features', 'settings',
            'billing_email', 'billing_address',
            'notes'
        ]


# ============================================================================
# PERMISSION SERIALIZERS
# ============================================================================

class PermissionSerializer(serializers.ModelSerializer):
    """Serializer for permissions"""

    class Meta:
        model = Permission
        fields = [
            'id', 'name', 'display_name', 'description',
            'category', 'resource', 'action',
            'is_superadmin_only',
            'created_at', 'updated_at'
        ]


class PermissionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating permissions"""

    class Meta:
        model = Permission
        fields = [
            'name', 'display_name', 'description',
            'category', 'resource', 'action',
            'is_superadmin_only'
        ]


# ============================================================================
# ROLE SERIALIZERS
# ============================================================================

class RoleListSerializer(serializers.ModelSerializer):
    """Serializer for listing roles"""
    client_name = serializers.SerializerMethodField()
    permissions_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            'id', 'name', 'slug', 'description',
            'client', 'client_name',
            'is_system_role', 'is_superadmin_role', 'is_client_admin_role',
            'priority', 'permissions_count',
            'created_at', 'updated_at'
        ]

    def get_client_name(self, obj):
        return obj.client.name if obj.client else 'System'

    def get_permissions_count(self, obj):
        return obj.permissions.count()


class RoleDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for single role"""
    client_name = serializers.SerializerMethodField()
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = '__all__'

    def get_client_name(self, obj):
        return obj.client.name if obj.client else 'System'


class RoleCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating roles"""
    permission_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Role
        fields = [
            'name', 'slug', 'description',
            'client',
            'is_system_role', 'is_superadmin_role', 'is_client_admin_role',
            'priority',
            'permission_ids'
        ]

    def create(self, validated_data):
        permission_ids = validated_data.pop('permission_ids', [])
        role = Role.objects.create(**validated_data)

        if permission_ids:
            permissions = Permission.objects.filter(id__in=permission_ids)
            role.permissions.set(permissions)

        return role


class RoleUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating roles"""
    permission_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Role
        fields = [
            'name', 'description',
            'is_client_admin_role', 'priority',
            'permission_ids'
        ]

    def update(self, instance, validated_data):
        permission_ids = validated_data.pop('permission_ids', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if permission_ids is not None:
            permissions = Permission.objects.filter(id__in=permission_ids)
            instance.permissions.set(permissions)

        return instance


# ============================================================================
# API TOKEN SERIALIZERS
# ============================================================================

class APITokenListSerializer(serializers.ModelSerializer):
    """Serializer for listing API tokens"""
    client_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()
    token_display = serializers.SerializerMethodField()

    class Meta:
        model = APIToken
        fields = [
            'id', 'name', 'token_display',
            'client', 'client_name',
            'created_by', 'created_by_name',
            'token_type', 'is_active', 'is_valid',
            'rate_limit', 'request_count',
            'expires_at', 'last_used_at',
            'created_at'
        ]

    def get_client_name(self, obj):
        return obj.client.name if obj.client else None

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else 'System'

    def get_is_valid(self, obj):
        return obj.is_valid()

    def get_token_display(self, obj):
        """Show only first 8 characters of token"""
        return f"{obj.token[:8]}...{obj.token[-4:]}"


class APITokenDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for API token (includes full token)"""
    client_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        model = APIToken
        fields = '__all__'

    def get_client_name(self, obj):
        return obj.client.name if obj.client else None

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else 'System'

    def get_is_valid(self, obj):
        return obj.is_valid()


class APITokenCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating API tokens"""
    permission_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = APIToken
        fields = [
            'name', 'client', 'token_type',
            'allowed_ips', 'rate_limit',
            'expires_at',
            'permission_ids'
        ]

    def create(self, validated_data):
        permission_ids = validated_data.pop('permission_ids', [])
        created_by = self.context['request'].user

        token = APIToken.objects.create(
            created_by=created_by,
            **validated_data
        )

        if permission_ids:
            permissions = Permission.objects.filter(id__in=permission_ids)
            token.permissions.set(permissions)

        return token


# ============================================================================
# USER ACTIVITY SERIALIZERS
# ============================================================================

class UserActivitySerializer(serializers.ModelSerializer):
    """Serializer for user activity logs"""
    user_email = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = UserActivity
        fields = [
            'id', 'user', 'user_email',
            'client', 'client_name',
            'activity_type', 'description',
            'resource_type', 'resource_id',
            'ip_address', 'user_agent',
            'old_values', 'new_values',
            'created_at'
        ]

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None

    def get_client_name(self, obj):
        return obj.client.name if obj.client else None


# ============================================================================
# CLIENT SETTINGS SERIALIZERS
# ============================================================================

class ClientSettingsSerializer(serializers.ModelSerializer):
    """Serializer for client settings"""

    class Meta:
        model = ClientSettings
        fields = '__all__'


# ============================================================================
# ENHANCED USER SERIALIZERS
# ============================================================================

class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users with client info"""
    client_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    custom_role_name = serializers.SerializerMethodField()
    outlet_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'full_name', 'phone',
            'client', 'client_name',
            'role', 'role_display',
            'custom_role', 'custom_role_name',
            'outlet', 'outlet_name',
            'is_active', 'is_email_verified',
            'last_seen', 'login_count',
            'date_joined'
        ]

    def get_client_name(self, obj):
        return obj.client.name if obj.client else 'Platform'

    def get_custom_role_name(self, obj):
        return obj.custom_role.name if obj.custom_role else None

    def get_outlet_name(self, obj):
        return obj.outlet.name if obj.outlet else None


class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for single user"""
    client_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    custom_role_detail = RoleListSerializer(source='custom_role', read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'full_name', 'phone',
            'client', 'client_name',
            'role', 'role_display',
            'custom_role', 'custom_role_detail',
            'outlet',
            'is_active', 'is_staff', 'is_email_verified',
            'last_seen', 'last_login_ip', 'login_count',
            'date_joined', 'password_changed_at',
            'permissions'
        ]

    def get_client_name(self, obj):
        return obj.client.name if obj.client else 'Platform'

    def get_permissions(self, obj):
        """Get all permissions for user"""
        permissions = obj.get_permissions()
        return PermissionSerializer(permissions, many=True).data


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users"""
    password = serializers.CharField(write_only=True, required=True)
    pin = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'email', 'password', 'full_name', 'phone',
            'client', 'role', 'custom_role',
            'outlet', 'pin',
            'is_active'
        ]

    def validate(self, data):
        """Validate user creation data"""
        request_user = self.context['request'].user

        # Client admins can only create users in their client
        if not request_user.is_superadmin():
            if data.get('client') != request_user.client:
                raise serializers.ValidationError("You can only create users in your organization")

            # Can't create super admins or assign to different clients
            if data.get('role') == UserRole.SUPERADMIN:
                raise serializers.ValidationError("You cannot create super admin users")

        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        pin = validated_data.pop('pin', None)

        user = User.objects.create_user(
            password=password,
            **validated_data
        )

        if pin:
            user.set_pin(pin)
            user.save()

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating users"""

    class Meta:
        model = User
        fields = [
            'full_name', 'phone',
            'role', 'custom_role',
            'outlet',
            'is_active'
        ]

    def validate(self, data):
        """Validate user update data"""
        request_user = self.context['request'].user
        target_user = self.instance

        # Client admins can't modify users outside their client
        if not request_user.is_superadmin():
            if target_user.client != request_user.client:
                raise serializers.ValidationError("You can only modify users in your organization")

            # Can't change to super admin
            if data.get('role') == UserRole.SUPERADMIN:
                raise serializers.ValidationError("You cannot assign super admin role")

        return data
