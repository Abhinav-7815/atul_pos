from django.contrib import admin
from django.utils.html import format_html
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'client_name', 'role', 'outlet', 'is_active_badge')
    search_fields = ('email', 'full_name', 'phone')
    list_filter = ('role', 'is_active', 'client', 'outlet')
    readonly_fields = ('id', 'date_joined', 'last_seen', 'password_changed_at', 'login_count')

    fieldsets = (
        ('User Information', {
            'fields': ('email', 'full_name', 'phone')
        }),
        ('Organization & Access', {
            'fields': ('client', 'role', 'custom_role', 'outlet')
        }),
        ('Status & Security', {
            'fields': ('is_active', 'is_staff', 'is_email_verified')
        }),
        ('Activity Tracking', {
            'fields': ('last_seen', 'last_login_ip', 'login_count', 'password_changed_at'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('id', 'date_joined'),
            'classes': ('collapse',)
        })
    )

    def client_name(self, obj):
        if obj.client:
            return obj.client.name
        return format_html('<span style="color: gray;">Platform</span>')
    client_name.short_description = 'Organization'

    def is_active_badge(self, obj):
        if obj.is_active:
            return format_html('<span style="color: green;">✓ Active</span>')
        return format_html('<span style="color: red;">✗ Inactive</span>')
    is_active_badge.short_description = 'Status'


# Import advanced admin customizations
from apps.accounts.admin_advanced import *
