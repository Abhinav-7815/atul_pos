"""
Management Command: Create Super Admin User
Creates a super admin user for platform management
Usage: python manage.py create_superadmin
"""
from django.core.management.base import BaseCommand
from apps.accounts.models import User, UserRole
from django.utils import timezone


class Command(BaseCommand):
    help = 'Create a super admin user'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Email address')
        parser.add_argument('--password', type=str, help='Password')
        parser.add_argument('--name', type=str, help='Full name')

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(self.style.SUCCESS('CREATE SUPER ADMIN USER'))
        self.stdout.write(self.style.SUCCESS('='*70))

        # Get email
        email = options.get('email')
        if not email:
            email = input('\nEnter email address: ').strip()

        # Check if user exists
        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.ERROR(f'\n✗ User with email {email} already exists'))
            return

        # Get password
        password = options.get('password')
        if not password:
            from getpass import getpass
            password = getpass('\nEnter password: ')
            password_confirm = getpass('Confirm password: ')

            if password != password_confirm:
                self.stdout.write(self.style.ERROR('\n✗ Passwords do not match'))
                return

        # Get name
        name = options.get('name')
        if not name:
            name = input('\nEnter full name: ').strip()

        # Create super admin
        try:
            user = User.objects.create(
                email=email,
                full_name=name,
                role=UserRole.SUPERADMIN,
                is_staff=True,
                is_superuser=True,
                is_active=True,
                is_email_verified=True,
                client=None,  # Super admins have no client
                date_joined=timezone.now()
            )
            user.set_password(password)
            user.save()

            self.stdout.write(self.style.SUCCESS('\n' + '='*70))
            self.stdout.write(self.style.SUCCESS('SUPER ADMIN CREATED SUCCESSFULLY'))
            self.stdout.write(self.style.SUCCESS('='*70))
            self.stdout.write(f'\nEmail: {user.email}')
            self.stdout.write(f'Name: {user.full_name}')
            self.stdout.write(f'Role: {user.get_role_display()}')
            self.stdout.write(f'ID: {user.id}')
            self.stdout.write('\nYou can now login with these credentials.')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n✗ Error creating super admin: {str(e)}'))
