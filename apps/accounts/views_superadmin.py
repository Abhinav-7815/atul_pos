"""
Super Admin Panel APIs
- Client Management
- Permission Management
- Role Management
- API Token Management
- System-wide User Management
- Activity Logs
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import User
from apps.accounts.models_advanced import (
    Client, Permission, Role, APIToken, UserActivity, ClientSettings
)
from apps.accounts.serializers_advanced import (
    ClientListSerializer, ClientDetailSerializer, ClientCreateSerializer, ClientUpdateSerializer,
    PermissionSerializer, PermissionCreateSerializer,
    RoleListSerializer, RoleDetailSerializer, RoleCreateSerializer, RoleUpdateSerializer,
    APITokenListSerializer, APITokenDetailSerializer, APITokenCreateSerializer,
    UserActivitySerializer,
    ClientSettingsSerializer,
    UserListSerializer, UserDetailSerializer, UserCreateSerializer, UserUpdateSerializer
)
from apps.accounts.permissions import IsSuperAdmin, PermissionChecker


# ============================================================================
# CLIENT MANAGEMENT
# ============================================================================

class SuperAdminClientViewSet(viewsets.ModelViewSet):
    """
    Super Admin: Complete Client Management
    - List all clients
    - Create new clients
    - Update client details
    - Suspend/activate clients
    - View client statistics
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = Client.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientListSerializer
        elif self.action == 'create':
            return ClientCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ClientUpdateSerializer
        return ClientDetailSerializer

    def get_queryset(self):
        queryset = Client.objects.all()

        # Filters
        status_filter = self.request.query_params.get('status')
        client_type = self.request.query_params.get('client_type')
        search = self.request.query_params.get('search')

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if client_type:
            queryset = queryset.filter(client_type=client_type)

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(slug__icontains=search)
            )

        return queryset.order_by('-created_at')

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend a client"""
        client = self.get_object()
        client.status = 'suspended'
        client.save()

        # Log activity
        UserActivity.objects.create(
            user=request.user,
            client=client,
            activity_type='settings_change',
            description=f'Client {client.name} suspended by super admin',
            resource_type='client',
            resource_id=str(client.id),
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            'status': 'success',
            'message': f'Client {client.name} has been suspended'
        })

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a client"""
        client = self.get_object()
        client.status = 'active'
        client.save()

        # Log activity
        UserActivity.objects.create(
            user=request.user,
            client=client,
            activity_type='settings_change',
            description=f'Client {client.name} activated by super admin',
            resource_type='client',
            resource_id=str(client.id),
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            'status': 'success',
            'message': f'Client {client.name} has been activated'
        })

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get detailed statistics for a client"""
        client = self.get_object()

        stats = {
            'client': ClientDetailSerializer(client).data,
            'outlets': {
                'total': client.outlets.count(),
                'active': client.outlets.filter(is_active=True).count(),
                'limit': client.max_outlets
            },
            'users': {
                'total': client.users.count(),
                'active': client.users.filter(is_active=True).count(),
                'limit': client.max_users
            },
            'subscription': {
                'is_active': client.is_subscription_active(),
                'start_date': client.subscription_start,
                'end_date': client.subscription_end,
                'trial_end': client.trial_end
            },
            'activity': {
                'recent_logins': UserActivity.objects.filter(
                    client=client,
                    activity_type='login'
                ).count(),
                'total_activities': UserActivity.objects.filter(client=client).count()
            }
        }

        return Response(stats)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get super admin dashboard statistics"""
        total_clients = Client.objects.count()
        active_clients = Client.objects.filter(status='active').count()
        suspended_clients = Client.objects.filter(status='suspended').count()

        # Recent activities
        recent_activities = UserActivity.objects.filter(
            activity_type__in=['login', 'create', 'update', 'delete']
        ).order_by('-created_at')[:50]

        stats = {
            'clients': {
                'total': total_clients,
                'active': active_clients,
                'suspended': suspended_clients,
                'trial': Client.objects.filter(client_type='trial').count(),
                'enterprise': Client.objects.filter(client_type='enterprise').count()
            },
            'users': {
                'total': User.objects.count(),
                'active': User.objects.filter(is_active=True).count(),
                'super_admins': User.objects.filter(role='superadmin').count()
            },
            'api_tokens': {
                'total': APIToken.objects.count(),
                'active': APIToken.objects.filter(is_active=True).count()
            },
            'recent_activities': UserActivitySerializer(recent_activities, many=True).data
        }

        return Response(stats)


