from django.core.management.base import BaseCommand
from django.contrib.auth import authenticate, get_user_model

class Command(BaseCommand):
    def handle(self, *args, **options):
        User = get_user_model()
        email = 'cashier@atul.com'
        password = 'cashier123'
        
        user = User.objects.get(email=email)
        print(f"User exists: {user.email}, is_active: {user.is_active}, has_password: {user.has_usable_password()}")
        
        # Test authenticate with username=
        auth_user_username = authenticate(username=email, password=password)
        print(f"Auth with username={email}: {auth_user_username}")
        
        # Test authenticate with email=
        auth_user_email = authenticate(email=email, password=password)
        print(f"Auth with email={email}: {auth_user_email}")
