"""
Management Command: Initialize Default Roles
Creates default system roles with permissions
Usage: python manage.py init_roles
"""
from django.core.management.base import BaseCommand
from apps.accounts.models_advanced import Permission, Role


class Command(BaseCommand):
    help = 'Initialize default system roles'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(self.style.SUCCESS('INITIALIZING DEFAULT ROLES'))
        self.stdout.write(self.style.SUCCESS('='*70))

        # Define default roles with their permissions
        roles_data = [
            {
                'name': 'Super Admin',
                'slug': 'super-admin',
                'description': 'Full system access - all permissions',
                'is_system_role': True,
                'is_superadmin_role': True,
                'priority': 100,
                'permissions': []  # Gets all permissions
            },
            {
                'name': 'Client Admin',
                'slug': 'client-admin',
                'description': 'Full access within organization',
                'is_system_role': True,
                'is_client_admin_role': True,
                'priority': 90,
                'permissions': [
                    'can_create_user', 'can_update_user', 'can_delete_user', 'can_view_users',
                    'can_manage_roles',
                    'can_create_category', 'can_update_category', 'can_delete_category',
                    'can_create_product', 'can_update_product', 'can_delete_product',
                    'can_manage_pricing',
                    'can_create_order', 'can_update_order', 'can_cancel_order',
                    'can_refund_order', 'can_view_orders',
                    'can_manage_inventory', 'can_view_inventory', 'can_adjust_inventory',
                    'can_view_analytics', 'can_export_reports', 'can_view_financial_reports',
                    'can_create_outlet', 'can_update_outlet', 'can_delete_outlet',
                    'can_create_customer', 'can_update_customer', 'can_view_customers',
                    'can_manage_settings',
                    'can_manage_distribution', 'can_view_distribution'
                ]
            },
            {
                'name': 'Outlet Manager',
                'slug': 'outlet-manager',
                'description': 'Manage outlet operations',
                'is_system_role': True,
                'priority': 70,
                'permissions': [
                    'can_view_users',
                    'can_update_category', 'can_create_product', 'can_update_product',
                    'can_manage_pricing',
                    'can_create_order', 'can_update_order', 'can_cancel_order',
                    'can_refund_order', 'can_view_orders',
                    'can_manage_inventory', 'can_view_inventory', 'can_adjust_inventory',
                    'can_view_analytics', 'can_export_reports',
                    'can_create_customer', 'can_update_customer', 'can_view_customers'
                ]
            },
            {
                'name': 'Cashier',
                'slug': 'cashier',
                'description': 'Point of sale operations',
                'is_system_role': True,
                'priority': 50,
                'permissions': [
                    'can_create_order', 'can_update_order', 'can_view_orders',
                    'can_create_customer', 'can_view_customers'
                ]
            },
            {
                'name': 'Kitchen Staff',
                'slug': 'kitchen-staff',
                'description': 'View and manage kitchen orders',
                'is_system_role': True,
                'priority': 40,
                'permissions': [
                    'can_view_orders', 'can_update_order'
                ]
            },
            {
                'name': 'Inventory Manager',
                'slug': 'inventory-manager',
                'description': 'Manage inventory and stock',
                'is_system_role': True,
                'priority': 60,
                'permissions': [
                    'can_manage_inventory', 'can_view_inventory', 'can_adjust_inventory',
                    'can_view_analytics', 'can_export_reports'
                ]
            },
            {
                'name': 'Area Manager',
                'slug': 'area-manager',
                'description': 'Manage multiple outlets',
                'is_system_role': True,
                'priority': 80,
                'permissions': [
                    'can_view_users',
                    'can_create_category', 'can_update_category',
                    'can_create_product', 'can_update_product', 'can_manage_pricing',
                    'can_view_orders', 'can_update_order', 'can_refund_order',
                    'can_view_inventory', 'can_adjust_inventory',
                    'can_view_analytics', 'can_export_reports', 'can_view_financial_reports',
                    'can_update_outlet',
                    'can_view_customers',
                    'can_view_distribution'
                ]
            },
            {
                'name': 'Delivery Manager',
                'slug': 'delivery-manager',
                'description': 'Manage delivery and distribution',
                'is_system_role': True,
                'priority': 55,
                'permissions': [
                    'can_view_orders', 'can_update_order',
                    'can_manage_distribution', 'can_view_distribution',
                    'can_view_customers'
                ]
            },
            {
                'name': 'View Only',
                'slug': 'view-only',
                'description': 'Read-only access to data',
                'is_system_role': True,
                'priority': 10,
                'permissions': [
                    'can_view_users', 'can_view_orders', 'can_view_inventory',
                    'can_view_analytics', 'can_view_customers', 'can_view_distribution'
                ]
            }
        ]

        created_count = 0
        updated_count = 0

        for role_data in roles_data:
            permission_names = role_data.pop('permissions', [])

            role, created = Role.objects.update_or_create(
                slug=role_data['slug'],
                defaults=role_data
            )

            # Assign permissions
            if permission_names:
                permissions = Permission.objects.filter(name__in=permission_names)
                role.permissions.set(permissions)
                perm_count = permissions.count()
            else:
                perm_count = 0

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(
                    f'  ✓ Created: {role.name} ({perm_count} permissions)'
                ))
            else:
                updated_count += 1
                self.stdout.write(
                    f'  → Updated: {role.name} ({perm_count} permissions)'
                )

        self.stdout.write(self.style.SUCCESS('\n' + '='*70))
        self.stdout.write(self.style.SUCCESS('ROLE INITIALIZATION COMPLETE'))
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(f'\nCreated: {created_count}')
        self.stdout.write(f'Updated: {updated_count}')
        self.stdout.write(f'Total: {Role.objects.filter(is_system_role=True).count()}')
