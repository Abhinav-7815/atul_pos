import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from apps.outlets.models import Outlet

class UserRole(models.TextChoices):
    SUPERADMIN = 'superadmin', 'Super Admin'
    OWNER = 'owner', 'Owner'
    AREA_MANAGER = 'area_manager', 'Area Manager'
    OUTLET_MANAGER = 'outlet_manager', 'Outlet Manager'
    CASHIER = 'cashier', 'Cashier'
    KITCHEN = 'kitchen', 'Kitchen Staff'
    INVENTORY_MANAGER = 'inventory_manager', 'Inventory Manager'
    DELIVERY_MANAGER = 'delivery_manager', 'Delivery Manager'

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
    role = models.CharField(
        max_length=50, 
        choices=UserRole.choices, 
        default=UserRole.CASHIER
    )
    outlet = models.ForeignKey(
        Outlet, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="staff"
    )
    pin = models.CharField(max_length=255, blank=True, null=True)  # Hashed 4-digit PIN
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    last_seen = models.DateTimeField(default=timezone.now)
    date_joined = models.DateTimeField(default=timezone.now)

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
