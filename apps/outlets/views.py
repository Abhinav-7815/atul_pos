from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from .models import Outlet
from .serializers import OutletSerializer


class OutletViewSet(viewsets.ModelViewSet):
    queryset           = Outlet.objects.all()   # required by DRF router for basename
    serializer_class   = OutletSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Outlet.objects.all()
        outlet_type = self.request.query_params.get('outlet_type')
        if outlet_type:
            qs = qs.filter(outlet_type=outlet_type)
        branch_type = self.request.query_params.get('branch_type')
        if branch_type:
            qs = qs.filter(branch_type=branch_type)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(city__icontains=search)
        return qs.order_by('-created_at')

    @action(detail=False, methods=['post'], url_path='create_distributor')
    @transaction.atomic
    def create_distributor(self, request):
        """
        Creates a distributor outlet + an optional manager user in a single atomic call.
        Body: { outlet: {...}, manager: { full_name, email, password, phone } }
        """
        from apps.accounts.models import User, UserRole

        outlet_data  = request.data.get('outlet', {})
        manager_data = request.data.get('manager', None)

        # Force outlet_type = distributor
        outlet_data['outlet_type'] = 'distributor'

        serializer = OutletSerializer(data=outlet_data)
        serializer.is_valid(raise_exception=True)
        outlet = serializer.save()

        manager_out = None
        if manager_data and manager_data.get('email'):
            password = manager_data.pop('password', None)
            manager  = User(
                full_name = manager_data.get('full_name', ''),
                email     = manager_data.get('email'),
                phone     = manager_data.get('phone', ''),
                role      = UserRole.DISTRIBUTOR,
                outlet    = outlet,
            )
            if password:
                manager.set_password(password)
            else:
                manager.set_unusable_password()
            manager.save()
            manager_out = {
                'id':        str(manager.id),
                'full_name': manager.full_name,
                'email':     manager.email,
                'role':      manager.role,
            }

        return Response(
            {'outlet': OutletSerializer(outlet).data, 'manager': manager_out},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='distributor_stats')
    def distributor_stats(self, request):
        """Quick stats for the distributor management dashboard."""
        distributors = Outlet.objects.filter(outlet_type='distributor')
        return Response({
            'total':     distributors.count(),
            'own':       distributors.filter(branch_type='own').count(),
            'franchise': distributors.filter(branch_type='franchise').count(),
            'active':    distributors.filter(is_active=True).count(),
            'inactive':  distributors.filter(is_active=False).count(),
        })
