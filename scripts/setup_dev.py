import os, sys, io
from pathlib import Path

# Ensure project root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

import django; django.setup()

from django.contrib.auth import get_user_model
from apps.outlets.models import Outlet, OutletType
from apps.menu.models import Category, Product, ProductVariant, ModifierGroup, Modifier
from apps.accounts.models import UserRole
from apps.inventory.models import StockItem

User = get_user_model()

print("=== Atul Ice Cream — Dev Setup ===")

# 1. Main outlet
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
        'outlet_type': OutletType.MAIN,
        'receipt_header': 'ATUL ICE CREAM\nMAKING THE WORLD SWEETER',
        'receipt_footer': 'Thank you for visiting! Come again.',
    }
)
if not created:
    outlet.outlet_type = OutletType.MAIN
    outlet.save()
print("[OK] Outlet:", outlet.name, "| type:", outlet.outlet_type)

# 2. Admin user (linked to outlet)
admin_email = 'admin@atul.com'
if not User.objects.filter(email=admin_email).exists():
    admin = User.objects.create_superuser(
        email=admin_email, password='admin123', full_name='System Admin'
    )
else:
    admin = User.objects.get(email=admin_email)
admin.outlet = outlet
admin.save()
print("[OK] Admin user:", admin_email, "/ password: admin123")

# 3. Cashier user
cashier_email = 'cashier@atul.com'
if not User.objects.filter(email=cashier_email).exists():
    cashier = User.objects.create_user(
        email=cashier_email, password='cashier123',
        full_name='Aryan Patel', role=UserRole.CASHIER, outlet=outlet
    )
    cashier.set_pin('1234')
    cashier.save()
    print("[OK] Cashier:", cashier_email, "/ password: cashier123 / PIN: 1234")
else:
    print("[OK] Cashier already exists:", cashier_email)

# 4. Categories
cats_data = [
    {'name': 'Ice Cream Scoops', 'icon_emoji': 'ICS', 'display_order': 1, 'color_hex': '#FFB7D5'},
    {'name': 'Sundaes',          'icon_emoji': 'SND', 'display_order': 2, 'color_hex': '#BCC6FF'},
    {'name': 'Thick Shakes',     'icon_emoji': 'TSK', 'display_order': 3, 'color_hex': '#D63384'},
    {'name': 'Shakes',           'icon_emoji': 'SHK', 'display_order': 4, 'color_hex': '#FFB7D5'},
    {'name': 'Sundae Specials',  'icon_emoji': 'SDS', 'display_order': 5, 'color_hex': '#BCC6FF'},
    {'name': 'Waffles',          'icon_emoji': 'WFL', 'display_order': 6, 'color_hex': '#FFD0A5'},
    {'name': 'Sizzlers & Brownies','icon_emoji':'SZL','display_order': 7, 'color_hex': '#FFD0A5'},
    {'name': 'Party Packs',      'icon_emoji': 'PPK', 'display_order': 8, 'color_hex': '#FFB7D5'},
    {'name': 'Cones',            'icon_emoji': 'CNE', 'display_order': 9, 'color_hex': '#FFB7D5'},
]
cats = {}
for d in cats_data:
    c, _ = Category.objects.get_or_create(name=d['name'], defaults=d)
    cats[c.name] = c
print("[OK] Categories:", len(cats))

# 5. Products
products_data = [
    # Scoops
    ('Ice Cream Scoops', 'Belgian Chocolate', 240),
    ('Ice Cream Scoops', 'Mango Alphonso',    110),
    ('Ice Cream Scoops', 'Kesar Pista',       110),
    ('Ice Cream Scoops', 'Real Sitaphal',     130),
    ('Ice Cream Scoops', 'Sitaphal',           90),
    ('Ice Cream Scoops', 'Tender Coconut',     60),
    ('Ice Cream Scoops', 'Butterscotch',       50),
    ('Ice Cream Scoops', 'Vanilla Classic',    40),
    ('Ice Cream Scoops', 'Strawberry',         50),
    ('Ice Cream Scoops', 'Black Currant',      55),
    ('Ice Cream Scoops', 'Rajbhog',            75),
    ('Ice Cream Scoops', 'Chikoo',             55),
    ('Ice Cream Scoops', 'Paan Flavour',       65),
    ('Ice Cream Scoops', 'Jamun',              60),
    ('Ice Cream Scoops', 'Rose Gulkand',       70),
    ('Ice Cream Scoops', 'Coffee Walnut',      65),
    ('Ice Cream Scoops', 'Anjeer Badam',       85),
    ('Ice Cream Scoops', 'Litchi',             60),
    ('Ice Cream Scoops', 'Roasted Almond',     75),
    # Shakes
    ('Thick Shakes', 'Belgian Choco Shake', 180),
    ('Thick Shakes', 'Mango Shake',         160),
    ('Shakes',       'Strawberry Shake',    140),
    ('Shakes',       'Vanilla Shake',       130),
    # Sundaes
    ('Sundaes',         'Gadbad Sundae',    200),
    ('Sundaes',         'Dry Fruit Sundae', 220),
    ('Sundae Specials', 'Royal Sundae',     280),
    # Others
    ('Sizzlers & Brownies', 'Sizzling Brownie', 250),
    ('Waffles',             'Waffle Classic',   180),
    ('Waffles',             'Waffle Choco',     210),
    ('Cones',               'Butter Scotch Cone', 40),
    ('Cones',               'Chocolate Cone',    45),
    ('Party Packs',         'Family Pack 1L',   350),
    ('Party Packs',         'Party Pack 2L',    650),
]

created_count = 0
for cat_name, prod_name, price in products_data:
    cat = cats.get(cat_name)
    if not cat:
        continue
    p, created = Product.objects.get_or_create(
        name=prod_name,
        defaults={'category': cat, 'base_price': price, 'is_veg': True, 'hsn_code': '2105'}
    )
    if created:
        ProductVariant.objects.get_or_create(
            product=p, name='Regular',
            defaults={'price_delta': 0, 'is_default': True}
        )
        created_count += 1

print("[OK] Products total:", Product.objects.count(), "| new:", created_count)

# 6. Stock for all products at main outlet
stock_count = 0
for p in Product.objects.all():
    _, created = StockItem.objects.get_or_create(
        outlet=outlet, product=p, variant=None,
        defaults={'quantity': 100, 'min_threshold': 10}
    )
    if created:
        stock_count += 1
print("[OK] Stock items ready. New:", stock_count)

print("")
print("=== SETUP COMPLETE ===")
print("  Admin   : admin@atul.com    / admin123")
print("  Cashier : cashier@atul.com  / cashier123  (PIN: 1234)")
print("  Outlet  : Vastrapur (type=main)")
