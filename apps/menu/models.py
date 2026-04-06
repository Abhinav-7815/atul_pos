from django.db import models
from apps.core.models import BaseModel
from apps.outlets.models import Outlet

class Category(BaseModel):
    name = models.CharField(max_length=100)
    display_order = models.PositiveIntegerField(default=0)
    icon_emoji = models.CharField(max_length=50, blank=True, null=True)
    color_hex = models.CharField(max_length=7, default='#D63384')

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['display_order']

    def __str__(self):
        return self.name

class Product(BaseModel):
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
        help_text="Products without a category will appear as 'Uncategorized'"
    )
    outlet = models.ForeignKey(
        Outlet, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        help_text="Null means available at all outlets"
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)
    hsn_code = models.CharField(max_length=20, blank=True, null=True)
    is_veg = models.BooleanField(default=True)
    is_available = models.BooleanField(default=True)
    image_url = models.URLField(blank=True, null=True)
    display_order = models.PositiveIntegerField(default=0)
    prep_time_minutes = models.PositiveIntegerField(default=5)
    allergen_tags = models.TextField(default='[]') # Changed from JSONField for SQLite compatibility
    is_packaged_good = models.BooleanField(default=False)

    class Meta:
        ordering = ['display_order']

    def __str__(self):
        return self.name

class ProductVariant(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    name = models.CharField(max_length=100)
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.product.name} - {self.name}"

class ModifierGroup(BaseModel):
    product = models.ManyToManyField(Product, related_name="modifier_groups")
    name = models.CharField(max_length=100)
    min_select = models.PositiveIntegerField(default=0)
    max_select = models.PositiveIntegerField(default=1)
    is_required = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class Modifier(BaseModel):
    group = models.ForeignKey(ModifierGroup, on_delete=models.CASCADE, related_name="modifiers")
    name = models.CharField(max_length=100)
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.group.name}: {self.name}"

class OutletProductStatus(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="outlet_statuses")
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE)
    is_available = models.BooleanField(default=True)
    price_override = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = ('product', 'outlet')

class OutletVariantStatus(BaseModel):
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="outlet_statuses")
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE)
    is_available = models.BooleanField(default=True)
    price_override = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = ('variant', 'outlet')


# Import AI cost tracking models
from apps.menu.models_ai_cost import AIImageGenerationCost, AIImageGenerationBudget
