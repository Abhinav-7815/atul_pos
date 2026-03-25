import os
import django
import sys

# Add the project root to sys.path
sys.path.append('c:/Abhinav Projects/atul_pos')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.menu.models import Category, Product, ProductVariant

def seed():
    print("Seeding original menu items...")
    
    # Create Category
    cat, _ = Category.objects.get_or_create(
        name="Loose Ice Cream",
        defaults={'icon_emoji': '🍦', 'color_hex': '#D63384'}
    )

    items = [
        {
            "name": "Vanilla",
            "prices": {"Cup (100ml)": 40, "250gm": 90, "500gm": 180, "1kg": 350}
        },
        {
            "name": "Natural Pineapple Pis",
            "prices": {"Cup (100ml)": 45, "250gm": 100, "500gm": 200, "1kg": 400}
        },
        {
            "name": "Butter Scotch",
            "prices": {"Cup (100ml)": 45, "250gm": 100, "500gm": 200, "1kg": 400}
        },
        {
            "name": "Jelly Nuts",
            "prices": {"Cup (100ml)": 45, "250gm": 100, "500gm": 200, "1kg": 400}
        },
        {
            "name": "Khajur Kaju",
            "prices": {"Cup (100ml)": 50, "250gm": 110, "500gm": 220, "1kg": 440}
        },
        {
            "name": "Natural Strawberry",
            "prices": {"Cup (100ml)": 50, "250gm": 110, "500gm": 220, "1kg": 440}
        },
        {
            "name": "Kaju Draksh",
            "prices": {"Cup (100ml)": 50, "250gm": 120, "500gm": 240, "1kg": 480}
        },
        {
            "name": "Badam Pista",
            "prices": {"Cup (100ml)": 50, "250gm": 120, "500gm": 240, "1kg": 480}
        },
        {
            "name": "Rose Petals",
            "prices": {"Cup (100ml)": 50, "250gm": 120, "500gm": 240, "1kg": 480}
        },
        {
            "name": "Kesar Pista",
            "prices": {"Cup (100ml)": 50, "250gm": 120, "500gm": 240, "1kg": 480}
        },
        {
            "name": "Anjir Kaju",
            "prices": {"Cup (100ml)": 50, "250gm": 120, "500gm": 240, "1kg": 480}
        },
        {
            "name": "Fruity Magic",
            "prices": {"Cup (100ml)": 50, "250gm": 120, "500gm": 240, "1kg": 480}
        },
        {
            "name": "Choco Cake",
            "prices": {"Cup (100ml)": 50, "250gm": 120, "500gm": 240, "1kg": 480}
        },
        {
            "name": "Cookie Bite",
            "prices": {"Cup (100ml)": 50, "250gm": 120, "500gm": 240, "1kg": 480}
        }
    ]

    for item_data in items:
        # We'll set base_price to 0 and use variants for ALL prices to be consistent
        # Or set base_price to the Cup price and delta for others.
        # But Cup is 100ml, 250gm is 2.5x. Delta would be 50 if it was ₹90 total.
        
        base_price = 0
        product, created = Product.objects.get_or_create(
            name=item_data["name"],
            category=cat,
            defaults={'base_price': base_price, 'tax_rate': 5.0}
        )
        if created:
            print(f"Created product: {product.name}")
        else:
            # Clear existing variants if updating
            product.variants.all().delete()

        for v_name, v_price in item_data["prices"].items():
            ProductVariant.objects.create(
                product=product,
                name=v_name,
                price_delta=v_price, # Using as absolute price since base is 0
                is_default=(v_name == "Cup (100ml)")
            )
    
    print("Successfully seeded menu.")

if __name__ == "__main__":
    seed()
