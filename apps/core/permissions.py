from rest_framework import permissions


class IsPOSTerminal(permissions.BasePermission):
    """Allows access to EXE POS terminal key authenticated requests."""
    def has_permission(self, request, view):
        from apps.accounts.pos_auth import POSTerminalUser
        return isinstance(request.user, POSTerminalUser)


class IsCashierOrPOSTerminal(permissions.BasePermission):
    """Allows JWT cashiers OR POS terminal key."""
    def has_permission(self, request, view):
        from apps.accounts.pos_auth import POSTerminalUser
        if isinstance(request.user, POSTerminalUser):
            return True
        return request.user.is_authenticated and request.user.role in [
            'superadmin', 'owner', 'admin', 'outlet_manager', 'area_manager', 'cashier'
        ]


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['superadmin', 'owner', 'admin']

class IsManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['superadmin', 'owner', 'admin', 'outlet_manager', 'area_manager']

class IsCashier(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['superadmin', 'owner', 'admin', 'outlet_manager', 'area_manager', 'cashier']

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.role == 'superadmin' or request.user.is_superuser
        )
