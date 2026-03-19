import os
import uuid
import django
from decimal import Decimal

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from django.contrib.auth import get_user_model
from apps.outlets.models import Outlet
from apps.menu.models import Category, Product, ProductVariant, ModifierGroup, Modifier, OutletProductStatus
from apps.accounts.models import UserRole
from apps.inventory.models import StockItem
from apps.staff.models import CashierShift

User = get_user_model()

def seed_data():
    print("🚀 Starting Seeding...")

    # 1. Create Outlet
    outlet, created = Outlet.objects.get_or_create(
        outlet_code='vastrapur',
        defaults={
            'name': 'Atul Ice Cream - Vastrapur',
            'address': 'Ground Floor, Alpha One Mall, Vastrapur',
            'city': 'Ahmedabad',
            'phone': '9876543210',
            'email': 'vastrapur@atulicecream.com',
            'gstin': '24AAAAA0000A1Z5',
            'fssai_number': '12345678901234',
            'receipt_header': 'ATUL ICE CREAM\nMAKING THE WORLD SWEETER\n----------------',
            'receipt_footer': 'Thank you for visiting!\nVisit again soon.'
        }
    )
    if created: print(f"✅ Created Outlet: {outlet.name}")

    # 2. Create Users
    admin_email = 'admin@atul.com'
    if not User.objects.filter(email=admin_email).exists():
        admin = User.objects.create_superuser(
            email=admin_email,
            password='admin123',
            full_name='System Admin'
        )
        print(f"✅ Created Superuser: {admin_email}")

    cashier_email = 'cashier@atul.com'
    if not User.objects.filter(email=cashier_email).exists():
        cashier = User.objects.create_user(
            email=cashier_email,
            password='cashier123',
            full_name='Aryan Patel',
            role=UserRole.CASHIER,
            outlet=outlet
        )
        cashier.set_pin('1234')
        cashier.save()
        print(f"✅ Created Cashier: {cashier_email} (PIN: 1234)")

    # 3. Categories
    categories_data = [
        {'name': 'Ice Cream Scoops', 'icon_emoji': '🍦', 'display_order': 1, 'color_hex': '#FFB7D5'},
        {'name': 'Thick Shakes', 'icon_emoji': '🥤', 'display_order': 2, 'color_hex': '#D63384'},
        {'name': 'Sundae Specials', 'icon_emoji': '🍨', 'display_order': 3, 'color_hex': '#BCC6FF'},
        {'name': 'Sizzlers & Brownies', 'icon_emoji': '🥘', 'display_order': 4, 'color_hex': '#FFD0A5'},
    ]

    cats = {}
    for data in categories_data:
        cat, created = Category.objects.get_or_create(name=data['name'], defaults=data)
        cats[cat.name] = cat
        if created: print(f"✅ Created Category: {cat.name}")

    # 4. Products
    products_data = [
        # Scoops
        {'category': cats['Ice Cream Scoops'], 'name': 'Rajbhog', 'base_price': 60.00, 'is_veg': True, 'hsn_code': '2105'},
        {'category': cats['Ice Cream Scoops'], 'name': 'American Nuts', 'base_price': 70.00, 'is_veg': True, 'hsn_code': '2105'},
        {'category': cats['Ice Cream Scoops'], 'name': 'Kaju Draksh', 'base_price': 60.00, 'is_veg': True, 'hsn_code': '2105'},
        {'category': cats['Ice Cream Scoops'], 'name': 'Tender Coconut', 'base_price': 80.00, 'is_veg': True, 'hsn_code': '2105'},
        
        # Shakes
        {'category': cats['Thick Shakes'], 'name': 'Belgian Chocolate Shake', 'base_price': 140.00, 'is_veg': True, 'hsn_code': '2105'},
        {'category': cats['Thick Shakes'], 'name': 'Kesar Pista Shake', 'base_price': 160.00, 'is_veg': True, 'hsn_code': '2105'},
        
        # Sundaes
        {'category': cats['Sundae Specials'], 'name': 'Dry Fruit Sundae', 'base_price': 180.00, 'is_veg': True, 'hsn_code': '2105'},
        {'category': cats['Sundae Specials'], 'name': 'Gadbad Sundae', 'base_price': 150.00, 'is_veg': True, 'hsn_code': '2105'},
        
        # Sizzlers
        {'category': cats['Sizzlers & Brownies'], 'name': 'Sizzling Brownie', 'base_price': 220.00, 'is_veg': True, 'hsn_code': '2105'},
    ]

    for data in products_data:
        p, created = Product.objects.get_or_create(name=data['name'], defaults=data)
        if created:
            print(f"✅ Created Product: {p.name}")
            # Add default variant for all
            ProductVariant.objects.create(product=p, name='Regular', price_delta=0, is_default=True)
            
            # Add Size variants for Shakes
            if 'Shake' in p.name:
                ProductVariant.objects.create(product=p, name='Large', price_delta=40.00)
            
            # Add Modifier Group for Sizzlers
            if 'Sizzling' in p.name:
                mg = ModifierGroup.objects.create(name='Add-ons', min_select=0, max_select=3)
                mg.product.add(p)
                Modifier.objects.create(group=mg, name='Extra Cashews', price_delta=30.00)
                Modifier.objects.create(group=mg, name='Extra Chocolate Sauce', price_delta=20.00)
                Modifier.objects.create(group=mg, name='Whipped Cream', price_delta=25.00)

    # 5. Inventory (Stock for Products)
    for p in Product.objects.all():
        StockItem.objects.get_or_create(
            outlet=outlet,
            product=p,
            variant=None,
            defaults={
                'quantity': 100.0,
                'min_threshold': 10.0
            }
        )
    print("✅ Initialized Stock for all products")

    print("\n✨ Seeding Complete! All systems ready for testing.")

if __name__ == '__main__':
    seed_data()
