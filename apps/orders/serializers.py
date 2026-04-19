from rest_framework import serializers
from .models import Order, OrderItem, Payment
from apps.menu.models import Product, ProductVariant
from .utils.kds import broadcast_to_kds

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    hsn_code = serializers.ReadOnlyField(source='product.hsn_code')
    variant_name = serializers.ReadOnlyField(source='variant.name')
    modifiers = serializers.JSONField(required=False, default=list)
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name', 'hsn_code', 'variant', 'variant_name', 
            'quantity', 'unit_price', 'tax_rate', 'item_subtotal', 
            'item_tax', 'item_total', 'modifiers', 'notes', 'status'
        ]
        read_only_fields = ['unit_price', 'tax_rate', 'item_subtotal', 'item_tax', 'item_total']

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'order', 'method', 'amount', 'reference_number', 
            'status', 'tendered_amount', 'change_returned', 'created_at'
        ]
        read_only_fields = ['id', 'order', 'status', 'created_at']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    payments = PaymentSerializer(many=True, read_only=True)
    payment_mode = serializers.CharField(write_only=True, required=False)
    outlet_name = serializers.ReadOnlyField(source='outlet.name')
    cashier_name = serializers.ReadOnlyField(source='created_by.full_name')

    class Meta:
        model = Order
        fields = [
            'id', 'outlet', 'outlet_name', 'order_number', 'order_type', 
            'status', 'customer', 'customer_phone', 'table_number', 'token_number', 
            'subtotal', 'tax_amount', 'discount_amount', 'total_amount', 
            'notes', 'items', 'payments', 'cashier_name', 'created_at',
            'payment_mode'
        ]
        read_only_fields = ['outlet', 'order_number', 'subtotal', 'tax_amount', 'total_amount', 'token_number', 'created_at']
        extra_kwargs = {
            'customer_phone': {'write_only': True, 'required': False, 'allow_null': True}
        }

    customer_phone = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)

    def create(self, validated_data):
        import json
        from apps.menu.models import Modifier

        items_data = validated_data.pop('items')
        payment_mode = validated_data.pop('payment_mode', 'cash').lower()
        customer_phone = validated_data.pop('customer_phone', None)
        request = self.context.get('request')
        user = request.user if request and hasattr(request, 'user') and request.user and request.user.is_authenticated else None

        # Handle phone -> customer mapping
        if customer_phone:
            from apps.customers.models import Customer
            try:
                # Clean phone: only numbers
                clean_phone = ''.join(filter(str.isdigit, str(customer_phone)))
                if clean_phone:
                    customer, _ = Customer.objects.get_or_create(phone=clean_phone)
                    validated_data['customer'] = customer
            except Exception as e:
                print(f"Error mapping customer phone: {e}")

        # Auto-assign outlet if not provided
        if 'outlet' not in validated_data and user and hasattr(user, 'outlet') and user.outlet:
            validated_data['outlet'] = user.outlet
            
        order = Order.objects.create(**validated_data)
        
        for item_data in items_data:
            product = item_data['product']
            unit_price = product.base_price
            if item_data.get('variant'):
                unit_price += item_data['variant'].price_delta
            
            # Retrieve Modifiers and compute logic
            modifiers_data = item_data.pop('modifiers', [])
            mod_json = []
            for m_id in modifiers_data:
                try:
                    # Look up by UUID string/int
                    mod_obj = Modifier.objects.get(id=m_id)
                    mod_json.append({
                        "id": str(mod_obj.id),
                        "name": mod_obj.name,
                        "price_delta": float(mod_obj.price_delta)
                    })
                except Exception:
                    pass
            item_data['modifiers'] = json.dumps(mod_json)
                
            OrderItem.objects.create(
                order=order,
                unit_price=unit_price,
                tax_rate=product.tax_rate,
                **item_data
            )
        
        order.calculate_totals()
        
        # Create payment if payment_mode provided
        Payment.objects.create(
            order=order,
            method=payment_mode,
            amount=order.total_amount,
            status='completed'
        )
        
        # Mark as served if paid (typical for POS)
        # But for KDS we might want it as "READY" or "COMPLETED"
        order.status = 'confirmed'
        order.save()
        
        # Broadcast to KDS
        try:
            broadcast_to_kds(order)
        except Exception as e:
            print(f"KDS Broadcast Failed: {e}")
        
        return order
