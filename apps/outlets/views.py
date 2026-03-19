from rest_framework import viewsets, permissions
from .models import Outlet
from .serializers import OutletSerializer

class OutletViewSet(viewsets.ModelViewSet):
    queryset = Outlet.objects.all()
    serializer_class = OutletSerializer
    permission_classes = [permissions.IsAuthenticated]
