"""
POS Terminal Key Authentication
Used by Electron EXE — no login required.
Key stored as UUID in POSTerminalKey model (apps.accounts).
Header: X-POS-Key: <uuid>  OR  query param: ?pos_key=<uuid>
"""

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone


class POSTerminalUser:
    """
    Fake user object set on request.user when authenticated via POS Terminal Key.
    Provides .outlet and .is_authenticated so downstream code doesn't crash.
    """
    is_authenticated = True
    is_active = True
    is_anonymous = False
    is_staff = False
    is_superuser = False
    role = 'cashier'

    def __init__(self, key_obj):
        self.key_obj = key_obj
        self.outlet = key_obj.outlet
        self.outlet_id = key_obj.outlet_id
        self.full_name = f'POS Terminal [{key_obj.name}]'
        self.pk = None
        self.id = None

    def __str__(self):
        return self.full_name

    @property
    def is_authenticated(self):
        return True


class POSTerminalKeyAuthentication(BaseAuthentication):
    """
    Authenticates requests using X-POS-Key header or ?pos_key= query param.
    On success: request.user = POSTerminalUser, request.auth = key_obj
    """

    def authenticate(self, request):
        from apps.accounts.models import POSTerminalKey

        raw_key = (
            request.META.get('HTTP_X_POS_KEY')
            or request.query_params.get('pos_key')
        )
        if not raw_key:
            return None  # Let other authenticators try

        try:
            key_obj = POSTerminalKey.objects.select_related('outlet').get(
                key=raw_key,
                is_active=True,
            )
        except (POSTerminalKey.DoesNotExist, Exception):
            raise AuthenticationFailed('Invalid or inactive POS Terminal Key.')

        # Update last_used timestamp
        POSTerminalKey.objects.filter(pk=key_obj.pk).update(last_used=timezone.now())

        return (POSTerminalUser(key_obj), key_obj)

    def authenticate_header(self, request):
        return 'X-POS-Key'
