"""
Django management command to view AI image generation cost reports
Usage: python manage.py ai_cost_report [--month 3] [--year 2026]
"""
from django.core.management.base import BaseCommand
from apps.menu.models_ai_cost import AIImageGenerationCost, AIImageGenerationBudget
from datetime import datetime
from decimal import Decimal


class Command(BaseCommand):
    help = 'View AI image generation cost reports and analytics'

    def add_arguments(self, parser):
        parser.add_argument(
            '--month',
            type=int,
            default=None,
            help='Month (1-12) for specific month report'
        )
        parser.add_argument(
            '--year',
            type=int,
            default=None,
            help='Year for specific month/year report'
        )
        parser.add_argument(
            '--provider',
            type=str,
            choices=['together', 'huggingface', 'openrouter'],
            default=None,
            help='Filter by specific provider'
        )
        parser.add_argument(
            '--summary',
            action='store_true',
            help='Show summary only'
        )

    def handle(self, *args, **options):
        month = options['month']
        year = options['year']
        provider = options['provider']
        summary_only = options['summary']

        self.stdout.write("="*70)
        self.stdout.write(self.style.SUCCESS("AI IMAGE GENERATION - COST REPORT"))
        self.stdout.write("="*70)

        # Overall statistics
        stats = AIImageGenerationCost.get_statistics()

        self.stdout.write("\n📊 OVERALL STATISTICS")
        self.stdout.write("-"*70)
        self.stdout.write(f"Total Generations: {stats['total_generations'] or 0}")
        self.stdout.write(f"  ✓ Successful: {stats['successful_generations'] or 0}")
        self.stdout.write(f"  ✗ Failed: {stats['failed_generations'] or 0}")
        self.stdout.write(f"\n💰 Total Cost: ₹{stats['total_cost'] or 0:.2f}")
        self.stdout.write(f"   Average Cost: ₹{stats['avg_cost'] or 0:.2f} per image")
        if stats['avg_generation_time']:
            self.stdout.write(f"   Average Time: {stats['avg_generation_time']:.2f} seconds")

        # Cost by provider
        self.stdout.write("\n\n📈 COST BY PROVIDER")
        self.stdout.write("-"*70)
        provider_costs = AIImageGenerationCost.get_cost_by_provider()

        if provider_costs:
            self.stdout.write(f"{'Provider':<15} {'Images':>10} {'Total Cost':>15} {'Avg Cost':>12}")
            self.stdout.write("-"*70)
            for item in provider_costs:
                prov = item['provider'].upper()
                imgs = item['total_images']
                total = item['total_cost']
                avg = item['avg_cost']
                self.stdout.write(f"{prov:<15} {imgs:>10} ₹{total:>13.2f} ₹{avg:>10.2f}")
        else:
            self.stdout.write("No cost data available")

        # Current month budget
        self.stdout.write("\n\n💳 CURRENT MONTH BUDGET")
        self.stdout.write("-"*70)
        try:
            budget = AIImageGenerationBudget.get_or_create_current_month()
            usage_pct = budget.get_usage_percentage()
            remaining = budget.get_remaining_budget()

            self.stdout.write(f"Period: {budget.year}-{budget.month:02d}")
            self.stdout.write(f"Budget: ₹{budget.monthly_budget:.2f}")
            self.stdout.write(f"Spent: ₹{budget.total_spent:.2f} ({usage_pct:.1f}%)")
            self.stdout.write(f"Remaining: ₹{remaining:.2f}")
            self.stdout.write(f"Images: {budget.total_images}")

            # Warning if over threshold
            if budget.alert_sent:
                self.stdout.write(self.style.WARNING(f"\n⚠️  Alert: {usage_pct:.1f}% of budget used!"))
            if budget.budget_exceeded:
                self.stdout.write(self.style.ERROR("\n❌ Budget exceeded!"))

        except Exception as e:
            self.stdout.write(f"Could not load budget: {e}")

        # Specific month report
        if month and year:
            self.stdout.write(f"\n\n📅 MONTH REPORT: {year}-{month:02d}")
            self.stdout.write("-"*70)

            monthly_cost = AIImageGenerationCost.get_monthly_cost(year, month)
            monthly_count = AIImageGenerationCost.objects.filter(
                status='success',
                created_at__year=year,
                created_at__month=month
            ).count()

            self.stdout.write(f"Total Cost: ₹{monthly_cost:.2f}")
            self.stdout.write(f"Images Generated: {monthly_count}")
            if monthly_count > 0:
                self.stdout.write(f"Average: ₹{monthly_cost/monthly_count:.2f} per image")

        # Recent generations (if not summary only)
        if not summary_only:
            self.stdout.write("\n\n📋 RECENT GENERATIONS (Last 10)")
            self.stdout.write("-"*70)

            recent = AIImageGenerationCost.objects.filter(status='success').order_by('-created_at')[:10]

            if recent:
                self.stdout.write(f"{'Date':<12} {'Product':<25} {'Provider':<12} {'Cost':>8} {'Time':>6}")
                self.stdout.write("-"*70)

                for record in recent:
                    date = record.created_at.strftime('%Y-%m-%d')
                    product = (record.product.name[:24] if record.product else 'Unknown')
                    prov = record.provider
                    cost = record.total_cost
                    gen_time = f"{record.generation_time_seconds:.1f}s" if record.generation_time_seconds else "N/A"

                    self.stdout.write(f"{date:<12} {product:<25} {prov:<12} ₹{cost:>6.2f} {gen_time:>6}")
            else:
                self.stdout.write("No generation history")

        # Cost projections
        self.stdout.write("\n\n💡 COST PROJECTIONS")
        self.stdout.write("-"*70)

        # Project cost for all products
        from apps.menu.models import Product
        total_products = Product.objects.filter(is_active=True).count()
        products_with_images = Product.objects.filter(
            is_active=True,
            ai_image_costs__status='success'
        ).distinct().count()
        products_without_images = total_products - products_with_images

        cost_per_image = Decimal('1.15')
        projected_cost = products_without_images * cost_per_image

        self.stdout.write(f"Total Products: {total_products}")
        self.stdout.write(f"  With AI Images: {products_with_images}")
        self.stdout.write(f"  Without Images: {products_without_images}")
        self.stdout.write(f"\n💰 Projected Cost (remaining): ₹{projected_cost:.2f}")
        self.stdout.write(f"   (₹{cost_per_image:.2f} × {products_without_images} products)")

        # Tips
        self.stdout.write("\n\n💡 TIPS")
        self.stdout.write("-"*70)
        self.stdout.write("• Use Together AI for FREE images (3 months unlimited)")
        self.stdout.write("• Monitor budget: python manage.py ai_cost_report")
        self.stdout.write("• Set monthly budget in admin or database")
        self.stdout.write("• Cost per image: ₹1.15 (configurable)")

        self.stdout.write("\n" + "="*70 + "\n")
