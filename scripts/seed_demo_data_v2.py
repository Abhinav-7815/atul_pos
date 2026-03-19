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
    print("Seeding Enhanced Demo Data v2...")
    
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
        {"name": "Sticks & Bars", "emoji": "🍫", "order": 8, "color": "#8D6E63"},
        {"name": "Cakes", "emoji": "🎂", "order": 9, "color": "#D81B60"},
        {"name": "Specials", "emoji": "⭐", "order": 10, "color": "#FFD700"},
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

    # 4. Create Products with realistic ice cream parlor pricing
    products_data = [
        # Scoops - priced per scoop, variants for single/double/family cup
        {"cat": "Scoops", "name": "Belgian Chocolate", "price": 60, "veg": True, "img": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=60"},
        {"cat": "Scoops", "name": "Mango Alphonso", "price": 70, "veg": True, "img": "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=400&q=60"},
        {"cat": "Scoops", "name": "Kesar Pista", "price": 80, "veg": True, "img": "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=400&q=60"},
        {"cat": "Scoops", "name": "Sitaphal", "price": 90, "veg": True, "img": "https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=400&q=60"},
        {"cat": "Scoops", "name": "Tender Coconut", "price": 60, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Butterscotch", "price": 50, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Vanilla Classic", "price": 40, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Strawberry", "price": 50, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Black Currant", "price": 55, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Rajbhog", "price": 75, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Chikoo", "price": 55, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Paan Flavour", "price": 65, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Jamun", "price": 60, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Rose Gulkand", "price": 70, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Coffee Walnut", "price": 65, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Anjeer Badam", "price": 85, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Litchi", "price": 60, "veg": True, "img": ""},
        {"cat": "Scoops", "name": "Roasted Almond", "price": 75, "veg": True, "img": ""},
        
        # Sundaes
        {"cat": "Sundaes", "name": "Death By Chocolate", "price": 220, "veg": True, "img": "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=400&q=60"},
        {"cat": "Sundaes", "name": "Fruit Overload", "price": 199, "veg": True, "img": "https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?auto=format&fit=crop&w=400&q=60"},
        {"cat": "Sundaes", "name": "Brownie Blast", "price": 249, "veg": True, "img": ""},
        {"cat": "Sundaes", "name": "Caramel Crunch", "price": 189, "veg": True, "img": ""},
        {"cat": "Sundaes", "name": "Hot Fudge", "price": 199, "veg": True, "img": ""},
        {"cat": "Sundaes", "name": "Banana Split", "price": 229, "veg": True, "img": ""},
        
        # Shakes
        {"cat": "Shakes", "name": "Oreo Blast", "price": 159, "veg": True, "img": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=60"},
        {"cat": "Shakes", "name": "Nutella Ferrero", "price": 189, "veg": True, "img": "https://images.unsplash.com/photo-1579954115545-a95591f28be0?auto=format&fit=crop&w=400&q=60"},
        {"cat": "Shakes", "name": "KitKat Shake", "price": 179, "veg": True, "img": ""},
        {"cat": "Shakes", "name": "Mango Thick Shake", "price": 149, "veg": True, "img": ""},
        {"cat": "Shakes", "name": "Cold Coffee Shake", "price": 139, "veg": True, "img": ""},
        {"cat": "Shakes", "name": "Strawberry Shake", "price": 139, "veg": True, "img": ""},
        
        # Waffles
        {"cat": "Waffles", "name": "Classic Maple", "price": 149, "veg": True, "img": "https://images.unsplash.com/photo-1562329265-95a6d7a83440?auto=format&fit=crop&w=400&q=60"},
        {"cat": "Waffles", "name": "Chocolate Loaded", "price": 179, "veg": True, "img": ""},
        {"cat": "Waffles", "name": "Red Velvet", "price": 189, "veg": True, "img": ""},
        {"cat": "Waffles", "name": "Nutella Banana", "price": 199, "veg": True, "img": ""},
        
        # Cones
        {"cat": "Cones", "name": "Chocolate Dip Cone", "price": 40, "veg": True, "img": ""},
        {"cat": "Cones", "name": "Vanilla Cone", "price": 30, "veg": True, "img": ""},
        {"cat": "Cones", "name": "Butterscotch Cone", "price": 35, "veg": True, "img": ""},
        {"cat": "Cones", "name": "Mango Cone", "price": 40, "veg": True, "img": ""},
        {"cat": "Cones", "name": "Strawberry Cone", "price": 35, "veg": True, "img": ""},
        
        # Family Packs - per kg pricing
        {"cat": "Family Packs", "name": "Vanilla 500ml", "price": 199, "veg": True, "img": "", "packaged": True},
        {"cat": "Family Packs", "name": "Vanilla 1L", "price": 349, "veg": True, "img": "", "packaged": True},
        {"cat": "Family Packs", "name": "Chocolate 500ml", "price": 229, "veg": True, "img": "", "packaged": True},
        {"cat": "Family Packs", "name": "Chocolate 1L", "price": 399, "veg": True, "img": "", "packaged": True},
        {"cat": "Family Packs", "name": "Mango 500ml", "price": 249, "veg": True, "img": "", "packaged": True},
        {"cat": "Family Packs", "name": "Mango 1L", "price": 449, "veg": True, "img": "", "packaged": True},
        {"cat": "Family Packs", "name": "Kesar Pista 500ml", "price": 279, "veg": True, "img": "", "packaged": True},
        {"cat": "Family Packs", "name": "Assorted 1L", "price": 399, "veg": True, "img": "", "packaged": True},

        # Kulfi
        {"cat": "Kulfi", "name": "Malai Kulfi", "price": 50, "veg": True, "img": ""},
        {"cat": "Kulfi", "name": "Kesar Kulfi", "price": 60, "veg": True, "img": ""},
        {"cat": "Kulfi", "name": "Mango Kulfi", "price": 55, "veg": True, "img": ""},
        {"cat": "Kulfi", "name": "Pista Kulfi", "price": 60, "veg": True, "img": ""},
        {"cat": "Kulfi", "name": "Gola Kulfi", "price": 40, "veg": True, "img": ""},
        {"cat": "Kulfi", "name": "Falooda Kulfi", "price": 80, "veg": True, "img": ""},
        
        # Sticks & Bars
        {"cat": "Sticks & Bars", "name": "Chocobar", "price": 30, "veg": True, "img": "", "packaged": True},
        {"cat": "Sticks & Bars", "name": "Orange Bar", "price": 20, "veg": True, "img": "", "packaged": True},
        {"cat": "Sticks & Bars", "name": "Mango Bar", "price": 25, "veg": True, "img": "", "packaged": True},
        {"cat": "Sticks & Bars", "name": "Cassata", "price": 35, "veg": True, "img": "", "packaged": True},
        {"cat": "Sticks & Bars", "name": "Dolly Ice", "price": 15, "veg": True, "img": "", "packaged": True},
        {"cat": "Sticks & Bars", "name": "Kulfi Bar", "price": 40, "veg": True, "img": "", "packaged": True},
        
        # Cakes
        {"cat": "Cakes", "name": "Chocolate Ice Cream Cake (500g)", "price": 499, "veg": True, "img": ""},
        {"cat": "Cakes", "name": "Chocolate Ice Cream Cake (1kg)", "price": 899, "veg": True, "img": ""},
        {"cat": "Cakes", "name": "Vanilla Ice Cream Cake (500g)", "price": 449, "veg": True, "img": ""},
        {"cat": "Cakes", "name": "Mango Ice Cream Cake (1kg)", "price": 999, "veg": True, "img": ""},

        # Specials
        {"cat": "Specials", "name": "Falooda", "price": 149, "veg": True, "img": ""},
        {"cat": "Specials", "name": "Biscuit Pudding", "price": 129, "veg": True, "img": ""},
        {"cat": "Specials", "name": "Gadbad", "price": 179, "veg": True, "img": ""},
        {"cat": "Specials", "name": "Hot Chocolate Fudge", "price": 169, "veg": True, "img": ""},
    ]

    for p_data in products_data:
        product, created = Product.objects.get_or_create(
            name=p_data["name"],
            defaults={
                "category": cat_map[p_data["cat"]],
                "base_price": p_data["price"],
                "is_veg": p_data["veg"],
                "image_url": p_data["img"] or "",
                "tax_rate": 5.00,
                "is_packaged_good": p_data.get("packaged", False)
            }
        )
        if created:
            print(f"  Created: {p_data['name']} (₹{p_data['price']})")

    print(f"\nTotal Products: {Product.objects.count()}")
    print(f"Total Categories: {Category.objects.count()}")
    print("Seeding Completed Successfully!")

if __name__ == "__main__":
    seed()
