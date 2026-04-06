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
    # Read-only field for outlet-specific price (overrides)
    current_price = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ['id', 'name', 'price_delta', 'is_default', 'is_available', 'current_price']

    def get_is_available(self, obj):
        outlet = self.context.get('outlet')
        if not outlet: return True
        status = obj.outlet_statuses.filter(outlet=outlet).first()
        return status.is_available if status else True

    def get_current_price(self, obj):
        outlet = self.context.get('outlet')
        if not outlet: return obj.price_delta
        status = obj.outlet_statuses.filter(outlet=outlet).first()
        return status.price_override if (status and status.price_override is not None) else obj.price_delta

class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, required=False)
    modifier_groups = ModifierGroupSerializer(many=True, read_only=True)
    category_name = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()
    display_price = serializers.SerializerMethodField()

    def get_category_name(self, obj):
        """Return category name or 'Uncategorized' if category is null"""
        return obj.category.name if obj.category else 'Uncategorized'

    class Meta:
        model = Product
        fields = [
            'id', 'category', 'category_name', 'outlet', 'name', 'description', 
            'base_price', 'display_price', 'tax_rate', 'hsn_code', 'is_veg', 'is_available', 
            'image_url', 'display_order', 'prep_time_minutes', 'allergen_tags', 
            'is_packaged_good', 'variants', 'modifier_groups'
        ]
        read_only_fields = ['id']

    def get_is_available(self, obj):
        outlet = self.context.get('outlet')
        if not outlet: return obj.is_available
        status = obj.outlet_statuses.filter(outlet=outlet).first()
        return status.is_available if status else obj.is_available

    def get_display_price(self, obj):
        outlet = self.context.get('outlet')
        if not outlet: return obj.base_price
        status = obj.outlet_statuses.filter(outlet=outlet).first()
        return status.price_override if (status and status.price_override is not None) else obj.base_price

    def create(self, validated_data):
        variants_data = validated_data.pop('variants', [])
        product = Product.objects.create(**validated_data)
        for variant_data in variants_data:
            ProductVariant.objects.create(product=product, **variant_data)
        return product

    def update(self, instance, validated_data):
        variants_data = validated_data.pop('variants', None)
        
        # Update product instance
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if variants_data is not None:
            # Simple approach: delete existing and recreates
            # or match by ID. Keeping it simple for now.
            instance.variants.all().delete()
            for variant_data in variants_data:
                ProductVariant.objects.create(product=instance, **variant_data)
        
        return instance

class CategorySerializer(serializers.ModelSerializer):
    products = ProductSerializer(many=True, read_only=True)
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'display_order', 'icon_emoji', 'color_hex', 'products']
