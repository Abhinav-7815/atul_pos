from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from apps.accounts.models import User
from apps.outlets.models import Outlet

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        pin = request.data.get('pin')

        user = None
        if email and password:
            user = authenticate(username=email, password=password)
        elif pin:
            users = User.objects.filter(is_active=True).exclude(pin__isnull=True)
            for cached_user in users:
                if cached_user.check_pin(pin):
                    user = cached_user
                    break

        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'full_name': user.full_name,
                    'role': user.role,
                    'outlet_id':   user.outlet.id          if user.outlet else None,
                    'outlet_name': user.outlet.name        if user.outlet else None,
                    'outlet_type': user.outlet.outlet_type if user.outlet else None,
                    'distributor_discount_pct': float(user.outlet.distributor_discount_pct) if user.outlet else 0,
                }
            })
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

class OutletSwitchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        outlet_id = request.data.get('outlet_id')
        outlet = get_object_or_404(Outlet, id=outlet_id)
        
        # In a real app, we might store this in a session or just trust the client
        # For now, return a confirmation
        return Response({
            'success': True,
            'active_outlet': {
                'id': outlet.id,
                'name': outlet.name
            }
        })

from django.shortcuts import get_object_or_404
