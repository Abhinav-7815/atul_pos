from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import APIKey


class APIKeyAuthentication(BaseAuthentication):
    """
    Reads API key from header:  X-API-Key: <plain_key>
    or query param:             ?api_key=<plain_key>

    On success sets request.user = None, request.auth = <APIKey instance>
    """
    keyword = 'X-API-Key'

    def authenticate(self, request):
        plain_key = (
            request.META.get('HTTP_X_API_KEY')
            or request.query_params.get('api_key')
        )
        if not plain_key:
            return None  # Let other authenticators try

        api_key = APIKey.verify(plain_key)
        if not api_key:
            raise AuthenticationFailed('Invalid or inactive API key.')

        # user=None signals "authenticated but no user object"
        return (None, api_key)

    def authenticate_header(self, request):
        return self.keyword
