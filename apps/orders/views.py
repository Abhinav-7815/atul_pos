from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Order, OrderItem, Payment, OrderStatus
from .serializers import OrderSerializer, OrderItemSerializer, PaymentSerializer
from apps.core.permissions import IsCashier
from apps.core.utils import record_audit
from decimal import Decimal
import threading
import requests as http_requests

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.none()
    serializer_class = OrderSerializer
    permission_classes = [IsCashier]

    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.all().prefetch_related('items', 'payments').order_by('-created_at')
        
        # 1. User-based Filtering (Security)
        if user.role != 'superadmin':
            if user.outlet_id:
                qs = qs.filter(outlet_id=user.outlet_id)
            else:
                return Order.objects.none()
                
        # 2. Query Parameter Filtering
        outlet_filter = self.request.query_params.get('outlet') or self.request.query_params.get('outlet_id')
        if outlet_filter:
            qs = qs.filter(outlet_id=outlet_filter)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status__in=status_filter.split(','))

        date_filter = self.request.query_params.get('created_at__date')
        if date_filter:
            qs = qs.filter(created_at__date=date_filter)

        return qs

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
        # Auto-print: background thread mein chalao taaki response delay na ho
        threading.Thread(target=_trigger_auto_print, args=(order,), daemon=True).start()


# ─── AUTO-PRINT HELPER ────────────────────────────────────────────────────────

PRINT_SERVER_URL = "http://127.0.0.1:9191/print"

def _build_receipt_payload(order: Order) -> dict:
    """Order object se print server ke liye JSON payload banata hai."""
    from .serializers import OrderItemSerializer, PaymentSerializer

    cgst = order.tax_amount / 2
    sgst = order.tax_amount / 2

    items_data = []
    for item in order.items.all():
        # unit_label: variant name se lo (e.g. "1 Cup", "200 Gms")
        unit_label = item.variant.name if item.variant else "pc(s)"
        items_data.append({
            "product_name": item.product.name,
            "unit_label":   unit_label,
            "quantity":     float(item.quantity),
            "unit_price":   float(item.unit_price),
            "item_total":   float(item.item_total),
        })

    return {
        "outlet": {
            "name":    order.outlet.name,
            "address": order.outlet.address or "",
            "phone":   order.outlet.phone or "",
            "gstin":   order.outlet.gstin or "",
        },
        "order_number": order.order_number,
        "date":         order.created_at.isoformat(),
        "cashier":      order.created_by.full_name if order.created_by else "",
        "order_type":   order.order_type,
        "items":        items_data,
        "totals": {
            "subtotal": float(order.subtotal),
            "cgst":     float(cgst),
            "sgst":     float(sgst),
            "discount": float(order.discount_amount),
            "total":    float(order.total_amount),
        },
    }


def _trigger_auto_print(order: Order):
    """Background thread: print server ko call karta hai."""
    try:
        payload = _build_receipt_payload(order)
        resp = http_requests.post(PRINT_SERVER_URL, json=payload, timeout=5)
        if resp.status_code == 200:
            print(f"[AutoPrint] OK — {order.order_number}")
        else:
            print(f"[AutoPrint] Server error {resp.status_code} — {order.order_number}")
    except http_requests.exceptions.ConnectionError:
        print(f"[AutoPrint] Print server not running (skipped) — {order.order_number}")
    except Exception as e:
        print(f"[AutoPrint] Failed — {order.order_number}: {e}")

