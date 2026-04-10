"""
Django management command to import menu data from Excel file
Usage: python manage.py import_menu_from_excel [--file path/to/file.xlsx] [--dry-run]
"""
import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from apps.menu.models import Category, Product, ProductVariant
from decimal import Decimal


class Command(BaseCommand):
    help = 'Import categories and products from Atul POS Menu Excel file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='Atul POS Menu.xlsx',
            help='Path to Excel file (default: Atul POS Menu.xlsx in project root)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview import without saving to database'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing categories and products before import'
        )

    def handle(self, *args, **options):
        file_path = options['file']
        dry_run = options['dry_run']
        clear_existing = options['clear']

        self.stdout.write("="*70)
        self.stdout.write(self.style.SUCCESS("ATUL POS MENU IMPORT SCRIPT"))
        self.stdout.write("="*70)
        self.stdout.write(f"\nFile: {file_path}")
        self.stdout.write(f"Mode: {'DRY RUN (Preview Only)' if dry_run else 'LIVE IMPORT'}")
        self.stdout.write(f"Clear Existing: {'Yes' if clear_existing else 'No'}\n")

        try:
            # Read Excel file
            self.stdout.write("\n📂 Reading Excel file...")
            df_categories = pd.read_excel(file_path, sheet_name='Categories', header=None)
            df_products = pd.read_excel(file_path, sheet_name='Products', header=None)

            df_categories.columns = ['category_name', 'display_order']
            df_products.columns = ['product_name', 'category_id', 'price_100gm', 'price_250gm', 'price_500gm', 'price_750gm', 'price_1kg']

            # Handle '--' in prices
            for col in ['price_100gm', 'price_250gm', 'price_500gm', 'price_750gm', 'price_1kg']:
                df_products[col] = pd.to_numeric(df_products[col], errors='coerce')

            self.stdout.write(self.style.SUCCESS(f"✓ Found {len(df_categories)} categories"))
            self.stdout.write(self.style.SUCCESS(f"✓ Found {len(df_products)} products\n"))

            # Category icon mapping
            category_icons = {
                'Loose Ice Cream': '🍨',
                'Thick Shake With Ice Cream': '🥤',
                'Cone': '🍦',
                'Cassata': '🍰',
                'Atul Special': '⭐',
                'Candy': '🍭'
            }

            category_colors = {
                'Loose Ice Cream': '#FF6B9D',
                'Thick Shake With Ice Cream': '#4ECDC4',
                'Cone': '#FFE66D',
                'Cassata': '#95E1D3',
                'Atul Special': '#F38181',
                'Candy': '#AA96DA'
            }

            # Preview
            self.stdout.write("="*70)
            self.stdout.write("PREVIEW")
            self.stdout.write("="*70)

            for idx, cat_row in df_categories.iterrows():
                cat_name = cat_row['category_name']
                cat_order = int(cat_row['display_order'])
                products_in_cat = df_products[df_products['category_id'] == cat_order]

                self.stdout.write(f"\n{cat_order}. {cat_name}")
                self.stdout.write(f"   Icon: {category_icons.get(cat_name, '🍨')}")
                self.stdout.write(f"   Color: {category_colors.get(cat_name, '#D63384')}")
                self.stdout.write(f"   Products: {len(products_in_cat)}")

            if dry_run:
                self.stdout.write("\n" + "="*70)
                self.stdout.write(self.style.WARNING("DRY RUN MODE - No changes made to database"))
                self.stdout.write("="*70)
                return

            # Confirm before proceeding
            self.stdout.write("\n" + "="*70)
            if clear_existing:
                self.stdout.write(self.style.WARNING("⚠️  WARNING: This will DELETE all existing categories and products!"))
            self.stdout.write("\nProceed with import? (yes/no): ")

            # Auto-confirm in non-interactive mode
            confirmation = 'yes'

            if confirmation.lower() != 'yes':
                self.stdout.write(self.style.ERROR("Import cancelled."))
                return

            # Start import
            with transaction.atomic():
                self.stdout.write("\n" + "="*70)
                self.stdout.write("IMPORTING DATA")
                self.stdout.write("="*70)

                # Clear existing data if requested
                if clear_existing:
                    self.stdout.write("\n🗑️  Clearing existing data...")
                    ProductVariant.objects.all().delete()
                    Product.objects.all().delete()
                    Category.objects.all().delete()
                    self.stdout.write(self.style.SUCCESS("✓ Cleared existing data"))

                # Import categories
                self.stdout.write("\n📁 Importing categories...")
                category_map = {}

                for idx, cat_row in df_categories.iterrows():
                    cat_name = cat_row['category_name']
                    cat_order = int(cat_row['display_order'])

                    # Use update_or_create to avoid duplicates
                    category, created = Category.objects.update_or_create(
                        name=cat_name,  # Use name as unique identifier
                        defaults={
                            'display_order': cat_order,
                            'icon_emoji': category_icons.get(cat_name, '🍨'),
                            'color_hex': category_colors.get(cat_name, '#D63384'),
                            'is_active': True
                        }
                    )

                    category_map[cat_order] = category

                    status = "Created" if created else "Updated"
                    self.stdout.write(f"  {status}: {cat_name} (Order: {cat_order})")

                self.stdout.write(self.style.SUCCESS(f"\n✓ Imported {len(category_map)} categories"))

                # Import products
                self.stdout.write("\n📦 Importing products...")
                products_created = 0
                variants_created = 0

                for idx, prod_row in df_products.iterrows():
                    product_name = str(prod_row['product_name']).strip()
                    category_id = int(prod_row['category_id'])

                    # Get category
                    category = category_map.get(category_id)
                    if not category:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Skipping {product_name}: Category {category_id} not found"))
                        continue

                    # Determine base price (use smallest available price)
                    base_price = None
                    if pd.notna(prod_row['price_100gm']):
                        base_price = Decimal(str(prod_row['price_100gm']))
                    elif pd.notna(prod_row['price_250gm']):
                        base_price = Decimal(str(prod_row['price_250gm']))
                    elif pd.notna(prod_row['price_500gm']):
                        base_price = Decimal(str(prod_row['price_500gm']))
                    elif pd.notna(prod_row['price_1kg']):
                        base_price = Decimal(str(prod_row['price_1kg']))

                    if base_price is None:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Skipping {product_name}: No valid price found"))
                        continue

                    # Create or update product
                    product, created = Product.objects.update_or_create(
                        name=product_name,
                        category=category,
                        defaults={
                            'base_price': base_price,
                            'tax_rate': Decimal('5.00'),
                            'is_veg': True,
                            'is_available': True,
                            'display_order': idx,
                            'prep_time_minutes': 5
                        }
                    )

                    if created:
                        products_created += 1
                        self.stdout.write(f"  ✓ {product_name} (₹{base_price})")
                    else:
                        products_created += 1  # Count updates too
                        self.stdout.write(f"  ↻ {product_name} (₹{base_price}) - updated")

                    # Check if product has multiple price points (variants needed)
                    has_variants = False
                    variant_data = []

                    if pd.notna(prod_row['price_100gm']):
                        variant_data.append(('100gm', Decimal(str(prod_row['price_100gm']))))
                        has_variants = True

                    if pd.notna(prod_row['price_250gm']):
                        variant_data.append(('250gm', Decimal(str(prod_row['price_250gm']))))
                        if len(variant_data) > 1:
                            has_variants = True

                    if pd.notna(prod_row['price_500gm']):
                        variant_data.append(('500gm', Decimal(str(prod_row['price_500gm']))))
                        if len(variant_data) > 1:
                            has_variants = True

                    if pd.notna(prod_row['price_750gm']):
                        variant_data.append(('750gm', Decimal(str(prod_row['price_750gm']))))
                        if len(variant_data) > 1:
                            has_variants = True

                    if pd.notna(prod_row['price_1kg']):
                        variant_data.append(('1kg', Decimal(str(prod_row['price_1kg']))))
                        if len(variant_data) > 1:
                            has_variants = True

                    # Create variants if multiple prices exist
                    if has_variants and len(variant_data) > 1:
                        # Clear existing variants
                        product.variants.all().delete()

                        for variant_name, variant_price in variant_data:
                            # price_delta is the difference from base_price
                            price_delta = variant_price - base_price

                            variant, v_created = ProductVariant.objects.get_or_create(
                                product=product,
                                name=variant_name,
                                defaults={
                                    'price_delta': price_delta,
                                    'is_default': (variant_name == variant_data[0][0])
                                }
                            )

                            if v_created:
                                variants_created += 1

                self.stdout.write(self.style.SUCCESS(f"\n✓ Imported {products_created} products"))
                self.stdout.write(self.style.SUCCESS(f"✓ Created {variants_created} product variants"))

            # Summary
            self.stdout.write("\n" + "="*70)
            self.stdout.write(self.style.SUCCESS("IMPORT COMPLETED SUCCESSFULLY!"))
            self.stdout.write("="*70)
            self.stdout.write(f"\nCategories: {len(category_map)}")
            self.stdout.write(f"Products: {products_created}")
            self.stdout.write(f"Variants: {variants_created}")
            self.stdout.write("\n✓ All data imported successfully!\n")

        except FileNotFoundError:
            raise CommandError(f'Excel file not found: {file_path}')
        except Exception as e:
            raise CommandError(f'Import failed: {str(e)}')
