import os
import django
import sys

sys.path.append('c:/Abhinav Projects/atul_pos')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.menu.models import Category, Product, ProductVariant, ModifierGroup, Modifier

def cleanup():
    print("Cleaning up menu data...")
    Modifier.objects.all().delete()
    ModifierGroup.objects.all().delete()
    ProductVariant.objects.all().delete()
    Product.objects.all().delete()
    Category.objects.all().delete()
    print("Cleanup complete.")

if __name__ == "__main__":
    cleanup()
    from seed_data import seed_data
    seed_data()