# ─────────────────────────────────────────────────────────────────────────────

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
        """Update item in order"""
        order = self.get_object_or_404(Order, pk=pk)
        item = get_object_or_404(OrderItem, pk=item_id, order=order)
        
        serializer = OrderItemSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            order.calculate_totals()
            return Response(OrderSerializer(order).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm order and deduct inventory"""
        order = self.get_object_or_404(Order, pk=pk)
        if order.status != OrderStatus.DRAFT:
            return Response({"error": "Order already confirmed or cancelled"}, status=status.HTTP_400_BAD_REQUEST)
        
        order.status = OrderStatus.CONFIRMED
        order.save()
        
        # In a real app, this would trigger inventory deduction here
        # For now, we trust the POS has already validated stock
        
        record_audit(
            user=request.user,
            action="ORDER_CONFIRM",
            instance=order,
            description=f"Order {order.order_number} confirmed."
        )
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def payment(self, request, pk=None):
        """Record payment for an order"""
        order = self.get_object_or_404(Order, pk=pk)
        serializer = PaymentSerializer(data=request.data)
        if serializer.is_valid():
            payment = serializer.save(order=order, created_by=request.user)
            
            record_audit(
                user=request.user,
                action="PAYMENT_RECORD",
                instance=payment,
                description=f"Payment of ₹{payment.amount} via {payment.method} recorded for Order {order.order_number}."
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

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Delete all orders (requires manager password)"""
        from apps.accounts.models import User, UserRole
        from django.contrib.auth import authenticate
        password = request.data.get('password') or request.data.get('pin')

        if not password:
            return Response({"error": "Password required for bulk delete."}, status=status.HTTP_400_BAD_REQUEST)

        # Authenticate using the requesting user's own credentials
        authorizer = authenticate(username=request.user.email, password=password)

        if not authorizer:
            return Response({"error": "Incorrect password."}, status=status.HTTP_401_UNAUTHORIZED)

        authorized_roles = [UserRole.SUPERADMIN, UserRole.CLIENT_ADMIN, UserRole.OUTLET_MANAGER]
        if authorizer.role not in authorized_roles:
            return Response({"error": "Unauthorized role."}, status=status.HTTP_403_FORBIDDEN)

        # To be safe, filter by outlet if not superadmin
        qs = Order.objects.all()
        if authorizer.role != UserRole.SUPERADMIN:
            qs = qs.filter(outlet_id=authorizer.outlet_id)

        count = qs.count()
        qs.delete()

        record_audit(
            user=request.user,
            action="ORDERS_BULK_DELETE",
            description=f"Bulk deleted {count} orders authorized by {authorizer.full_name}."
        )

        return Response({"message": f"Successfully deleted {count} orders."}, status=status.HTTP_200_OK)

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
        from apps.accounts.models import UserRole
        authorizer = None
        # Allow superadmin, client_admin, or outlet_manager to void
        authorized_roles = [UserRole.SUPERADMIN, UserRole.CLIENT_ADMIN, UserRole.OUTLET_MANAGER, UserRole.AREA_MANAGER]
        for manager in User.objects.filter(role__in=authorized_roles, is_active=True):
            if manager.check_pin(manager_pin):
                authorizer = manager
                break
        
        if not authorizer:
            return Response({"error": "Invalid Manager PIN or Unauthorized role."}, status=status.HTTP_401_UNAUTHORIZED)
        
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

    @action(detail=True, methods=['post'], url_path='delete_order')
    def delete_order(self, request, pk=None):
        """Hard delete an order and renumber all subsequent orders of the same day."""
        from apps.accounts.models import User, UserRole
        from django.db import transaction as db_transaction
        order = self.get_object_or_404(Order, pk=pk)
        manager_pin = request.data.get('pin') or request.data.get('manager_pin')

        if not manager_pin:
            return Response({"error": "Manager PIN required."}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import authenticate as dj_auth
        authorizer = dj_auth(username=request.user.email, password=manager_pin)
        if not authorizer:
            return Response({"error": "Incorrect password."}, status=status.HTTP_401_UNAUTHORIZED)

        authorized_roles = [UserRole.SUPERADMIN, UserRole.CLIENT_ADMIN, UserRole.OUTLET_MANAGER]
        if authorizer.role not in authorized_roles:
            return Response({"error": "Unauthorized role."}, status=status.HTTP_403_FORBIDDEN)

        order_number = order.order_number
        outlet_id = order.outlet_id  # save before delete
        # Parse date prefix and sequence from order number e.g. ORD-20260407-0002
        parts = order_number.split('-')  # ['ORD', '20260407', '0002']
        prefix = f"{parts[0]}-{parts[1]}"  # ORD-20260407
        deleted_seq = int(parts[2])

        with db_transaction.atomic():
            # Hard delete the order first
            order.hard_delete()

            # Get all orders of same day with seq > deleted, ordered ascending
            later_orders = Order.objects.filter(
                outlet_id=outlet_id,
                order_number__startswith=prefix,
            ).order_by('order_number')

            # Renumber each: shift seq down by 1
            for o in later_orders:
                seq = int(o.order_number.split('-')[-1])
                if seq > deleted_seq:
                    new_number = f"{prefix}-{str(seq - 1).zfill(4)}"
                    Order.objects.filter(pk=o.pk).update(order_number=new_number)

        record_audit(
            user=request.user,
            action="ORDER_DELETE",
            description=f"Order {order_number} deleted by {authorizer.full_name}. Subsequent orders renumbered."
        )
        return Response({"message": f"Order {order_number} deleted and orders renumbered."}, status=status.HTTP_200_OK)

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
