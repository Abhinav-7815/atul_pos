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


# ─── POS Terminal Key Management ───────────────────────────────────────────────

def _get_outlet_for_user(user):
    """Resolve the outlet for a user; superadmins without outlet get the first outlet."""
    if user.outlet:
        return user.outlet
    from apps.outlets.models import Outlet
    return Outlet.objects.first()

class POSKeyListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.accounts.models import POSTerminalKey
        outlet = _get_outlet_for_user(request.user)
        if not outlet:
            return Response({'success': True, 'data': []})
        # Superadmin sees all keys; others see only their outlet
        if request.user.role == 'superadmin' or request.user.is_superuser:
            keys = POSTerminalKey.objects.all()
        else:
            keys = POSTerminalKey.objects.filter(outlet=outlet)
        data = [
            {
                'id': str(k.pk),
                'key': str(k.key),
                'name': k.name,
                'is_active': k.is_active,
                'created_at': k.created_at,
                'last_used': k.last_used,
            }
            for k in keys
        ]
        return Response({'success': True, 'data': data})

    def post(self, request):
        from apps.accounts.models import POSTerminalKey
        name = request.data.get('name', '').strip()
        outlet_id = request.data.get('outlet_id')
        if not name:
            return Response({'success': False, 'error': 'Name required.'}, status=400)
        if outlet_id:
            from apps.outlets.models import Outlet
            outlet = get_object_or_404(Outlet, pk=outlet_id)
        else:
            outlet = _get_outlet_for_user(request.user)
        if not outlet:
            return Response({'success': False, 'error': 'No outlet found.'}, status=400)
        key = POSTerminalKey.objects.create(
            name=name,
            outlet=outlet,
            created_by=request.user,
        )
        return Response({'success': True, 'data': {'id': str(key.pk), 'key': str(key.key), 'name': key.name}}, status=201)


class POSKeyDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_key(self, request, pk):
        from apps.accounts.models import POSTerminalKey
        if request.user.role == 'superadmin' or request.user.is_superuser:
            return get_object_or_404(POSTerminalKey, pk=pk)
        outlet = _get_outlet_for_user(request.user)
        return get_object_or_404(POSTerminalKey, pk=pk, outlet=outlet)

    def delete(self, request, pk):
        key = self._get_key(request, pk)
        key.delete()
        return Response({'success': True})

    def patch(self, request, pk):
        key = self._get_key(request, pk)
        key.is_active = request.data.get('is_active', key.is_active)
        key.name = request.data.get('name', key.name)
        key.save()
        return Response({'success': True, 'data': {'id': str(key.pk), 'key': str(key.key), 'name': key.name, 'is_active': key.is_active}})
