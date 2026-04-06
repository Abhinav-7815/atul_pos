"""
Django Admin Customization for Advanced User Management
- Client Management
- Permission & Role Management
- API Token Management
- Activity Logs
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from apps.accounts.models_advanced import (
    Client, Permission, Role, APIToken, UserActivity, ClientSettings
)


# ============================================================================
# CLIENT ADMIN
# ============================================================================

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'slug', 'client_type', 'status_badge',
        'outlets_count', 'users_count',
        'subscription_active', 'created_at'
    ]
    list_filter = ['client_type', 'status', 'created_at']
    search_fields = ['name', 'email', 'slug', 'phone', 'gstin']
    readonly_fields = ['id', 'created_at', 'updated_at', 'subscription_status_display']

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'slug', 'email', 'phone')
        }),
        ('Business Details', {
            'fields': ('business_type', 'gstin', 'address', 'city', 'state', 'country')
        }),
        ('Subscription & Status', {
            'fields': (
                'client_type', 'status', 'subscription_status_display',
                'subscription_start', 'subscription_end', 'trial_end'
            )
        }),
        ('Limits & Quotas', {
            'fields': ('max_outlets', 'max_users', 'max_products')
        }),
        ('Configuration', {
            'fields': ('features', 'settings'),
            'classes': ('collapse',)
        }),
        ('Billing', {
            'fields': ('billing_email', 'billing_address'),
            'classes': ('collapse',)
        }),
        ('Internal Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def status_badge(self, obj):
        colors = {
            'active': 'green',
            'suspended': 'red',
            'expired': 'orange',
            'pending': 'gray'
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def outlets_count(self, obj):
        count = obj.outlets_count()
        return format_html('{} / {}', count, obj.max_outlets)
    outlets_count.short_description = 'Outlets'

    def users_count(self, obj):
        count = obj.users_count()
        return format_html('{} / {}', count, obj.max_users)
    users_count.short_description = 'Users'

    def subscription_active(self, obj):
        is_active = obj.is_subscription_active()
        return format_html(
            '<span style="color: {};">{}</span>',
            'green' if is_active else 'red',
            '✓ Active' if is_active else '✗ Inactive'
        )
    subscription_active.short_description = 'Subscription'

    def subscription_status_display(self, obj):
        """Display detailed subscription status"""
        is_active = obj.is_subscription_active()
        status = '<div style="padding: 10px; background: #f0f0f0; border-radius: 5px;">'

        if is_active:
            status += '<p style="color: green; font-weight: bold;">✓ Subscription Active</p>'
        else:
            status += '<p style="color: red; font-weight: bold;">✗ Subscription Inactive</p>'

        status += f'<p><strong>Type:</strong> {obj.get_client_type_display()}</p>'
        status += f'<p><strong>Status:</strong> {obj.get_status_display()}</p>'

        if obj.subscription_end:
            status += f'<p><strong>Expires:</strong> {obj.subscription_end.strftime("%Y-%m-%d")}</p>'

        if obj.trial_end:
            status += f'<p><strong>Trial Ends:</strong> {obj.trial_end.strftime("%Y-%m-%d")}</p>'

        status += '</div>'
        return mark_safe(status)
    subscription_status_display.short_description = 'Subscription Details'


# ============================================================================
# PERMISSION ADMIN
# ============================================================================

@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['name', 'display_name', 'category', 'resource', 'action', 'superadmin_only_badge']
    list_filter = ['category', 'is_superadmin_only', 'created_at']
    search_fields = ['name', 'display_name', 'description', 'resource', 'action']
    readonly_fields = ['id', 'created_at', 'updated_at']

    fieldsets = (
        ('Permission Details', {
            'fields': ('name', 'display_name', 'description')
        }),
        ('Categorization', {
            'fields': ('category', 'resource', 'action')
        }),
        ('Access Control', {
            'fields': ('is_superadmin_only',)
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def superadmin_only_badge(self, obj):
        if obj.is_superadmin_only:
            return format_html('<span style="color: red; font-weight: bold;">⚠ Super Admin Only</span>')
        return format_html('<span style="color: green;">All Admins</span>')
    superadmin_only_badge.short_description = 'Access Level'


# ============================================================================
# ROLE ADMIN
# ============================================================================

class RolePermissionInline(admin.TabularInline):
    model = Role.permissions.through
    extra = 1
    verbose_name = "Permission"
    verbose_name_plural = "Assigned Permissions"


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'client_link', 'priority',
        'system_role_badge', 'superadmin_role_badge', 'permissions_count'
    ]
    list_filter = ['is_system_role', 'is_superadmin_role', 'is_client_admin_role', 'priority', 'created_at']
    search_fields = ['name', 'slug', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    inlines = [RolePermissionInline]

    fieldsets = (
        ('Role Details', {
            'fields': ('name', 'slug', 'description', 'client')
        }),
        ('Role Type', {
            'fields': ('is_system_role', 'is_superadmin_role', 'is_client_admin_role', 'priority')
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def client_link(self, obj):
        if obj.client:
            url = reverse('admin:accounts_client_change', args=[obj.client.id])
            return format_html('<a href="{}">{}</a>', url, obj.client.name)
        return format_html('<span style="color: gray;">System</span>')
    client_link.short_description = 'Client'

    def system_role_badge(self, obj):
        if obj.is_system_role:
            return format_html('<span style="background: blue; color: white; padding: 2px 5px; border-radius: 3px;">System</span>')
        return ''
    system_role_badge.short_description = 'System'

    def superadmin_role_badge(self, obj):
        if obj.is_superadmin_role:
            return format_html('<span style="background: red; color: white; padding: 2px 5px; border-radius: 3px;">Super Admin</span>')
        return ''
    superadmin_role_badge.short_description = 'Super Admin'

    def permissions_count(self, obj):
        count = obj.permissions.count()
        return format_html('<strong>{}</strong> permissions', count)
    permissions_count.short_description = 'Permissions'


# ============================================================================
# API TOKEN ADMIN
# ============================================================================

@admin.register(APIToken)
class APITokenAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'client_link', 'token_type', 'status_badge',
        'request_count', 'last_used_at', 'created_at'
    ]
    list_filter = ['token_type', 'is_active', 'created_at']
    search_fields = ['name', 'token', 'client__name']
    readonly_fields = ['id', 'token', 'created_at', 'updated_at', 'request_count', 'last_used_at', 'token_display']

    fieldsets = (
        ('Token Information', {
            'fields': ('name', 'token_display', 'client', 'created_by')
        }),
        ('Token Configuration', {
            'fields': ('token_type', 'is_active', 'expires_at')
        }),
        ('Security & Limits', {
            'fields': ('allowed_ips', 'rate_limit')
        }),
        ('Usage Statistics', {
            'fields': ('request_count', 'last_used_at'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('id', 'token', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def client_link(self, obj):
        if obj.client:
            url = reverse('admin:accounts_client_change', args=[obj.client.id])
            return format_html('<a href="{}">{}</a>', url, obj.client.name)
        return '-'
    client_link.short_description = 'Client'

    def status_badge(self, obj):
        is_valid = obj.is_valid()
        if is_valid:
            return format_html('<span style="color: green; font-weight: bold;">✓ Active</span>')
        else:
            return format_html('<span style="color: red; font-weight: bold;">✗ Inactive</span>')
    status_badge.short_description = 'Status'

    def token_display(self, obj):
        """Show masked token"""
        token_preview = f"{obj.token[:8]}...{obj.token[-4:]}"
        return format_html(
            '<code style="background: #f0f0f0; padding: 5px; border-radius: 3px;">{}</code>',
            token_preview
        )
    token_display.short_description = 'Token (masked)'


# ============================================================================
# USER ACTIVITY ADMIN
# ============================================================================

@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    list_display = [
        'user_email', 'client_name', 'activity_type_badge',
        'description_short', 'ip_address', 'created_at'
    ]
    list_filter = ['activity_type', 'created_at']
    search_fields = ['user__email', 'client__name', 'description', 'ip_address']
    readonly_fields = ['id', 'user', 'client', 'activity_type', 'description',
                      'resource_type', 'resource_id', 'ip_address', 'user_agent',
                      'old_values', 'new_values', 'created_at']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Activity Details', {
            'fields': ('user', 'client', 'activity_type', 'description')
        }),
        ('Resource Information', {
            'fields': ('resource_type', 'resource_id')
        }),
        ('Request Information', {
            'fields': ('ip_address', 'user_agent')
        }),
        ('Data Changes', {
            'fields': ('old_values', 'new_values'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('id', 'created_at'),
            'classes': ('collapse',)
        })
    )

    def has_add_permission(self, request):
        """Don't allow manual creation of activity logs"""
        return False

    def has_change_permission(self, request, obj=None):
        """Don't allow editing of activity logs"""
        return False

    def user_email(self, obj):
        if obj.user:
            return obj.user.email
        return '-'
    user_email.short_description = 'User'

    def client_name(self, obj):
        if obj.client:
            return obj.client.name
        return '-'
    client_name.short_description = 'Client'

    def activity_type_badge(self, obj):
        colors = {
            'login': 'green',
            'logout': 'gray',
            'create': 'blue',
            'update': 'orange',
            'delete': 'red',
            'failed_login': 'red'
        }
        color = colors.get(obj.activity_type, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 3px;">{}</span>',
            color,
            obj.get_activity_type_display()
        )
    activity_type_badge.short_description = 'Activity Type'

    def description_short(self, obj):
        if len(obj.description) > 50:
            return obj.description[:50] + '...'
        return obj.description
    description_short.short_description = 'Description'


