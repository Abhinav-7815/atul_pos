"""
Management Command: Initialize Default Permissions
Creates all default system permissions
Usage: python manage.py init_permissions
"""
from django.core.management.base import BaseCommand
from apps.accounts.models_advanced import Permission, PermissionCategory


class Command(BaseCommand):
    help = 'Initialize default system permissions'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(self.style.SUCCESS('INITIALIZING DEFAULT PERMISSIONS'))
        self.stdout.write(self.style.SUCCESS('='*70))

        permissions_data = [
            # User Management
            {
                'name': 'can_create_user',
                'display_name': 'Can Create Users',
                'description': 'Ability to create new user accounts',
                'category': PermissionCategory.USER_MANAGEMENT,
                'resource': 'user',
                'action': 'create',
                'is_superadmin_only': False
            },
            {
                'name': 'can_update_user',
                'display_name': 'Can Update Users',
                'description': 'Ability to modify user accounts',
                'category': PermissionCategory.USER_MANAGEMENT,
                'resource': 'user',
                'action': 'update',
                'is_superadmin_only': False
            },
            {
                'name': 'can_delete_user',
                'display_name': 'Can Delete Users',
                'description': 'Ability to delete user accounts',
                'category': PermissionCategory.USER_MANAGEMENT,
                'resource': 'user',
                'action': 'delete',
                'is_superadmin_only': False
            },
            {
                'name': 'can_view_users',
                'display_name': 'Can View Users',
                'description': 'Ability to view user accounts',
                'category': PermissionCategory.USER_MANAGEMENT,
                'resource': 'user',
                'action': 'read',
                'is_superadmin_only': False
            },
            {
                'name': 'can_manage_roles',
                'display_name': 'Can Manage Roles',
                'description': 'Ability to create and assign roles',
                'category': PermissionCategory.USER_MANAGEMENT,
                'resource': 'role',
                'action': 'manage',
                'is_superadmin_only': False
            },

            # Menu Management
            {
                'name': 'can_create_category',
                'display_name': 'Can Create Categories',
                'description': 'Ability to create menu categories',
                'category': PermissionCategory.MENU_MANAGEMENT,
                'resource': 'category',
                'action': 'create',
                'is_superadmin_only': False
            },
            {
                'name': 'can_update_category',
                'display_name': 'Can Update Categories',
                'description': 'Ability to modify menu categories',
                'category': PermissionCategory.MENU_MANAGEMENT,
                'resource': 'category',
                'action': 'update',
                'is_superadmin_only': False
            },
            {
                'name': 'can_delete_category',
                'display_name': 'Can Delete Categories',
                'description': 'Ability to delete menu categories',
                'category': PermissionCategory.MENU_MANAGEMENT,
                'resource': 'category',
                'action': 'delete',
                'is_superadmin_only': False
            },
            {
                'name': 'can_create_product',
                'display_name': 'Can Create Products',
                'description': 'Ability to create menu products',
                'category': PermissionCategory.MENU_MANAGEMENT,
                'resource': 'product',
                'action': 'create',
                'is_superadmin_only': False
            },
            {
                'name': 'can_update_product',
                'display_name': 'Can Update Products',
                'description': 'Ability to modify menu products',
                'category': PermissionCategory.MENU_MANAGEMENT,
                'resource': 'product',
                'action': 'update',
                'is_superadmin_only': False
            },
            {
                'name': 'can_delete_product',
                'display_name': 'Can Delete Products',
                'description': 'Ability to delete menu products',
                'category': PermissionCategory.MENU_MANAGEMENT,
                'resource': 'product',
                'action': 'delete',
                'is_superadmin_only': False
            },
            {
                'name': 'can_manage_pricing',
                'display_name': 'Can Manage Pricing',
                'description': 'Ability to modify product prices',
                'category': PermissionCategory.MENU_MANAGEMENT,
                'resource': 'product',
                'action': 'manage_pricing',
                'is_superadmin_only': False
            },

            # Order Management
            {
                'name': 'can_create_order',
                'display_name': 'Can Create Orders',
                'description': 'Ability to create new orders',
                'category': PermissionCategory.ORDER_MANAGEMENT,
                'resource': 'order',
                'action': 'create',
                'is_superadmin_only': False
            },
            {
                'name': 'can_update_order',
                'display_name': 'Can Update Orders',
                'description': 'Ability to modify existing orders',
                'category': PermissionCategory.ORDER_MANAGEMENT,
                'resource': 'order',
                'action': 'update',
                'is_superadmin_only': False
            },
            {
                'name': 'can_cancel_order',
                'display_name': 'Can Cancel Orders',
                'description': 'Ability to cancel orders',
                'category': PermissionCategory.ORDER_MANAGEMENT,
                'resource': 'order',
                'action': 'cancel',
                'is_superadmin_only': False
            },
            {
                'name': 'can_refund_order',
                'display_name': 'Can Refund Orders',
                'description': 'Ability to process order refunds',
                'category': PermissionCategory.ORDER_MANAGEMENT,
                'resource': 'order',
                'action': 'refund',
                'is_superadmin_only': False
            },
            {
                'name': 'can_view_orders',
                'display_name': 'Can View Orders',
                'description': 'Ability to view all orders',
                'category': PermissionCategory.ORDER_MANAGEMENT,
                'resource': 'order',
                'action': 'read',
                'is_superadmin_only': False
            },

            # Inventory Management
            {
                'name': 'can_manage_inventory',
                'display_name': 'Can Manage Inventory',
                'description': 'Ability to manage inventory levels',
                'category': PermissionCategory.INVENTORY,
                'resource': 'inventory',
                'action': 'manage',
                'is_superadmin_only': False
            },
            {
                'name': 'can_view_inventory',
                'display_name': 'Can View Inventory',
                'description': 'Ability to view inventory levels',
                'category': PermissionCategory.INVENTORY,
                'resource': 'inventory',
                'action': 'read',
                'is_superadmin_only': False
            },
            {
                'name': 'can_adjust_inventory',
                'display_name': 'Can Adjust Inventory',
                'description': 'Ability to manually adjust inventory',
                'category': PermissionCategory.INVENTORY,
                'resource': 'inventory',
                'action': 'adjust',
                'is_superadmin_only': False
            },

            # Analytics & Reports
            {
                'name': 'can_view_analytics',
                'display_name': 'Can View Analytics',
                'description': 'Ability to view analytics and reports',
                'category': PermissionCategory.ANALYTICS,
                'resource': 'analytics',
                'action': 'read',
                'is_superadmin_only': False
            },
            {
                'name': 'can_export_reports',
                'display_name': 'Can Export Reports',
                'description': 'Ability to export reports',
                'category': PermissionCategory.ANALYTICS,
                'resource': 'analytics',
                'action': 'export',
                'is_superadmin_only': False
            },
            {
                'name': 'can_view_financial_reports',
                'display_name': 'Can View Financial Reports',
                'description': 'Ability to view financial reports',
                'category': PermissionCategory.FINANCIAL,
                'resource': 'financial_report',
                'action': 'read',
                'is_superadmin_only': False
            },

            # Outlet Management
            {
                'name': 'can_create_outlet',
                'display_name': 'Can Create Outlets',
                'description': 'Ability to create new outlets',
                'category': PermissionCategory.OUTLET_MANAGEMENT,
                'resource': 'outlet',
                'action': 'create',
                'is_superadmin_only': False
            },
            {
                'name': 'can_update_outlet',
                'display_name': 'Can Update Outlets',
                'description': 'Ability to modify outlet settings',
                'category': PermissionCategory.OUTLET_MANAGEMENT,
                'resource': 'outlet',
                'action': 'update',
                'is_superadmin_only': False
            },
            {
                'name': 'can_delete_outlet',
                'display_name': 'Can Delete Outlets',
                'description': 'Ability to delete outlets',
                'category': PermissionCategory.OUTLET_MANAGEMENT,
                'resource': 'outlet',
                'action': 'delete',
                'is_superadmin_only': False
            },

            # Customer Management
            {
                'name': 'can_create_customer',
                'display_name': 'Can Create Customers',
                'description': 'Ability to create customer accounts',
                'category': PermissionCategory.CUSTOMER_MANAGEMENT,
                'resource': 'customer',
                'action': 'create',
                'is_superadmin_only': False
            },
            {
                'name': 'can_update_customer',
                'display_name': 'Can Update Customers',
                'description': 'Ability to modify customer accounts',
                'category': PermissionCategory.CUSTOMER_MANAGEMENT,
                'resource': 'customer',
                'action': 'update',
                'is_superadmin_only': False
            },
            {
                'name': 'can_view_customers',
                'display_name': 'Can View Customers',
                'description': 'Ability to view customer information',
                'category': PermissionCategory.CUSTOMER_MANAGEMENT,
                'resource': 'customer',
                'action': 'read',
                'is_superadmin_only': False
            },

            # Settings
            {
                'name': 'can_manage_settings',
                'display_name': 'Can Manage Settings',
                'description': 'Ability to modify system settings',
                'category': PermissionCategory.SETTINGS,
                'resource': 'settings',
                'action': 'manage',
                'is_superadmin_only': False
            },
            {
                'name': 'can_manage_api_tokens',
                'display_name': 'Can Manage API Tokens',
                'description': 'Ability to create and manage API tokens',
                'category': PermissionCategory.SETTINGS,
                'resource': 'api_token',
                'action': 'manage',
                'is_superadmin_only': True
            },

            # Distribution
            {
                'name': 'can_manage_distribution',
                'display_name': 'Can Manage Distribution',
                'description': 'Ability to manage distribution orders',
                'category': PermissionCategory.DISTRIBUTION,
                'resource': 'distribution',
                'action': 'manage',
                'is_superadmin_only': False
            },
            {
                'name': 'can_view_distribution',
                'display_name': 'Can View Distribution',
                'description': 'Ability to view distribution orders',
                'category': PermissionCategory.DISTRIBUTION,
                'resource': 'distribution',
                'action': 'read',
                'is_superadmin_only': False
            }
        ]

        created_count = 0
        updated_count = 0

        for perm_data in permissions_data:
            permission, created = Permission.objects.update_or_create(
                name=perm_data['name'],
                defaults=perm_data
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created: {permission.display_name}'))
            else:
                updated_count += 1
                self.stdout.write(f'  → Updated: {permission.display_name}')

        self.stdout.write(self.style.SUCCESS('\n' + '='*70))
        self.stdout.write(self.style.SUCCESS('PERMISSION INITIALIZATION COMPLETE'))
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(f'\nCreated: {created_count}')
        self.stdout.write(f'Updated: {updated_count}')
        self.stdout.write(f'Total: {Permission.objects.count()}')
