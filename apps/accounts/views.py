from rest_framework import viewsets, permissions
from .models import User
from .serializers import UserSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset           = User.objects.all()
    serializer_class   = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = User.objects.all()
        outlet_id = self.request.query_params.get('outlet')
        if outlet_id:
            qs = qs.filter(outlet_id=outlet_id)
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        return qs
