from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from apps.accounts.models import User
from apps.outlets.models import Outlet
import base64
import hashlib
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
import os

QZ_PRIVATE_KEY_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'qz-private-key.pem')

class QZSignView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        request_to_sign = request.data.get('request', '')
        try:
            with open(QZ_PRIVATE_KEY_PATH, 'rb') as f:
                private_key = serialization.load_pem_private_key(f.read(), password=None)
            signature = private_key.sign(
                request_to_sign.encode('utf-8'),
                padding.PKCS1v15(),
                hashes.SHA512()
            )
            return Response({'signature': base64.b64encode(signature).decode('utf-8')})
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        phone = request.data.get('phone')
        password = request.data.get('password')
        pin = request.data.get('pin')

        user = None
        if (phone or email) and password:
            if phone:
                # Look up user by phone, then authenticate via email
                try:
                    matched = User.objects.get(phone=phone.strip(), is_active=True)
                    user = authenticate(username=matched.email, password=password)
                except User.DoesNotExist:
                    user = None
            else:
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
