"""
URL Routing for Advanced User Management
- Super Admin routes
- Client Admin routes
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.accounts.views_superadmin import (
    SuperAdminClientViewSet,
    SuperAdminPermissionViewSet,
    SuperAdminRoleViewSet,
    SuperAdminAPITokenViewSet,
    SuperAdminUserViewSet,
    SuperAdminActivityViewSet
)
from apps.accounts.views_clientadmin import (
    ClientAdminUserViewSet,
    ClientAdminRoleViewSet,
    ClientSettingsViewSet,
    ClientDashboardViewSet,
    ClientActivityViewSet
)

# ============================================================================
# SUPER ADMIN ROUTES
# ============================================================================

superadmin_router = DefaultRouter()
superadmin_router.register(r'clients', SuperAdminClientViewSet, basename='superadmin-client')
superadmin_router.register(r'permissions', SuperAdminPermissionViewSet, basename='superadmin-permission')
superadmin_router.register(r'roles', SuperAdminRoleViewSet, basename='superadmin-role')
superadmin_router.register(r'api-tokens', SuperAdminAPITokenViewSet, basename='superadmin-apitoken')
superadmin_router.register(r'users', SuperAdminUserViewSet, basename='superadmin-user')
superadmin_router.register(r'activities', SuperAdminActivityViewSet, basename='superadmin-activity')

# ============================================================================
# CLIENT ADMIN ROUTES
# ============================================================================

clientadmin_router = DefaultRouter()
clientadmin_router.register(r'users', ClientAdminUserViewSet, basename='clientadmin-user')
clientadmin_router.register(r'roles', ClientAdminRoleViewSet, basename='clientadmin-role')
clientadmin_router.register(r'settings', ClientSettingsViewSet, basename='clientadmin-settings')
clientadmin_router.register(r'dashboard', ClientDashboardViewSet, basename='clientadmin-dashboard')
clientadmin_router.register(r'activities', ClientActivityViewSet, basename='clientadmin-activity')

# ============================================================================
# URL PATTERNS
# ============================================================================

urlpatterns = [
    # Super Admin Panel
    path('superadmin/', include(superadmin_router.urls)),

    # Client Admin Panel
    path('admin/', include(clientadmin_router.urls)),
]
