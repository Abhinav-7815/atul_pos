"""
Django Admin for AI Image Generation Cost Tracking
"""
from django.contrib import admin
from apps.menu.models_ai_cost import AIImageGenerationCost, AIImageGenerationBudget


@admin.register(AIImageGenerationCost)
class AIImageGenerationCostAdmin(admin.ModelAdmin):
    list_display = (
        'created_at',
        'product',
        'provider',
        'model_name',
        'status',
        'total_cost',
        'generation_time_seconds',
    )
    list_filter = (
        'status',
        'provider',
        'created_at',
    )
    search_fields = (
        'product__name',
        'prompt',
    )
    readonly_fields = (
        'id',
        'created_at',
        'updated_at',
        'created_by',
        'updated_by',
    )
    fieldsets = (
        ('Product Info', {
            'fields': ('product', 'provider', 'model_name', 'status')
        }),
        ('Generation Details', {
            'fields': ('prompt', 'image_url', 'image_path', 'image_size', 'error_message')
        }),
        ('Cost & Performance', {
            'fields': ('cost_per_image', 'total_cost', 'generation_time_seconds')
        }),
        ('Metadata', {
            'fields': ('request_metadata', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        # Don't allow manual creation
        return False


@admin.register(AIImageGenerationBudget)
class AIImageGenerationBudgetAdmin(admin.ModelAdmin):
    list_display = (
        'year',
        'month',
        'monthly_budget',
        'total_spent',
        'total_images',
        'get_usage_percentage_display',
        'budget_exceeded',
    )
    list_filter = (
        'year',
        'budget_exceeded',
        'alert_sent',
    )
    readonly_fields = (
        'total_spent',
        'total_images',
        'alert_sent',
        'budget_exceeded',
        'get_usage_percentage_display',
        'get_remaining_budget_display',
    )
    fieldsets = (
        ('Period', {
            'fields': ('year', 'month')
        }),
        ('Budget Settings', {
            'fields': ('monthly_budget', 'alert_threshold')
        }),
        ('Usage Statistics', {
            'fields': (
                'total_spent',
                'total_images',
                'get_usage_percentage_display',
                'get_remaining_budget_display',
            )
        }),
        ('Alerts', {
            'fields': ('alert_sent', 'budget_exceeded')
        }),
    )

    def get_usage_percentage_display(self, obj):
        return f"{obj.get_usage_percentage():.1f}%"
    get_usage_percentage_display.short_description = 'Usage %'

    def get_remaining_budget_display(self, obj):
        return f"₹{obj.get_remaining_budget():.2f}"
    get_remaining_budget_display.short_description = 'Remaining'
