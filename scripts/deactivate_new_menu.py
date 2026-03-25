import os
import django
import sys

sys.path.append('c:/Abhinav Projects/atul_pos')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.menu.models import Category, Product

def cleanup_new_menu():
    print("Removing new menu items...")
    # Select category we just added
    try:
        cat = Category.objects.get(name="Loose Ice Cream")
        # Find products without orders
        prods = Product.objects.filter(category=cat)
        for p in prods:
             p.is_active = False # Safer than delete if they have orders
             p.save()
        cat.is_active = False
        cat.save()
        print("Success: Marked 'Loose Ice Cream' as inactive.")
    except Category.DoesNotExist:
        print("Category not found.")

if __name__ == "__main__":
    cleanup_new_menu()
