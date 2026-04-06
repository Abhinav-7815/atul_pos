"""
Django management command to generate AI images for all products
Usage: python manage.py generate_product_images [--provider together] [--category "Loose Ice Cream"]
"""
from django.core.management.base import BaseCommand
from apps.menu.models import Category, Product
from apps.menu.ai_image_service import AIImageGenerator
import time


class Command(BaseCommand):
    help = 'Generate AI images for ice cream products using FLUX/Stable Diffusion/Gemini Imagen'

    def add_arguments(self, parser):
        parser.add_argument(
            '--provider',
            type=str,
            default='huggingface',
            choices=['huggingface', 'together', 'openrouter', 'gemini'],
            help='AI provider to use (default: huggingface - FREE)'
        )
        parser.add_argument(
            '--category',
            type=str,
            default=None,
            help='Generate images only for specific category'
        )
        parser.add_argument(
            '--product',
            type=str,
            default=None,
            help='Generate image for specific product name'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limit number of images to generate'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview without generating images'
        )
        parser.add_argument(
            '--delay',
            type=int,
            default=2,
            help='Delay between requests in seconds (default: 2)'
        )
        parser.add_argument(
            '--use-ai-prompts',
            action='store_true',
            default=True,
            help='Use AI to generate optimized prompts (default: True)'
        )
        parser.add_argument(
            '--no-ai-prompts',
            action='store_true',
            help='Disable AI prompt generation, use templates only'
        )

    def handle(self, *args, **options):
        provider = options['provider']
        category_filter = options['category']
        product_filter = options['product']
        limit = options['limit']
        dry_run = options['dry_run']
        delay = options['delay']
        use_ai_prompts = not options.get('no_ai_prompts', False)

        self.stdout.write("="*70)
        self.stdout.write(self.style.SUCCESS("AI PRODUCT IMAGE GENERATOR"))
        self.stdout.write("="*70)
        self.stdout.write(f"\nProvider: {provider.upper()}")
        self.stdout.write(f"Mode: {'DRY RUN (Preview)' if dry_run else 'GENERATE IMAGES'}")
        self.stdout.write(f"AI Prompts: {'Enabled (using text model)' if use_ai_prompts else 'Disabled (using templates)'}")

        # Initialize generator
        generator = AIImageGenerator(provider=provider, use_ai_prompts=use_ai_prompts)

        # Get products to process
        products = Product.objects.filter(is_active=True)

        if category_filter:
            products = products.filter(category__name__icontains=category_filter)
            self.stdout.write(f"Category Filter: {category_filter}")

        if product_filter:
            products = products.filter(name__icontains=product_filter)
            self.stdout.write(f"Product Filter: {product_filter}")

        if limit:
            products = products[:limit]
            self.stdout.write(f"Limit: {limit} products")

        total_products = products.count()
        self.stdout.write(f"\nTotal Products: {total_products}\n")

        if total_products == 0:
            self.stdout.write(self.style.WARNING("No products found!"))
            return

        # Category type mapping
        category_type_map = {
            'Loose Ice Cream': 'ice cream',
            'Thick Shake With Ice Cream': 'shake',
            'Cone': 'cone',
            'Cassata': 'cassata',
            'Candy': 'candy',
            'Atul Special': 'ice cream'
        }

        # Preview
        self.stdout.write("="*70)
        self.stdout.write("PRODUCTS TO PROCESS")
        self.stdout.write("="*70 + "\n")

        for idx, product in enumerate(products, 1):
            category_type = category_type_map.get(product.category.name, 'ice cream')
            self.stdout.write(f"{idx}. {product.name}")
            self.stdout.write(f"   Category: {product.category.name} ({category_type})")
            self.stdout.write(f"   Current Image: {product.image_url or 'None'}\n")

        if dry_run:
            self.stdout.write("\n" + "="*70)
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No images generated"))
            self.stdout.write("="*70)
            return

        # Confirm
        self.stdout.write("\n" + "="*70)
        self.stdout.write(f"This will generate {total_products} AI images.")
        self.stdout.write(f"Estimated time: ~{total_products * (delay + 3)} seconds")

        # Generate images
        self.stdout.write("\n" + "="*70)
        self.stdout.write("GENERATING IMAGES")
        self.stdout.write("="*70 + "\n")

        success_count = 0
        error_count = 0
        total_cost = 0

        for idx, product in enumerate(products, 1):
            category_type = category_type_map.get(product.category.name, 'ice cream')

            self.stdout.write(f"\n[{idx}/{total_products}] Generating: {product.name}")

            try:
                # Track time
                start_time = time.time()

                # Generate image
                result = generator.generate_ice_cream_image(
                    product_name=product.name,
                    category=category_type,
                    size='1024x1024'
                )

                generation_time = time.time() - start_time

                if result and result.get('success'):
                    # Save image
                    safe_filename = product.name.lower().replace(' ', '_').replace('(', '').replace(')', '')
                    file_path = generator.save_image_to_file(result, safe_filename)

                    if file_path:
                        # Update product
                        from django.conf import settings
                        product.image_url = f"{settings.MEDIA_URL}{file_path}"
                        product.save()

                        # Add file_path to result for cost tracking
                        result['file_path'] = file_path

                        # Track cost
                        cost_record = generator.track_generation_cost(
                            product_id=str(product.id),
                            image_data=result,
                            generation_time=generation_time
                        )

                        if cost_record:
                            total_cost += float(cost_record.total_cost)
                            self.stdout.write(self.style.SUCCESS(
                                f"  ✓ Saved to: {file_path} (Cost: ₹{cost_record.total_cost}, Time: {generation_time:.2f}s)"
                            ))
                        else:
                            self.stdout.write(self.style.SUCCESS(f"  ✓ Saved to: {file_path}"))

                        success_count += 1
                    else:
                        self.stdout.write(self.style.ERROR(f"  ✗ Failed to save image"))
                        error_count += 1

                        # Track failed generation
                        generator.track_generation_cost(
                            product_id=str(product.id),
                            image_data={'success': False, 'error': 'Failed to save'},
                            generation_time=generation_time
                        )
                else:
                    error_msg = result.get('error', 'Unknown error') if result else 'No response'
                    self.stdout.write(self.style.ERROR(f"  ✗ Generation failed: {error_msg}"))
                    error_count += 1

                    # Track failed generation
                    generator.track_generation_cost(
                        product_id=str(product.id),
                        image_data=result or {'success': False, 'error': error_msg},
                        generation_time=generation_time
                    )

                # Delay between requests
                if idx < total_products:
                    time.sleep(delay)

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  ✗ Exception: {str(e)}"))
                error_count += 1

        # Summary
        self.stdout.write("\n" + "="*70)
        self.stdout.write(self.style.SUCCESS("GENERATION COMPLETE"))
        self.stdout.write("="*70)
        self.stdout.write(f"\nSuccessful: {success_count}")
        self.stdout.write(f"Failed: {error_count}")
        self.stdout.write(f"Total: {total_products}")
        self.stdout.write(f"\n💰 Total Cost: ₹{total_cost:.2f}")
        self.stdout.write(f"   Average Cost: ₹{(total_cost/success_count):.2f} per image" if success_count > 0 else "")
        self.stdout.write("\n")

        if success_count > 0:
            self.stdout.write(self.style.SUCCESS(f"\n✓ {success_count} product images generated successfully!"))
            self.stdout.write(self.style.WARNING(f"\n💰 Total spent: ₹{total_cost:.2f}"))
