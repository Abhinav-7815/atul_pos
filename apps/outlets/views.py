from rest_framework import viewsets, permissions
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
        return qs