# ============================================================================
# CLIENT SETTINGS ADMIN
# ============================================================================

@admin.register(ClientSettings)
class ClientSettingsAdmin(admin.ModelAdmin):
    list_display = ['client_link', 'currency', 'timezone', 'ai_enabled', 'api_enabled', 'updated_at']
    list_filter = ['currency', 'ai_image_generation_enabled', 'api_enabled', 'require_2fa']
    search_fields = ['client__name']
    readonly_fields = ['updated_at']

    fieldsets = (
        ('Client', {
            'fields': ('client',)
        }),
        ('Branding', {
            'fields': ('logo', 'primary_color', 'secondary_color')
        }),
        ('Business Settings', {
            'fields': ('currency', 'timezone', 'date_format')
        }),
        ('Notifications', {
            'fields': ('email_notifications', 'sms_notifications')
        }),
        ('AI Features', {
            'fields': (
                'ai_image_generation_enabled',
                'ai_image_monthly_quota',
                'ai_provider'
            )
        }),
        ('Analytics', {
            'fields': ('analytics_retention_days',)
        }),
        ('API Access', {
            'fields': ('api_enabled', 'webhook_url')
        }),
        ('Security', {
            'fields': ('require_2fa', 'session_timeout_minutes', 'password_expiry_days')
        }),
        ('Custom Fields', {
            'fields': ('custom_fields',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('updated_at',),
            'classes': ('collapse',)
        })
    )

    def client_link(self, obj):
        url = reverse('admin:accounts_client_change', args=[obj.client.id])
        return format_html('<a href="{}">{}</a>', url, obj.client.name)
    client_link.short_description = 'Client'

    def ai_enabled(self, obj):
        if obj.ai_image_generation_enabled:
            return format_html('<span style="color: green;">✓</span>')
        return format_html('<span style="color: gray;">✗</span>')
    ai_enabled.short_description = 'AI Images'

    def api_enabled(self, obj):
        if obj.api_enabled:
            return format_html('<span style="color: green;">✓</span>')
        return format_html('<span style="color: gray;">✗</span>')
    api_enabled.short_description = 'API Access'
