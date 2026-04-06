"""
Permission System
- Decorators for view protection
- Permission checking utilities
- Middleware for permission enforcement
"""
from functools import wraps
from django.http import JsonResponse
from rest_framework import status
from rest_framework.permissions import BasePermission
from apps.accounts.models import UserRole


# ============================================================================
# PERMISSION DECORATORS
# ============================================================================

def superadmin_required(view_func):
    """
    Decorator to restrict access to super admins only
    """
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({
                'status': 'error',
                'message': 'Authentication required'
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not request.user.is_superadmin():
            return JsonResponse({
                'status': 'error',
                'message': 'Super admin access required'
            }, status=status.HTTP_403_FORBIDDEN)

        return view_func(request, *args, **kwargs)

    return wrapped_view


def client_admin_required(view_func):
    """
    Decorator to restrict access to client admins or super admins
    """
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({
                'status': 'error',
                'message': 'Authentication required'
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not (request.user.is_superadmin() or request.user.is_client_admin()):
            return JsonResponse({
                'status': 'error',
                'message': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)

        return view_func(request, *args, **kwargs)

    return wrapped_view


def permission_required(permission_name):
    """
    Decorator to check for specific permission
    Usage: @permission_required('can_create_user')
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Authentication required'
                }, status=status.HTTP_401_UNAUTHORIZED)

            if not request.user.has_permission(permission_name):
                return JsonResponse({
                    'status': 'error',
                    'message': f'Permission denied: {permission_name}'
                }, status=status.HTTP_403_FORBIDDEN)

            return view_func(request, *args, **kwargs)

        return wrapped_view
    return decorator


def role_required(*allowed_roles):
    """
    Decorator to check for specific roles
    Usage: @role_required(UserRole.OWNER, UserRole.OUTLET_MANAGER)
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Authentication required'
                }, status=status.HTTP_401_UNAUTHORIZED)

            # Super admins bypass role checks
            if request.user.is_superadmin():
                return view_func(request, *args, **kwargs)

            if request.user.role not in allowed_roles:
                return JsonResponse({
                    'status': 'error',
                    'message': f'Role not authorized. Required: {", ".join(allowed_roles)}'
                }, status=status.HTTP_403_FORBIDDEN)

            return view_func(request, *args, **kwargs)

        return wrapped_view
    return decorator


# ============================================================================
# DRF PERMISSION CLASSES
# ============================================================================

class IsSuperAdmin(BasePermission):
    """
    Permission class for Django REST Framework
    Allows access only to super admins
    """
    message = 'Super admin access required'

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_superadmin()


class IsClientAdmin(BasePermission):
    """
    Permission class for client admins
    Allows access to super admins and client admins
    """
    message = 'Admin access required'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.is_superadmin() or request.user.is_client_admin()


class HasPermission(BasePermission):
    """
    Permission class that checks for specific permission
    Usage: permission_classes = [HasPermission]
           Set permission_required attribute on the view
    """
    message = 'You do not have permission to perform this action'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Get required permission from view
        permission_name = getattr(view, 'permission_required', None)
        if not permission_name:
            return True  # No permission required

        return request.user.has_permission(permission_name)


class BelongsToClient(BasePermission):
    """
    Permission class to ensure user and object belong to same client
    """
    message = 'Access denied: Resource does not belong to your organization'

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Super admins can access everything
        if request.user.is_superadmin():
            return True

        # Check if object has client attribute
        if hasattr(obj, 'client'):
            return obj.client == request.user.client

        # Check if object has user attribute with client
        if hasattr(obj, 'user'):
            return obj.user.client == request.user.client

        return True  # If no client association, allow


class IsOwnerOrAdmin(BasePermission):
    """
    Permission class to check if user is owner of object or admin
    """
    message = 'Only the owner or admin can perform this action'

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Super admins and client admins can access
        if request.user.is_superadmin() or request.user.is_client_admin():
            return True

        # Check if user is the owner
        if hasattr(obj, 'user'):
            return obj.user == request.user

        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user

        return False


# ============================================================================
# PERMISSION UTILITIES
# ============================================================================

class PermissionChecker:
    """
    Utility class for checking permissions
    """

    @staticmethod
    def can_access_client(user, client):
        """Check if user can access specific client"""
        if user.is_superadmin():
            return True

        return user.client == client

    @staticmethod
    def can_manage_users(user):
        """Check if user can manage other users"""
        if user.is_superadmin() or user.is_client_admin():
            return True

        return user.has_permission('can_manage_users')

    @staticmethod
    def can_create_outlet(user):
        """Check if user can create outlets"""
        if user.is_superadmin():
            return True

        if user.client and not user.client.can_add_outlet():
            return False

        return user.has_permission('can_create_outlet')

    @staticmethod
    def can_generate_api_token(user):
        """Check if user can generate API tokens"""
        return user.is_superadmin()

    @staticmethod
    def can_view_analytics(user):
        """Check if user can view analytics"""
        if user.is_superadmin() or user.is_client_admin():
            return True

        return user.has_permission('can_view_analytics')

    @staticmethod
    def can_modify_menu(user):
        """Check if user can modify menu"""
        if user.is_superadmin() or user.is_client_admin():
            return True

        return user.has_permission('can_modify_menu')

    @staticmethod
    def can_process_orders(user):
        """Check if user can process orders"""
        allowed_roles = [
            UserRole.SUPERADMIN,
            UserRole.CLIENT_ADMIN,
            UserRole.OWNER,
            UserRole.OUTLET_MANAGER,
            UserRole.CASHIER
        ]

        if user.role in allowed_roles:
            return True

        return user.has_permission('can_process_orders')

    @staticmethod
    def get_accessible_clients(user):
        """Get all clients user can access"""
        from apps.accounts.models_advanced import Client

        if user.is_superadmin():
            return Client.objects.all()

        if user.client:
            return Client.objects.filter(id=user.client.id)

        return Client.objects.none()

    @staticmethod
    def get_accessible_outlets(user):
        """Get all outlets user can access"""
        from apps.outlets.models import Outlet

        if user.is_superadmin():
            return Outlet.objects.all()

        if user.client:
            return user.client.outlets.all()

        if user.outlet:
            return Outlet.objects.filter(id=user.outlet.id)

        return Outlet.objects.none()

    @staticmethod
    def can_delete_user(requesting_user, target_user):
        """Check if requesting user can delete target user"""
        # Super admins can delete anyone except other super admins
        if requesting_user.is_superadmin():
            return not target_user.is_superadmin() or requesting_user == target_user

        # Client admins can delete users in their organization
        if requesting_user.is_client_admin():
            if target_user.client != requesting_user.client:
                return False
            # Can't delete super admins or other admins
            return not (target_user.is_superadmin() or target_user.is_client_admin())

        return False


# ============================================================================
# CLIENT SCOPE UTILITIES
# ============================================================================

def get_client_from_request(request):
    """Extract client from request (from user or header)"""
    if hasattr(request, 'user') and request.user.is_authenticated:
        if request.user.is_superadmin():
            # Super admin can specify client in header
            client_id = request.headers.get('X-Client-ID')
            if client_id:
                from apps.accounts.models_advanced import Client
                try:
                    return Client.objects.get(id=client_id)
                except Client.DoesNotExist:
                    pass
            return None

        return request.user.client

    return None


def filter_by_client(queryset, request):
    """Filter queryset by client scope"""
    client = get_client_from_request(request)

    if client:
        if hasattr(queryset.model, 'client'):
            return queryset.filter(client=client)

    # If user is super admin with no client header, return all
    if request.user.is_authenticated and request.user.is_superadmin():
        return queryset

    return queryset.none()
