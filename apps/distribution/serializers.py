from rest_framework import serializers
from .models import DistributorOrder, DistributorOrderItem, StockDispatch


class DistributorOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    variant_name = serializers.ReadOnlyField(source='variant.name')

    class Meta:
        model  = DistributorOrderItem
        fields = [
            'id', 'product', 'product_name', 'variant', 'variant_name',
            'quantity', 'unit_price', 'subtotal',
        ]
        read_only_fields = ['id', 'subtotal']


class DistributorOrderItemWriteSerializer(serializers.Serializer):
    """Used only during order creation — accepts incoming product/qty/price."""
    product_id  = serializers.UUIDField()
    variant_id  = serializers.UUIDField(required=False, allow_null=True)
    quantity    = serializers.DecimalField(max_digits=10, decimal_places=2)
    unit_price  = serializers.DecimalField(max_digits=10, decimal_places=2)


class StockDispatchSerializer(serializers.ModelSerializer):
    order_number       = serializers.ReadOnlyField(source='distributor_order.order_number')
    distributor_name   = serializers.ReadOnlyField(source='distributor_order.distributor_outlet.name')
    dispatched_by_name = serializers.ReadOnlyField(source='dispatched_by.full_name')

    class Meta:
        model  = StockDispatch
        fields = [
            'id', 'dispatch_number', 'order_number', 'distributor_name',
            'dispatched_by_name', 'vehicle_number', 'driver_name',
            'notes', 'is_received', 'received_at', 'created_at',
        ]
        read_only_fields = ['id', 'dispatch_number', 'created_at']


class DistributorOrderSerializer(serializers.ModelSerializer):
    items                    = DistributorOrderItemSerializer(many=True, read_only=True)
    dispatches               = StockDispatchSerializer(many=True, read_only=True)
    distributor_outlet_name  = serializers.ReadOnlyField(source='distributor_outlet.name')
    distributor_outlet_city  = serializers.ReadOnlyField(source='distributor_outlet.city')
    fulfilled_by_outlet_name = serializers.ReadOnlyField(source='fulfilled_by_outlet.name')
    item_count               = serializers.SerializerMethodField()

    class Meta:
        model  = DistributorOrder
        fields = [
            'id', 'order_number', 'status',
            'distributor_outlet', 'distributor_outlet_name', 'distributor_outlet_city',
            'fulfilled_by_outlet', 'fulfilled_by_outlet_name',
            'subtotal', 'discount_amount', 'total_amount',
            'notes', 'expected_delivery_date',
            'submitted_at', 'approved_at', 'dispatched_at', 'delivered_at',
            'created_at', 'updated_at',
            'item_count', 'items', 'dispatches',
        ]
        read_only_fields = [
            'id', 'order_number', 'status',
            'distributor_outlet', 'fulfilled_by_outlet',
            'subtotal', 'discount_amount', 'total_amount',
            'submitted_at', 'approved_at', 'dispatched_at', 'delivered_at',
            'created_at', 'updated_at',
        ]

    def get_item_count(self, obj):
        return obj.items.count()


class DistributorOrderCreateSerializer(serializers.Serializer):
    """
    Accepts a list of items and optional metadata to create a new DistributorOrder.
    Business logic (price snapshot, totals, FK resolution) is handled in the view.
    """
    notes                  = serializers.CharField(required=False, allow_blank=True)
    expected_delivery_date = serializers.DateField(required=False, allow_null=True)
    items                  = DistributorOrderItemWriteSerializer(many=True, min_length=1)
