"""
AI Image Generation Cost Tracking Models
Tracks costs for AI-generated product images
"""
from django.db import models
from apps.core.models import BaseModel
from apps.menu.models import Product
from decimal import Decimal


class AIImageGenerationCost(BaseModel):
    """Track costs for AI image generation"""

    # Provider choices
    PROVIDER_CHOICES = [
        ('together', 'Together AI'),
        ('huggingface', 'Hugging Face'),
        ('openrouter', 'OpenRouter'),
    ]

    # Status choices
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('retry', 'Retry'),
    ]

    # Product reference
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='ai_image_costs',
        null=True,
        blank=True,
        help_text='Product for which image was generated'
    )

    # Generation details
    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        default='together'
    )
    model_name = models.CharField(
        max_length=100,
        help_text='AI model used (e.g., FLUX.1-schnell)'
    )
    prompt = models.TextField(
        help_text='Prompt used for generation'
    )

    # Image details
    image_url = models.URLField(
        null=True,
        blank=True,
        help_text='URL of generated image'
    )
    image_path = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text='Local file path'
    )
    image_size = models.CharField(
        max_length=20,
        default='1024x1024',
        help_text='Image dimensions'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='success'
    )
    error_message = models.TextField(
        null=True,
        blank=True,
        help_text='Error details if generation failed'
    )

    # Costing (in INR - Indian Rupees)
    cost_per_image = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('1.15'),
        help_text='Cost per image in INR (₹1.15 default)'
    )
    total_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('1.15'),
        help_text='Total cost for this generation in INR'
    )

    # Performance metrics
    generation_time_seconds = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Time taken to generate image in seconds'
    )

    # Metadata
    request_metadata = models.TextField(
        default='{}',
        help_text='JSON metadata about the request'
    )

    class Meta:
        verbose_name = 'AI Image Generation Cost'
        verbose_name_plural = 'AI Image Generation Costs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['provider']),
            models.Index(fields=['status']),
            models.Index(fields=['product']),
        ]

    def __str__(self):
        product_name = self.product.name if self.product else 'Unknown'
        return f"{product_name} - {self.provider} - ₹{self.total_cost}"

    @classmethod
    def get_total_cost(cls, start_date=None, end_date=None, provider=None):
        """Get total cost for a period"""
        queryset = cls.objects.filter(status='success')

        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        if provider:
            queryset = queryset.filter(provider=provider)

        from django.db.models import Sum
        result = queryset.aggregate(total=Sum('total_cost'))
        return result['total'] or Decimal('0.00')

    @classmethod
    def get_statistics(cls):
        """Get overall statistics"""
        from django.db.models import Count, Sum, Avg

        stats = cls.objects.aggregate(
            total_generations=Count('id'),
            successful_generations=Count('id', filter=models.Q(status='success')),
            failed_generations=Count('id', filter=models.Q(status='failed')),
            total_cost=Sum('total_cost', filter=models.Q(status='success')),
            avg_cost=Avg('total_cost', filter=models.Q(status='success')),
            avg_generation_time=Avg('generation_time_seconds', filter=models.Q(status='success')),
        )

        return stats

    @classmethod
    def get_cost_by_provider(cls):
        """Get cost breakdown by provider"""
        from django.db.models import Sum, Count

        return cls.objects.filter(status='success').values('provider').annotate(
            total_cost=Sum('total_cost'),
            total_images=Count('id'),
            avg_cost=Avg('total_cost')
        ).order_by('-total_cost')

    @classmethod
    def get_monthly_cost(cls, year, month):
        """Get cost for a specific month"""
        from django.db.models import Sum

        result = cls.objects.filter(
            status='success',
            created_at__year=year,
            created_at__month=month
        ).aggregate(total=Sum('total_cost'))

        return result['total'] or Decimal('0.00')


class AIImageGenerationBudget(BaseModel):
    """Monthly budget limits for AI image generation"""

    year = models.IntegerField()
    month = models.IntegerField(
        help_text='Month (1-12)'
    )

    # Budget limits (in INR)
    monthly_budget = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Monthly budget limit in INR'
    )
    alert_threshold = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('80.00'),
        help_text='Alert when % of budget is reached (default: 80%)'
    )

    # Usage tracking
    total_spent = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Total spent this month in INR'
    )
    total_images = models.IntegerField(
        default=0,
        help_text='Total images generated this month'
    )

    # Alerts
    alert_sent = models.BooleanField(
        default=False,
        help_text='Whether alert email was sent'
    )
    budget_exceeded = models.BooleanField(
        default=False,
        help_text='Whether budget has been exceeded'
    )

    class Meta:
        verbose_name = 'AI Image Generation Budget'
        verbose_name_plural = 'AI Image Generation Budgets'
        unique_together = ('year', 'month')
        ordering = ['-year', '-month']

    def __str__(self):
        return f"{self.year}-{self.month:02d}: ₹{self.total_spent}/₹{self.monthly_budget}"

    def update_usage(self, cost):
        """Update usage after image generation"""
        self.total_spent += cost
        self.total_images += 1

        # Check thresholds
        usage_percent = (self.total_spent / self.monthly_budget * 100) if self.monthly_budget > 0 else 0

        if usage_percent >= self.alert_threshold and not self.alert_sent:
            self.alert_sent = True
            # TODO: Send alert email

        if self.total_spent >= self.monthly_budget:
            self.budget_exceeded = True

        self.save()

    def get_remaining_budget(self):
        """Get remaining budget"""
        return max(Decimal('0.00'), self.monthly_budget - self.total_spent)

    def get_usage_percentage(self):
        """Get usage percentage"""
        if self.monthly_budget <= 0:
            return Decimal('0.00')
        return (self.total_spent / self.monthly_budget * 100)

    @classmethod
    def get_or_create_current_month(cls):
        """Get or create budget for current month"""
        from datetime import datetime
        now = datetime.now()

        budget, created = cls.objects.get_or_create(
            year=now.year,
            month=now.month,
            defaults={
                'monthly_budget': Decimal('500.00'),  # Default ₹500/month
                'alert_threshold': Decimal('80.00'),
            }
        )

        return budget
