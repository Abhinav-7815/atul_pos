import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.menu.models import Category, Product, ProductVariant
from apps.outlets.models import Outlet
from django.contrib.auth import get_user_model

User = get_user_model()

def seed():
    print("Seeding Enhanced Demo Data v3 (with Variants)...")
    
    # 1. Create/Get Outlet
    outlet, _ = Outlet.objects.get_or_create(
        name="Vastrapur Outlet",
        defaults={
            "address": "Ahmedabad, Gujarat",
            "phone": "9876543210",
            "gstin": "24AAAAA0000A1Z5"
        }
    )

    # 2. Update Admin User to link to Outlet
    admin = User.objects.filter(is_superuser=True).first()
    if admin:
        admin.outlet = outlet
        admin.save()
        print(f"Linked admin {admin.email} to {outlet.name}")

    # 3. Create Categories
    cats_data = [
        {"name": "Scoops", "emoji": "🍨", "order": 1, "color": "#D63384"},
        {"name": "Sundaes", "emoji": "🍧", "order": 2, "color": "#FF4D94"},
        {"name": "Shakes", "emoji": "🥤", "order": 3, "color": "#FF85B3"},
        {"name": "Waffles", "emoji": "🧇", "order": 4, "color": "#FB6DA0"},
        {"name": "Cones", "emoji": "🍦", "order": 5, "color": "#FF6B81"},
        {"name": "Family Packs", "emoji": "📦", "order": 6, "color": "#E53935"},
        {"name": "Kulfi", "emoji": "🧊", "order": 7, "color": "#FFA000"},
        {"name": "Cakes", "emoji": "🎂", "order": 8, "color": "#D81B60"},
    ]
    
    cat_map = {}
    for data in cats_data:
        cat, _ = Category.objects.get_or_create(
            name=data["name"],
            defaults={
                "display_order": data["order"],
                "icon_emoji": data["emoji"],
                "color_hex": data["color"]
            }
        )
        cat_map[data["name"]] = cat

    # 4. Create Products and Variants
    # Products with variants (Weight/Qty based)
    p_with_v = [
        {
            "cat": "Scoops", "name": "Belgian Chocolate", "base": 0, "veg": True,
            "variants": [
                {"name": "Single Scoop", "delta": 70},
                {"name": "Double Scoop", "delta": 130},
                {"name": "500g Tub", "delta": 350},
                {"name": "1kg Tub", "delta": 650}
            ]
        },
        {
            "cat": "Scoops", "name": "Mango Alphonso", "base": 0, "veg": True,
            "variants": [
                {"name": "Single Scoop", "delta": 60},
                {"name": "Double Scoop", "delta": 110},
                {"name": "500g Tub", "delta": 300},
                {"name": "1kg Tub", "delta": 550}
            ]
        },
        {
            "cat": "Scoops", "name": "Kesar Pista", "base": 0, "veg": True,
            "variants": [
                {"name": "Single Scoop", "delta": 80},
                {"name": "Double Scoop", "delta": 150},
                {"name": "500g Tub", "delta": 400},
            ]
        },
        {
            "cat": "Cakes", "name": "Chocolate Truffle Ice Cake", "base": 0, "veg": True,
            "variants": [
                {"name": "500g", "delta": 499},
                {"name": "1kg", "delta": 899}
            ]
        }
    ]

    for p_data in p_with_v:
        product, _ = Product.objects.get_or_create(
            name=p_data["name"],
            defaults={
                "category": cat_map[p_data["cat"]],
                "base_price": p_data["base"],
                "is_veg": p_data["veg"],
                "tax_rate": 5.00
            }
        )
        for v in p_data["variants"]:
            ProductVariant.objects.get_or_create(
                product=product,
                name=v["name"],
                defaults={"price_delta": v["delta"]}
            )
        print(f"  Created Product with Variants: {p_data['name']}")

    # Single Products
    s_products = [
        {"cat": "Sundaes", "name": "Death By Chocolate", "price": 220},
        {"cat": "Sundaes", "name": "Fruit Overload", "price": 199},
        {"cat": "Shakes", "name": "Oreo Blast Shake", "price": 159},
        {"cat": "Shakes", "name": "Nutella Ferrero", "price": 189},
        {"cat": "Waffles", "name": "Classic Maple Waffle", "price": 149},
        {"cat": "Waffles", "name": "Chocolate Loaded", "price": 179},
        {"cat": "Cones", "name": "Chocolate Dip Cone", "price": 40},
        {"cat": "Kulfi", "name": "Malai Kulfi", "price": 50},
        {"cat": "Kulfi", "name": "Falooda Kulfi", "price": 80},
    ]

    for p in s_products:
        Product.objects.get_or_create(
            name=p["name"],
            defaults={
                "category": cat_map[p["cat"]],
                "base_price": p["price"],
                "is_veg": True,
                "tax_rate": 5.00
            }
        )
        print(f"  Created Single Product: {p['name']}")

    print("\nSeeding Completed Successfully!")

if __name__ == "__main__":
    seed()
