from rest_framework import permissions


class IsMainBranchUser(permissions.BasePermission):
    """Allow access only to users whose outlet is the main branch (HQ)."""
    message = 'Only main branch staff can perform this action.'

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.outlet is not None and
            request.user.outlet.outlet_type == 'main'
        )


class IsDistributorUser(permissions.BasePermission):
    """Allow access only to users whose outlet is of type distributor."""
    message = 'Only distributor staff can perform this action.'

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.outlet is not None and
            request.user.outlet.outlet_type == 'distributor'
        )


class IsMainOrDistributorUser(permissions.BasePermission):
    """Allow access to both main branch and distributor users."""
    message = 'Access restricted to main branch or distributor staff.'

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.outlet is not None and
            request.user.outlet.outlet_type in ('main', 'distributor')
        )
