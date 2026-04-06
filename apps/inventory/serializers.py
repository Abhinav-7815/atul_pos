from rest_framework import serializers
from .models import StockItem, InventoryTransaction, Supplier, PurchaseOrder, PurchaseOrderItem

class StockItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = StockItem
        fields = [
            'id', 'product', 'product_name',
            'category_name',
            'variant', 'outlet', 'quantity', 'min_threshold', 'status'
        ]

    def get_product_name(self, obj):
        try:
            return obj.product.name
        except Exception:
            return ''

    def get_category_name(self, obj):
        try:
            return obj.product.category.name
        except Exception:
            return ''

    def get_status(self, obj):
        if obj.quantity <= 0:
            return 'OUT_OF_STOCK'
        if obj.quantity <= obj.min_threshold:
            return 'LOW_STOCK'
        return 'NORMAL'


class InventoryTransactionSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='stock_item.product.name')
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = [
            'id', 'stock_item', 'product_name', 'transaction_type',
            'transaction_type_display', 'quantity', 'reference_id', 'notes', 'created_at'
        ]

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
