"""
Client Admin Panel APIs
- User Management (within client scope)
- Role Management (client-specific)
- Outlet Management
- Client Settings
- Activity Logs (client scope)
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.models_advanced import Role, UserActivity, ClientSettings
from apps.outlets.models import Outlet
from apps.accounts.serializers_advanced import (
    RoleListSerializer, RoleDetailSerializer, RoleCreateSerializer, RoleUpdateSerializer,
    UserListSerializer, UserDetailSerializer, UserCreateSerializer, UserUpdateSerializer,
    UserActivitySerializer,
    ClientSettingsSerializer,
    ClientDetailSerializer
)
from apps.accounts.permissions import IsClientAdmin, PermissionChecker, filter_by_client


# ============================================================================
# USER MANAGEMENT (Client Scope)
# ============================================================================

class ClientAdminUserViewSet(viewsets.ModelViewSet):
    """
    Client Admin: Manage users within their organization
    - List users in client
    - Create new users
    - Update user details
    - Deactivate users
    """
    permission_classes = [IsAuthenticated, IsClientAdmin]
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
        """Filter users by client scope"""
        user = self.request.user

        if user.is_superadmin():
            # Super admins can see all
            queryset = User.objects.all()
        else:
            # Client admins see only their client's users
            queryset = User.objects.filter(client=user.client)

        # Filters
        role = self.request.query_params.get('role')
        is_active = self.request.query_params.get('is_active')
        outlet_id = self.request.query_params.get('outlet')
        search = self.request.query_params.get('search')

        if role:
            queryset = queryset.filter(role=role)

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        if outlet_id:
            queryset = queryset.filter(outlet_id=outlet_id)

        if search:
            queryset = queryset.filter(
                Q(email__icontains=search) |
                Q(full_name__icontains=search) |
                Q(phone__icontains=search)
            )

        return queryset.order_by('-date_joined')

    def perform_create(self, serializer):
        """Auto-assign client when creating user"""
        user = self.request.user

        if not user.is_superadmin():
            # Client admins create users in their client
            serializer.save(client=user.client)
        else:
            serializer.save()

        # Log activity
        UserActivity.objects.create(
            user=user,
            client=serializer.instance.client,
            activity_type='create',
            description=f'User {serializer.instance.email} created',
            resource_type='user',
            resource_id=str(serializer.instance.id),
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user"""
        user = self.get_object()

        # Check permissions
        if not PermissionChecker.can_delete_user(request.user, user):
            return Response({
                'status': 'error',
                'message': 'You do not have permission to deactivate this user'
            }, status=status.HTTP_403_FORBIDDEN)

        user.is_active = False
        user.save()

        # Log activity
        UserActivity.objects.create(
            user=request.user,
            client=user.client,
            activity_type='update',
            description=f'User {user.email} deactivated',
            resource_type='user',
            resource_id=str(user.id),
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            'status': 'success',
            'message': f'User {user.email} has been deactivated'
        })

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user"""
        user = self.get_object()

        # Check if can add more users
        if not request.user.client.can_add_user():
            return Response({
                'status': 'error',
                'message': f'User limit reached. Maximum {request.user.client.max_users} users allowed.'
            }, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = True
        user.save()

        # Log activity
        UserActivity.objects.create(
            user=request.user,
            client=user.client,
            activity_type='update',
            description=f'User {user.email} activated',
            resource_type='user',
            resource_id=str(user.id),
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            'status': 'success',
            'message': f'User {user.email} has been activated'
        })

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        """Change user password (admin action)"""
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
            description=f'Password changed for user {user.email}',
            resource_type='user',
            resource_id=str(user.id),
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            'status': 'success',
            'message': 'Password has been changed successfully'
        })

    @action(detail=True, methods=['post'])
    def reset_pin(self, request, pk=None):
        """Reset user PIN"""
        user = self.get_object()
        new_pin = request.data.get('new_pin')

        if not new_pin or len(new_pin) != 4 or not new_pin.isdigit():
            return Response({
                'status': 'error',
                'message': 'new_pin must be a 4-digit number'
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_pin(new_pin)
        user.save()

        return Response({
            'status': 'success',
            'message': 'PIN has been reset successfully'
        })


# ============================================================================
# ROLE MANAGEMENT (Client Scope)
# ============================================================================

class ClientAdminRoleViewSet(viewsets.ModelViewSet):
    """
    Client Admin: Manage roles within their organization
    - Create custom roles
    - Assign permissions to roles
    - Assign roles to users
    """
    permission_classes = [IsAuthenticated, IsClientAdmin]
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
        """Get roles for client + system roles"""
        user = self.request.user

        if user.is_superadmin():
            return Role.objects.all()

        # Client admins see system roles + their client roles
        return Role.objects.filter(
            Q(client=user.client) | Q(is_system_role=True)
        ).order_by('-priority', 'name')

    def perform_create(self, serializer):
        """Auto-assign client when creating role"""
        user = self.request.user

        if not user.is_superadmin():
            serializer.save(client=user.client)
        else:
            serializer.save()

        # Log activity
        UserActivity.objects.create(
            user=user,
            client=serializer.instance.client,
            activity_type='create',
            description=f'Role {serializer.instance.name} created',
            resource_type='role',
            resource_id=str(serializer.instance.id),
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def destroy(self, request, *args, **kwargs):
        """Prevent deleting system roles"""
        role = self.get_object()

        if role.is_system_role:
            return Response({
                'status': 'error',
                'message': 'Cannot delete system roles'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Log activity
        UserActivity.objects.create(
            user=request.user,
            client=role.client,
            activity_type='delete',
            description=f'Role {role.name} deleted',
            resource_type='role',
            resource_id=str(role.id),
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return super().destroy(request, *args, **kwargs)


# ============================================================================
# CLIENT SETTINGS
# ============================================================================

class ClientSettingsViewSet(viewsets.ModelViewSet):
    """
    Client Admin: Manage client settings
    - Update branding
    - Configure features
    - Set preferences
    """
    permission_classes = [IsAuthenticated, IsClientAdmin]
    queryset = ClientSettings.objects.all()
    serializer_class = ClientSettingsSerializer

    def get_queryset(self):
        """Get settings for user's client"""
        user = self.request.user

        if user.is_superadmin():
            return ClientSettings.objects.all()

        return ClientSettings.objects.filter(client=user.client)

    @action(detail=False, methods=['get'])
    def my_settings(self, request):
        """Get current user's client settings"""
        user = request.user

        if not user.client:
            return Response({
                'status': 'error',
                'message': 'No client associated with user'
            }, status=status.HTTP_400_BAD_REQUEST)

        settings, created = ClientSettings.objects.get_or_create(client=user.client)

        return Response(ClientSettingsSerializer(settings).data)

    @action(detail=False, methods=['post'])
    def update_my_settings(self, request):
        """Update current user's client settings"""
        user = request.user

        if not user.client:
            return Response({
                'status': 'error',
                'message': 'No client associated with user'
            }, status=status.HTTP_400_BAD_REQUEST)

        settings, created = ClientSettings.objects.get_or_create(client=user.client)

        serializer = ClientSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            # Log activity
            UserActivity.objects.create(
                user=user,
                client=user.client,
                activity_type='settings_change',
                description='Client settings updated',
                resource_type='client_settings',
                resource_id=str(settings.client_id),
                ip_address=request.META.get('REMOTE_ADDR')
            )

            return Response({
                'status': 'success',
                'message': 'Settings updated successfully',
                'data': serializer.data
            })

        return Response({
            'status': 'error',
            'message': 'Invalid data',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


# ============================================================================
# CLIENT DASHBOARD
# ============================================================================

class ClientDashboardViewSet(viewsets.ViewSet):
    """
    Client Admin: Dashboard statistics
    - User statistics
    - Outlet statistics
    - Recent activity
    """
    permission_classes = [IsAuthenticated, IsClientAdmin]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get client dashboard statistics"""
        user = request.user

        if not user.client:
            return Response({
                'status': 'error',
                'message': 'No client associated with user'
            }, status=status.HTTP_400_BAD_REQUEST)

        client = user.client

        stats = {
            'client': ClientDetailSerializer(client).data,
            'users': {
                'total': client.users.count(),
                'active': client.users.filter(is_active=True).count(),
                'limit': client.max_users,
                'can_add_more': client.can_add_user()
            },
            'outlets': {
                'total': client.outlets.count(),
                'active': client.outlets.filter(is_active=True).count(),
                'limit': client.max_outlets,
                'can_add_more': client.can_add_outlet()
            },
            'roles': {
                'total': Role.objects.filter(client=client).count()
            },
            'subscription': {
                'type': client.client_type,
                'status': client.status,
                'is_active': client.is_subscription_active(),
                'start_date': client.subscription_start,
                'end_date': client.subscription_end,
                'trial_end': client.trial_end
            }
        }

        return Response(stats)

    @action(detail=False, methods=['get'])
    def recent_activity(self, request):
        """Get recent activity for client"""
        user = request.user

        if not user.client:
            return Response({
                'status': 'error',
                'message': 'No client associated with user'
            }, status=status.HTTP_400_BAD_REQUEST)

        activities = UserActivity.objects.filter(
            client=user.client
        ).order_by('-created_at')[:50]

        return Response({
            'activities': UserActivitySerializer(activities, many=True).data
        })


# ============================================================================
# ACTIVITY LOGS (Client Scope)
# ============================================================================

class ClientActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Client Admin: View activity logs for their organization
    """
    permission_classes = [IsAuthenticated, IsClientAdmin]
    queryset = UserActivity.objects.all()
    serializer_class = UserActivitySerializer

    def get_queryset(self):
        """Filter activities by client scope"""
        user = self.request.user

        if user.is_superadmin():
            queryset = UserActivity.objects.all()
        else:
            queryset = UserActivity.objects.filter(client=user.client)

        # Filters
        activity_type = self.request.query_params.get('activity_type')
        user_id = self.request.query_params.get('user')

        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)

        if user_id:
            queryset = queryset.filter(user_id=user_id)

        return queryset.order_by('-created_at')
