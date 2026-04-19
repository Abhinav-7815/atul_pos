import uuid
import secrets
import hashlib
from django.db import models
from django.utils import timezone
from django.conf import settings

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_updated"
    )
    is_active = models.BooleanField(default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save()

    def hard_delete(self):
        super().delete()

class APIKey(models.Model):
    """
    API Key for EXE / external integrations.
    One key per outlet. Key is stored as a SHA-256 hash — plain text shown only once at creation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    outlet = models.ForeignKey(
        'outlets.Outlet',
        on_delete=models.CASCADE,
        related_name='api_keys',
    )
    name = models.CharField(max_length=100, help_text='Label e.g. "Windows EXE - Rajkot"')
    key_hash = models.CharField(max_length=64, unique=True, editable=False)
    prefix = models.CharField(max_length=8, editable=False, help_text='First 8 chars for display')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'core'
        verbose_name = 'API Key'
        verbose_name_plural = 'API Keys'

    def __str__(self):
        return f"{self.name} ({self.prefix}****) — {self.outlet.name}"

    @classmethod
    def generate(cls, outlet, name):
        """Create a new key. Returns (APIKey instance, plain_text_key). Plain text NOT stored."""
        plain = secrets.token_hex(32)           # 64-char hex string
        key_hash = hashlib.sha256(plain.encode()).hexdigest()
        obj = cls.objects.create(
            outlet=outlet,
            name=name,
            key_hash=key_hash,
            prefix=plain[:8],
        )
        return obj, plain

    @classmethod
    def verify(cls, plain_key):
        """Lookup by hash. Returns APIKey or None."""
        if not plain_key:
            return None
        key_hash = hashlib.sha256(plain_key.encode()).hexdigest()
        try:
            key = cls.objects.select_related('outlet').get(key_hash=key_hash, is_active=True)
            key.last_used_at = timezone.now()
            key.save(update_fields=['last_used_at'])
            return key
        except cls.DoesNotExist:
            return None


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs"
    )
    action = models.CharField(max_length=50) # CREATE, UPDATE, DELETE, LOGIN, VOID
    app_label = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    changes = models.TextField(default='{}') # JSON string for SQLite compatibility
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        app_label = 'core'
        ordering = ['-timestamp']
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def __str__(self):
        return f"{self.timestamp} - {self.user} - {self.action} ({self.model_name})"
