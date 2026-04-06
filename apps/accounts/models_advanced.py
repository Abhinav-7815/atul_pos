"""
Advanced User Management Models
- Client (Organization) Management
- Role-Based Access Control (RBAC)
- Permission System
- API Token Management
- Audit Logging
"""
import uuid
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.core.models import BaseModel


# ============================================================================
# CLIENT MANAGEMENT (Multi-Tenancy)
# ============================================================================

class ClientType(models.TextChoices):
    """Types of clients/organizations"""
    ENTERPRISE = 'enterprise', 'Enterprise (Unlimited)'
    BUSINESS = 'business', 'Business (Up to 10 outlets)'
    STARTER = 'starter', 'Starter (Up to 3 outlets)'
    TRIAL = 'trial', 'Trial (30 days)'


class ClientStatus(models.TextChoices):
    """Client account status"""
    ACTIVE = 'active', 'Active'
    SUSPENDED = 'suspended', 'Suspended'
    EXPIRED = 'expired', 'Expired'
    PENDING = 'pending', 'Pending Activation'


class Client(BaseModel):
    """
    Client/Organization Model
    Represents a customer organization (Admin level)
    Managed by Super Admin only
    """
    # Basic Info
    name = models.CharField(max_length=255, help_text="Organization/Business Name")
    slug = models.SlugField(unique=True, help_text="Unique identifier")
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15)

    # Business Details
    business_type = models.CharField(max_length=100, blank=True, help_text="e.g., Ice Cream Parlor")
    gstin = models.CharField(max_length=15, blank=True, null=True, help_text="GST Number")
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='India')

    # Subscription & Limits
    client_type = models.CharField(
        max_length=20,
        choices=ClientType.choices,
        default=ClientType.STARTER
    )
    status = models.CharField(
        max_length=20,
        choices=ClientStatus.choices,
        default=ClientStatus.PENDING
    )

    # Limits
    max_outlets = models.IntegerField(default=3, help_text="Maximum outlets allowed")
    max_users = models.IntegerField(default=10, help_text="Maximum users allowed")
    max_products = models.IntegerField(default=500, help_text="Maximum products allowed")

    # Subscription Dates
    subscription_start = models.DateTimeField(null=True, blank=True)
    subscription_end = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)

    # Features
    features = models.JSONField(
        default=dict,
        help_text="Enabled features {'ai_images': True, 'analytics': True, etc}"
    )

    # Settings
    settings = models.JSONField(
        default=dict,
        help_text="Client-specific settings"
    )

    # Billing
    billing_email = models.EmailField(blank=True)
    billing_address = models.TextField(blank=True)

    # Metadata
    notes = models.TextField(blank=True, help_text="Internal notes (Super Admin only)")

    class Meta:
        verbose_name = "Client Organization"
        verbose_name_plural = "Client Organizations"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.client_type})"

    def is_subscription_active(self):
        """Check if subscription is active"""
        if self.status != ClientStatus.ACTIVE:
            return False

        if self.subscription_end:
            return timezone.now() < self.subscription_end

        if self.trial_end:
            return timezone.now() < self.trial_end

        return True

    def outlets_count(self):
        """Count active outlets"""
        return self.outlets.filter(is_active=True).count()

    def users_count(self):
        """Count active users"""
        User = get_user_model()
        return User.objects.filter(client=self, is_active=True).count()

    def can_add_outlet(self):
        """Check if client can add more outlets"""
        return self.outlets_count() < self.max_outlets

    def can_add_user(self):
        """Check if client can add more users"""
        return self.users_count() < self.max_users


# ============================================================================
# PERMISSION & ROLE SYSTEM
# ============================================================================

