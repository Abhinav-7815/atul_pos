from rest_framework import serializers
from .models import Category, Product, ProductVariant, ModifierGroup, Modifier

class ModifierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modifier
        fields = ['id', 'name', 'price_delta', 'is_default']

class ModifierGroupSerializer(serializers.ModelSerializer):
    modifiers = ModifierSerializer(many=True, read_only=True)
    
    class Meta:
        model = ModifierGroup
        fields = ['id', 'name', 'min_select', 'max_select', 'is_required', 'modifiers']

class ProductVariantSerializer(serializers.ModelSerializer):
    is_available = serializers.SerializerMethodField()
    price_delta = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ['id', 'name', 'price_delta', 'is_default', 'is_available']

    def get_is_available(self, obj):
        outlet = self.context.get('outlet')
        if not outlet: return True
        status = obj.outlet_statuses.filter(outlet=outlet).first()
        return status.is_available if status else True

    def get_price_delta(self, obj):
        outlet = self.context.get('outlet')
        if not outlet: return obj.price_delta
        status = obj.outlet_statuses.filter(outlet=outlet).first()
        return status.price_override if (status and status.price_override is not None) else obj.price_delta

class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    modifier_groups = ModifierGroupSerializer(many=True, read_only=True)
    category_name = serializers.ReadOnlyField(source='category.name')
    is_available = serializers.SerializerMethodField()
    base_price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'category', 'category_name', 'outlet', 'name', 'description', 
            'base_price', 'tax_rate', 'hsn_code', 'is_veg', 'is_available', 
            'image_url', 'display_order', 'prep_time_minutes', 'allergen_tags', 
            'is_packaged_good', 'variants', 'modifier_groups'
        ]
        read_only_fields = ['id']

    def get_is_available(self, obj):
        outlet = self.context.get('outlet')
        if not outlet: return obj.is_available
        status = obj.outlet_statuses.filter(outlet=outlet).first()
        return status.is_available if status else obj.is_available

    def get_base_price(self, obj):
        outlet = self.context.get('outlet')
        if not outlet: return obj.base_price
        status = obj.outlet_statuses.filter(outlet=outlet).first()
        return status.price_override if (status and status.price_override is not None) else obj.base_price

class CategorySerializer(serializers.ModelSerializer):
    products = ProductSerializer(many=True, read_only=True)
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'display_order', 'icon_emoji', 'color_hex', 'products']
