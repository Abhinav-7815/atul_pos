from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.outlets.models import Outlet
from apps.menu.models import Category, Product, ProductVariant, ModifierGroup, Modifier
from apps.accounts.models import UserRole
from apps.inventory.models import StockItem, Supplier
from decimal import Decimal

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with dummy data'

    def handle(self, *args, **options):
        self.stdout.write("🚀 Starting Seeding...")

        # 1. Clear existing data (optional but requested for users)
        self.stdout.write("🗑️ Clearing existing users...")
        User.objects.all().delete()

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
        if created: self.stdout.write(f"✅ Created Outlet: {outlet.name}")
        else: self.stdout.write(f"ℹ️ Using existing Outlet: {outlet.name}")

        # 2. Create Users
        admin_email = 'admin@atul.com'
        admin = User.objects.create_superuser(
            email=admin_email,
            password='admin123',
            full_name='System Admin'
        )
        self.stdout.write(f"✅ Created Superuser: {admin_email}")

        cashier_email = 'cashier@atul.com'
        cashier = User.objects.create_user(
            email=cashier_email,
            password='cashier123',
            full_name='Aryan Patel',
            role=UserRole.CASHIER,
            outlet=outlet
        )
        cashier.set_pin('1234')
        cashier.save()
        self.stdout.write(f"✅ Created Cashier: {cashier_email} (PIN: 1234)")

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
            if created: self.stdout.write(f"✅ Created Category: {cat.name}")

        # 4. Products
        products_data = [
            {'category': cats['Ice Cream Scoops'], 'name': 'Rajbhog', 'base_price': 60.00, 'is_veg': True, 'hsn_code': '2105'},
            {'category': cats['Ice Cream Scoops'], 'name': 'American Nuts', 'base_price': 70.00, 'is_veg': True, 'hsn_code': '2105'},
            {'category': cats['Ice Cream Scoops'], 'name': 'Kaju Draksh', 'base_price': 60.00, 'is_veg': True, 'hsn_code': '2105'},
            {'category': cats['Thick Shakes'], 'name': 'Belgian Chocolate Shake', 'base_price': 140.00, 'is_veg': True, 'hsn_code': '2105'},
            {'category': cats['Sundae Specials'], 'name': 'Dry Fruit Sundae', 'base_price': 180.00, 'is_veg': True, 'hsn_code': '2105'},
            {'category': cats['Sizzlers & Brownies'], 'name': 'Sizzling Brownie', 'base_price': 220.00, 'is_veg': True, 'hsn_code': '2105'},
        ]

        for data in products_data:
            p, created = Product.objects.get_or_create(name=data['name'], defaults=data)
            if created:
                self.stdout.write(f"✅ Created Product: {p.name}")
                # Create Regular Variant
                v_reg = ProductVariant.objects.create(product=p, name='Regular', price_delta=0, is_default=True)
                
                # Add Initial Stock
                StockItem.objects.create(
                    product=p,
                    variant=v_reg,
                    outlet=outlet,
                    quantity=100.0,
                    min_threshold=10.0
                )

                if 'Shake' in p.name:
                    v_large = ProductVariant.objects.create(product=p, name='Large', price_delta=40.00)
                    StockItem.objects.create(
                        product=p,
                        variant=v_large,
                        outlet=outlet,
                        quantity=50.0,
                        min_threshold=5.0
                    )

                if 'Sizzling' in p.name:
                    mg = ModifierGroup.objects.create(name='Add-ons', min_select=0, max_select=3)
                    mg.product.add(p)
                    Modifier.objects.create(group=mg, name='Extra Cashews', price_delta=30.00)
                    Modifier.objects.create(group=mg, name='Extra Chocolate Sauce', price_delta=20.00)

        # 5. Suppliers
        if not Supplier.objects.filter(name='Main Warehouse').exists():
            Supplier.objects.create(
                name='Main Warehouse',
                contact_person='Logistics Team',
                phone='079-123456',
                email='supply@atul.com'
            )
            self.stdout.write("✅ Created Supplier: Main Warehouse")

        self.stdout.write("✨ Seeding Complete!")