class PermissionCategory(models.TextChoices):
    """Permission categories for organization"""
    USER_MANAGEMENT = 'user_management', 'User Management'
    MENU_MANAGEMENT = 'menu_management', 'Menu Management'
    ORDER_MANAGEMENT = 'order_management', 'Order Management'
    INVENTORY = 'inventory', 'Inventory Management'
    ANALYTICS = 'analytics', 'Analytics & Reports'
    OUTLET_MANAGEMENT = 'outlet_management', 'Outlet Management'
    CUSTOMER_MANAGEMENT = 'customer_management', 'Customer Management'
    SETTINGS = 'settings', 'Settings & Configuration'
    DISTRIBUTION = 'distribution', 'Distribution Management'
    FINANCIAL = 'financial', 'Financial Management'


class Permission(BaseModel):
    """
    Granular permissions for system access
    """
    # Basic Info
    name = models.CharField(max_length=100, unique=True, help_text="e.g., can_create_user")
    display_name = models.CharField(max_length=255, help_text="e.g., Can Create Users")
    description = models.TextField(blank=True)

    # Categorization
    category = models.CharField(
        max_length=50,
        choices=PermissionCategory.choices,
        default=PermissionCategory.USER_MANAGEMENT
    )

    # Permission Level
    is_superadmin_only = models.BooleanField(
        default=False,
        help_text="Only super admins can have this permission"
    )

    # Metadata
    resource = models.CharField(max_length=100, help_text="e.g., user, product, order")
    action = models.CharField(max_length=50, help_text="e.g., create, read, update, delete")

    class Meta:
        verbose_name = "Permission"
        verbose_name_plural = "Permissions"
        ordering = ['category', 'name']
        unique_together = ['resource', 'action']

    def __str__(self):
        return f"{self.display_name} ({self.name})"


class Role(BaseModel):
    """
    Role-Based Access Control
    Roles group permissions together
    """
    # Basic Info
    name = models.CharField(max_length=100, help_text="e.g., Outlet Manager")
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)

    # Client Association (null = system-wide role)
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name='roles',
        null=True,
        blank=True,
        help_text="If null, this is a system-wide default role"
    )

    # Permissions
    permissions = models.ManyToManyField(
        Permission,
        related_name='roles',
        blank=True
    )

    # Role Type
    is_system_role = models.BooleanField(
        default=False,
        help_text="System roles cannot be deleted"
    )
    is_superadmin_role = models.BooleanField(
        default=False,
        help_text="Super admin role - has all permissions"
    )
    is_client_admin_role = models.BooleanField(
        default=False,
        help_text="Client admin role - full access within client scope"
    )

    # Priority (for conflict resolution)
    priority = models.IntegerField(
        default=0,
        help_text="Higher priority roles override lower ones"
    )

    class Meta:
        verbose_name = "Role"
        verbose_name_plural = "Roles"
        ordering = ['-priority', 'name']

    def __str__(self):
        if self.client:
            return f"{self.name} ({self.client.name})"
        return f"{self.name} (System)"

    def get_all_permissions(self):
        """Get all permission names for this role"""
        if self.is_superadmin_role:
            return Permission.objects.all()
        return self.permissions.all()


# ============================================================================
# API TOKEN MANAGEMENT
# ============================================================================

class APITokenType(models.TextChoices):
    """Types of API tokens"""
    FULL_ACCESS = 'full_access', 'Full Access'
    READ_ONLY = 'read_only', 'Read Only'
    WRITE_ONLY = 'write_only', 'Write Only'
    CUSTOM = 'custom', 'Custom Permissions'


