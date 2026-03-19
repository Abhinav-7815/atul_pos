from rest_framework import serializers
from .models import StockItem, InventoryTransaction, Supplier, PurchaseOrder, PurchaseOrderItem

class StockItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    variant_name = serializers.ReadOnlyField(source='variant.name')
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = StockItem
        fields = ['id', 'product', 'product_name', 'variant', 'variant_name', 'outlet', 'quantity', 'min_threshold', 'status']

    def get_status(self, obj):
        if obj.quantity <= 0:
            return 'OUT_OF_STOCK'
        if obj.quantity <= obj.min_threshold:
            return 'LOW_STOCK'
        return 'NORMAL'

class InventoryTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryTransaction
        fields = '__all__'

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    variant_name = serializers.ReadOnlyField(source='variant.name')

    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'

class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    supplier_name = serializers.ReadOnlyField(source='supplier.name')

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
