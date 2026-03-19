from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Order, OrderItem, Payment, OrderStatus
from .serializers import OrderSerializer, OrderItemSerializer, PaymentSerializer
from apps.core.permissions import IsCashier
from apps.core.utils import record_audit
from decimal import Decimal

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().prefetch_related('items', 'payments')
    serializer_class = OrderSerializer
    permission_classes = [IsCashier]

    def create(self, request, *args, **kwargs):
        print("REQUEST DATA:", dict(request.data))
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("ORDER_CREATE_ERROR:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        order = serializer.save(created_by=self.request.user)
        record_audit(
            user=self.request.user,
            action="ORDER_CREATE",
            instance=order,
            description=f"Order {order.order_number} created for {order.order_type}."
        )

    @action(detail=True, methods=['post'])
    def items(self, request, pk=None):
        """Add item to order"""
        order = self.get_object_or_404(Order, pk=pk)
        if order.status != OrderStatus.DRAFT:
            return Response({"error": "Cannot add items to a non-draft order"}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = OrderItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(order=order)
            order.calculate_totals()
            return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'], url_path='items/(?P<item_id>[^/.]+)')
    def update_item(self, request, pk=None, item_id=None):
        """Update or remove item"""
        order = self.get_object_or_404(Order, pk=pk)
        item = get_object_or_404(OrderItem, pk=item_id, order=order)
        
        qty = request.data.get('quantity')
        if qty is not None:
            if int(qty) <= 0:
                item.delete()
            else:
                item.quantity = int(qty)
                item.save()
            
            order.calculate_totals()
            return Response(OrderSerializer(order).data)
        return Response({"error": "Quantity required"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm order and dispatch to KDS"""
        order = self.get_object_or_404(Order, pk=pk)
        if order.status == OrderStatus.DRAFT:
            order.status = OrderStatus.CONFIRMED
            order.save()
            
            record_audit(
                user=request.user,
                action="ORDER_CONFIRM",
                instance=order,
                description=f"Order {order.order_number} confirmed."
            )
            
            # TODO: Dispatch WebSocket event to KDS
            return Response(OrderSerializer(order).data)
        return Response({"error": "Order already confirmed"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def payment(self, request, pk=None):
        """Record payment"""
        order = self.get_object_or_404(Order, pk=pk)
        serializer = PaymentSerializer(data=request.data)
        if serializer.is_valid():
            payment = serializer.save(order=order, status='completed')
            
            record_audit(
                user=request.user,
                action="PAYMENT_RECORD",
                instance=payment,
                description=f"Payment of {payment.amount} recorded via {payment.method} for Order {order.order_number}.",
                changes={"order_status": order.status}
            )
            
            # Check if fully paid
            total_paid = sum(p.amount for p in order.payments.filter(status='completed'))
            if total_paid >= order.total_amount:
                order.status = OrderStatus.SERVED
                order.save()
                
                record_audit(
                    user=request.user,
                    action="ORDER_SERVED",
                    instance=order,
                    description=f"Order {order.order_number} fully paid and served."
                )
            
            return Response({
                "payment": PaymentSerializer(payment).data,
                "order": OrderSerializer(order).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        """Void an order (requires manager PIN)"""
        from apps.accounts.models import User
        from django.utils import timezone
        
        order = self.get_object_or_404(Order, pk=pk)
        manager_pin = request.data.get('pin') or request.data.get('manager_pin')
        reason = request.data.get('reason', 'Administrative Void')

        if not manager_pin:
            return Response({"error": "Manager PIN required to void order."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Find any manager/admin who can authorize this
        authorizer = None
        for manager in User.objects.filter(role__in=['admin', 'manager'], is_active=True):
            if manager.check_pin(manager_pin):
                authorizer = manager
                break
        
        if not authorizer:
            return Response({"error": "Invalid Manager PIN."}, status=status.HTTP_401_UNAUTHORIZED)
        
        authorizer_name = authorizer.get_full_name() or authorizer.username
            
        if order.status == OrderStatus.VOIDED:
            return Response({"error": "Order is already voided."}, status=status.HTTP_400_BAD_REQUEST)

        # Update order status
        old_status = order.status
        order.status = OrderStatus.VOIDED
        order.notes = (order.notes or "") + f"\n[VOIDED by {authorizer.full_name} on {timezone.now().strftime('%Y-%m-%d %H:%M')}: {reason}]"
        order.save()

        record_audit(
            user=request.user,
            action="ORDER_VOID",
            instance=order,
            description=f"Order {order.order_number} voided by {authorizer.full_name}. Reason: {reason}",
            changes={"status": {"from": old_status, "to": "voided"}}
        )

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        """Get receipt format"""
        from .utils.formatters import format_thermal_receipt
        order = self.get_object_or_404(Order, pk=pk)
        # Calculate GST Breakdown (usually 50/50 split for CGST/SGST within state)
        cgst = order.tax_amount / 2
        sgst = order.tax_amount / 2
        
        # Group items by tax rate for a tax summary table
        tax_summary = {}
        for item in order.items.all():
            rate = str(item.tax_rate)
            if rate not in tax_summary:
                tax_summary[rate] = {"taxable_value": Decimal('0.00'), "cgst": Decimal('0.00'), "sgst": Decimal('0.00')}
            tax_summary[rate]["taxable_value"] += item.item_subtotal
            tax_summary[rate]["cgst"] += item.item_tax / 2
            tax_summary[rate]["sgst"] += item.item_tax / 2

        data = {
            "outlet": {
                "name": order.outlet.name,
                "address": order.outlet.address,
                "gstin": order.outlet.gstin,
                "phone": order.outlet.phone
            },
            "order_number": order.order_number,
            "date": order.created_at,
            "cashier": order.created_by.full_name if order.created_by else "System",
            "items": OrderItemSerializer(order.items.all(), many=True).data,
            "totals": {
                "subtotal": order.subtotal,
                "cgst": cgst,
                "sgst": sgst,
                "total": order.total_amount,
                "discount": order.discount_amount
            },
            "tax_summary": [
                {"rate": rate, **values} for rate, values in tax_summary.items()
            ],
            "payments": PaymentSerializer(order.payments.all(), many=True).data,
            "thermal_raw": format_thermal_receipt(order, order.outlet)
        }
        return Response(data)

    def get_object_or_404(self, model, pk):
        return get_object_or_404(model, pk=pk)