# ============================================================================
# PERMISSION MANAGEMENT
# ============================================================================

class SuperAdminPermissionViewSet(viewsets.ModelViewSet):
    """
    Super Admin: Permission Management
    - Create system permissions
    - Update permissions
    - View all permissions
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = Permission.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return PermissionCreateSerializer
        return PermissionSerializer

    def get_queryset(self):
        queryset = Permission.objects.all()

        # Filters
        category = self.request.query_params.get('category')
        superadmin_only = self.request.query_params.get('superadmin_only')

        if category:
            queryset = queryset.filter(category=category)

        if superadmin_only:
            queryset = queryset.filter(is_superadmin_only=True)

        return queryset.order_by('category', 'name')

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Get permissions grouped by category"""
        from apps.accounts.models_advanced import PermissionCategory

        result = {}
        for category in PermissionCategory:
            permissions = Permission.objects.filter(category=category.value)
            result[category.value] = PermissionSerializer(permissions, many=True).data

        return Response(result)


# ============================================================================
# ROLE MANAGEMENT
# ============================================================================

class SuperAdminRoleViewSet(viewsets.ModelViewSet):
    """
    Super Admin: Role Management
    - Create system-wide roles
    - Manage client-specific roles
    - Assign permissions to roles
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = Role.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return RoleListSerializer
        elif self.action == 'create':
            return RoleCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return RoleUpdateSerializer
        return RoleDetailSerializer

    def get_queryset(self):
        queryset = Role.objects.all()

        # Filters
        client_id = self.request.query_params.get('client')
        system_only = self.request.query_params.get('system_only')

        if client_id:
            queryset = queryset.filter(client_id=client_id)

        if system_only:
            queryset = queryset.filter(is_system_role=True)

        return queryset.order_by('-priority', 'name')

    @action(detail=True, methods=['post'])
    def add_permissions(self, request, pk=None):
        """Add permissions to a role"""
        role = self.get_object()
        permission_ids = request.data.get('permission_ids', [])

        permissions = Permission.objects.filter(id__in=permission_ids)
        role.permissions.add(*permissions)

        return Response({
            'status': 'success',
            'message': f'Added {permissions.count()} permissions to role {role.name}',
            'role': RoleDetailSerializer(role).data
        })

    @action(detail=True, methods=['post'])
    def remove_permissions(self, request, pk=None):
        """Remove permissions from a role"""
        role = self.get_object()
        permission_ids = request.data.get('permission_ids', [])

        permissions = Permission.objects.filter(id__in=permission_ids)
        role.permissions.remove(*permissions)

        return Response({
            'status': 'success',
            'message': f'Removed {permissions.count()} permissions from role {role.name}',
            'role': RoleDetailSerializer(role).data
        })


# ============================================================================
# API TOKEN MANAGEMENT
# ============================================================================

class SuperAdminAPITokenViewSet(viewsets.ModelViewSet):
    """
    Super Admin: API Token Management
    - Issue tokens to clients
    - Revoke tokens
    - View token usage statistics
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = APIToken.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return APITokenListSerializer
        elif self.action == 'create':
            return APITokenCreateSerializer
        return APITokenDetailSerializer

    def get_queryset(self):
        queryset = APIToken.objects.all()

        # Filters
        client_id = self.request.query_params.get('client')
        is_active = self.request.query_params.get('is_active')

        if client_id:
            queryset = queryset.filter(client_id=client_id)

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset.order_by('-created_at')

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke an API token"""
        token = self.get_object()
        token.is_active = False
        token.save()

        # Log activity
        UserActivity.objects.create(
            user=request.user,
            client=token.client,
            activity_type='settings_change',
            description=f'API token {token.name} revoked by super admin',
            resource_type='api_token',
            resource_id=str(token.id),
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            'status': 'success',
            'message': f'Token {token.name} has been revoked'
        })

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """Reactivate an API token"""
        token = self.get_object()
        token.is_active = True
        token.save()

        return Response({
            'status': 'success',
            'message': f'Token {token.name} has been reactivated'
        })

    @action(detail=True, methods=['get'])
    def usage_stats(self, request, pk=None):
        """Get usage statistics for a token"""
        token = self.get_object()

        stats = {
            'token': APITokenDetailSerializer(token).data,
            'usage': {
                'total_requests': token.request_count,
                'last_used': token.last_used_at,
                'days_since_creation': (timezone.now() - token.created_at).days,
                'average_requests_per_day': token.request_count / max((timezone.now() - token.created_at).days, 1)
            }
        }

        return Response(stats)


# ============================================================================
# SYSTEM-WIDE USER MANAGEMENT
# ============================================================================

class SuperAdminUserViewSet(viewsets.ModelViewSet):
    """
    Super Admin: System-wide User Management
    - View all users across all clients
    - Create users for any client
    - Manage user roles and permissions
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        elif self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserDetailSerializer

    def get_queryset(self):
        queryset = User.objects.all()

        # Filters
        client_id = self.request.query_params.get('client')
        role = self.request.query_params.get('role')
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')

        if client_id:
            queryset = queryset.filter(client_id=client_id)

        if role:
            queryset = queryset.filter(role=role)

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        if search:
            queryset = queryset.filter(
                Q(email__icontains=search) |
                Q(full_name__icontains=search) |
                Q(phone__icontains=search)
            )

        return queryset.order_by('-date_joined')

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Reset user password"""
        user = self.get_object()
        new_password = request.data.get('new_password')

        if not new_password:
            return Response({
                'status': 'error',
                'message': 'new_password is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.password_changed_at = timezone.now()
        user.save()

        # Log activity
        UserActivity.objects.create(
            user=request.user,
            client=user.client,
            activity_type='settings_change',
            description=f'Password reset for user {user.email} by super admin',
            resource_type='user',
            resource_id=str(user.id),
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            'status': 'success',
            'message': 'Password has been reset successfully'
        })

    @action(detail=True, methods=['get'])
    def activity_log(self, request, pk=None):
        """Get activity log for a user"""
        user = self.get_object()
        activities = UserActivity.objects.filter(user=user).order_by('-created_at')[:100]

        return Response({
            'user': UserDetailSerializer(user).data,
            'activities': UserActivitySerializer(activities, many=True).data
        })


# ============================================================================
# ACTIVITY LOGS
# ============================================================================

class SuperAdminActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Super Admin: System Activity Logs
    - View all activities across all clients
    - Filter by type, client, user, date range
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = UserActivity.objects.all()
    serializer_class = UserActivitySerializer

    def get_queryset(self):
        queryset = UserActivity.objects.all()

        # Filters
        client_id = self.request.query_params.get('client')
        user_id = self.request.query_params.get('user')
        activity_type = self.request.query_params.get('activity_type')
        days = self.request.query_params.get('days', 30)

        if client_id:
            queryset = queryset.filter(client_id=client_id)

        if user_id:
            queryset = queryset.filter(user_id=user_id)

        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)

        # Date range
        try:
            days = int(days)
            start_date = timezone.now() - timedelta(days=days)
            queryset = queryset.filter(created_at__gte=start_date)
        except:
            pass

        return queryset.order_by('-created_at')
