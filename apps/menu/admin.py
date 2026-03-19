from django.contrib import admin
from .models import Category, Product, ProductVariant, ModifierGroup, Modifier

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'display_order', 'is_active', 'icon_emoji')
    list_filter = ('is_active',)

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'base_price', 'is_available', 'display_order')
    list_filter = ('category', 'is_available', 'is_veg', 'is_packaged_good')
    search_fields = ('name', 'description')

@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ('name', 'product', 'price_delta', 'is_default')
    list_filter = ('is_default',)

@admin.register(ModifierGroup)
class ModifierGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'min_select', 'max_select', 'is_required')
    list_filter = ('is_required',)

@admin.register(Modifier)
class ModifierAdmin(admin.ModelAdmin):
    list_display = ('name', 'group', 'price_delta', 'is_default')
    list_filter = ('group', 'is_default')