class APIToken(BaseModel):
    """
    API Token Management
    Super Admin can issue tokens to clients
    """
    # Token Details
    name = models.CharField(max_length=255, help_text="Token purpose/description")
    token = models.CharField(max_length=64, unique=True, editable=False)

    # Association
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name='api_tokens'
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='tokens_created'
    )

    # Token Type & Permissions
    token_type = models.CharField(
        max_length=20,
        choices=APITokenType.choices,
        default=APITokenType.READ_ONLY
    )
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        help_text="Specific permissions for this token (if token_type=custom)"
    )

    # Scope Limitations
    allowed_ips = models.TextField(
        blank=True,
        help_text="Comma-separated list of allowed IP addresses (empty = all)"
    )
    rate_limit = models.IntegerField(
        default=1000,
        help_text="Requests per hour"
    )

    # Validity
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    # Usage Stats
    request_count = models.BigIntegerField(default=0)

    class Meta:
        verbose_name = "API Token"
        verbose_name_plural = "API Tokens"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.client.name})"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = self.generate_token()
        super().save(*args, **kwargs)

    @staticmethod
    def generate_token():
        """Generate a secure random token"""
        import secrets
        return secrets.token_urlsafe(48)

    def is_valid(self):
        """Check if token is valid"""
        if not self.is_active:
            return False

        if self.expires_at and timezone.now() > self.expires_at:
            return False

        return True

    def check_ip_allowed(self, ip_address):
        """Check if IP is allowed"""
        if not self.allowed_ips:
            return True

        allowed = [ip.strip() for ip in self.allowed_ips.split(',')]
        return ip_address in allowed


# ============================================================================
# USER ACTIVITY LOG
# ============================================================================

class UserActivityType(models.TextChoices):
    """Types of user activities to log"""
    LOGIN = 'login', 'User Login'
    LOGOUT = 'logout', 'User Logout'
    CREATE = 'create', 'Created Record'
    UPDATE = 'update', 'Updated Record'
    DELETE = 'delete', 'Deleted Record'
    VIEW = 'view', 'Viewed Record'
    EXPORT = 'export', 'Exported Data'
    SETTINGS_CHANGE = 'settings_change', 'Changed Settings'
    PERMISSION_CHANGE = 'permission_change', 'Permission Changed'
    TOKEN_GENERATED = 'token_generated', 'API Token Generated'
    FAILED_LOGIN = 'failed_login', 'Failed Login Attempt'


class UserActivity(models.Model):
    """
    Audit log for user activities
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # User & Client
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='activities'
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='activities'
    )

    # Activity Details
    activity_type = models.CharField(
        max_length=50,
        choices=UserActivityType.choices
    )
    description = models.TextField()

    # Context
    resource_type = models.CharField(max_length=100, blank=True)  # e.g., 'product', 'user'
    resource_id = models.CharField(max_length=100, blank=True)

    # Request Details
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    # Data Changes (for audit)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "User Activity"
        verbose_name_plural = "User Activities"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['client', '-created_at']),
            models.Index(fields=['activity_type', '-created_at']),
        ]

    def __str__(self):
        user_email = self.user.email if self.user else 'Unknown'
        return f"{user_email} - {self.activity_type} - {self.created_at}"


# ============================================================================
# CLIENT SETTINGS
# ============================================================================

class ClientSettings(models.Model):
    """
    Detailed settings for each client
    """
    client = models.OneToOneField(
        Client,
        on_delete=models.CASCADE,
        related_name='detailed_settings',
        primary_key=True
    )

    # Branding
    logo = models.ImageField(upload_to='client_logos/', null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#6366F1')
    secondary_color = models.CharField(max_length=7, default='#EC4899')

    # Business Settings
    currency = models.CharField(max_length=3, default='INR')
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')
    date_format = models.CharField(max_length=50, default='DD/MM/YYYY')

    # Notifications
    email_notifications = models.BooleanField(default=True)
    sms_notifications = models.BooleanField(default=False)

    # AI Features
    ai_image_generation_enabled = models.BooleanField(default=False)
    ai_image_monthly_quota = models.IntegerField(default=100)
    ai_provider = models.CharField(max_length=50, default='gemini')

    # Analytics
    analytics_retention_days = models.IntegerField(default=90)

    # API Access
    api_enabled = models.BooleanField(default=True)
    webhook_url = models.URLField(blank=True)

    # Security
    require_2fa = models.BooleanField(default=False)
    session_timeout_minutes = models.IntegerField(default=480)  # 8 hours
    password_expiry_days = models.IntegerField(default=0)  # 0 = never

    # Custom Fields
    custom_fields = models.JSONField(default=dict)

    # Timestamps
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Client Settings"
        verbose_name_plural = "Client Settings"

    def __str__(self):
        return f"Settings for {self.client.name}"
