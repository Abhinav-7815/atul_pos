import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.menu.models import Category, Product
from apps.outlets.models import Outlet
from django.contrib.auth import get_user_model

User = get_user_model()

def seed():
    print("Seeding Demo Data...")
    
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
        {"name": "Party Packs", "emoji": "📦", "order": 5, "color": "#E53935"},
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

    # 4. Create Products
    products_data = [
        # Scoops
        {"cat": "Scoops", "name": "Belgian Chocolate", "price": 120, "veg": True, "img": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80"},
        {"cat": "Scoops", "name": "Mango Alphonso", "price": 90, "veg": True, "img": "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=800&q=80"},
        {"cat": "Scoops", "name": "Kesar Pista", "price": 110, "veg": True, "img": "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=800&q=80"},
        {"cat": "Scoops", "name": "Real Sitaphal", "price": 130, "veg": True, "img": "https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=800&q=80"},
        
        # Sundaes
        {"cat": "Sundaes", "name": "Death By Chocolate", "price": 280, "veg": True, "img": "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80"},
        {"cat": "Sundaes", "name": "Fruit Overload", "price": 240, "veg": True, "img": "https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?auto=format&fit=crop&w=800&q=80"},
        
        # Shakes
        {"cat": "Shakes", "name": "Oreo Blast Shake", "price": 180, "veg": True, "img": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80"},
        {"cat": "Shakes", "name": "Nutella Ferrero", "price": 220, "veg": True, "img": "https://images.unsplash.com/photo-1579954115545-a95591f28be0?auto=format&fit=crop&w=800&q=80"},
        
        # Waffles
        {"cat": "Waffles", "name": "Classic Maple Waffle", "price": 160, "veg": True, "img": "https://images.unsplash.com/photo-1562329265-95a6d7a83440?auto=format&fit=crop&w=800&q=80"},
    ]

    for p_data in products_data:
        Product.objects.get_or_create(
            name=p_data["name"],
            defaults={
                "category": cat_map[p_data["cat"]],
                "base_price": p_data["price"],
                "is_veg": p_data["veg"],
                "image_url": p_data["img"],
                "tax_rate": 5.00
            }
        )

    print("Seeding Completed Successfully!")

if __name__ == "__main__":
    seed()
