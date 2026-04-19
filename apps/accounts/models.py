import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from apps.outlets.models import Outlet
from django.db.models import Q

class UserRole(models.TextChoices):
    """User roles with hierarchy"""
    # Super Admin (Platform Level)
    SUPERADMIN = 'superadmin', 'Super Admin'

    # Client Admin (Organization Level)
    CLIENT_ADMIN = 'client_admin', 'Client Admin'
    OWNER = 'owner', 'Owner'

    # Management Level
    AREA_MANAGER = 'area_manager', 'Area Manager'
    OUTLET_MANAGER = 'outlet_manager', 'Outlet Manager'
    INVENTORY_MANAGER = 'inventory_manager', 'Inventory Manager'
    DELIVERY_MANAGER = 'delivery_manager', 'Delivery Manager'

    # Staff Level
    CASHIER = 'cashier', 'Cashier'
    KITCHEN = 'kitchen', 'Kitchen Staff'
    DISTRIBUTOR = 'distributor', 'Distributor'

class UserAccountManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.SUPERADMIN)
        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, blank=True, null=True)
    full_name = models.CharField(max_length=255)

    # Client Association (null for super admins)
    client = models.ForeignKey(
        'accounts.Client',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='users',
        help_text='Organization this user belongs to (null for super admins)'
    )

    # Role & Permissions
    role = models.CharField(
        max_length=50,
        choices=UserRole.choices,
        default=UserRole.CASHIER
    )
    custom_role = models.ForeignKey(
        'accounts.Role',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
        help_text='Custom role with specific permissions'
    )

    # Outlet Assignment
    outlet = models.ForeignKey(
        Outlet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff"
    )

    # Authentication
    pin = models.CharField(max_length=255, blank=True, null=True)  # Hashed 4-digit PIN

    # Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    # Activity Tracking
    last_seen = models.DateTimeField(default=timezone.now)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    login_count = models.IntegerField(default=0)

    # Timestamps
    date_joined = models.DateTimeField(default=timezone.now)
    password_changed_at = models.DateTimeField(null=True, blank=True)

    objects = UserAccountManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return f"{self.email} - {self.full_name}"

    def set_pin(self, raw_pin):
        from django.contrib.auth.hashers import make_password
        self.pin = make_password(raw_pin)

    def check_pin(self, raw_pin):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_pin, self.pin)

    def is_superadmin(self):
        """Check if user is a super admin"""
        return self.role == UserRole.SUPERADMIN and self.client is None

    def is_client_admin(self):
        """Check if user is a client admin"""
        return self.role in [UserRole.CLIENT_ADMIN, UserRole.OWNER]

    def get_permissions(self):
        """Get all permissions for this user"""
        from apps.accounts.models_advanced import Permission

        # Super admins have all permissions
        if self.is_superadmin():
            return Permission.objects.all()

        # Get permissions from custom role
        if self.custom_role:
            return self.custom_role.get_all_permissions()

        # Default permissions based on role (to be implemented)
        return Permission.objects.none()

    def has_permission(self, permission_name):
        """Check if user has specific permission"""
        if self.is_superadmin():
            return True

        user_permissions = self.get_permissions()
        return user_permissions.filter(name=permission_name).exists()


# Import advanced models at the end to avoid circular imports
try:
    from apps.accounts.models_advanced import Client, Role, Permission, APIToken, UserActivity, ClientSettings
except ImportError:
    pass


class POSTerminalKey(models.Model):
    """API Key for Electron POS terminal — no login required."""
    key        = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    name       = models.CharField(max_length=100, help_text='e.g. "Counter 1"')
    outlet     = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='pos_keys')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used  = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} — {self.outlet.name}"
