from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from decimal import Decimal

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q

from .models import DistributorOrder, DistributorOrderItem, StockDispatch, DistributorOrderStatus
from .serializers import (
    DistributorOrderSerializer,
    DistributorOrderCreateSerializer,
    StockDispatchSerializer,
)
from .permissions import IsMainBranchUser, IsDistributorUser, IsMainOrDistributorUser
from apps.outlets.models import Outlet
from apps.menu.models import Product, ProductVariant
from apps.inventory.models import StockItem, InventoryTransaction


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def _get_main_outlet():
    """Return the single main-branch outlet, or raise 400 if not configured."""
    try:
        return Outlet.objects.get(outlet_type='main')
    except Outlet.DoesNotExist:
        return None
    except Outlet.MultipleObjectsReturned:
        return Outlet.objects.filter(outlet_type='main').first()


def _deduct_main_stock(order):
    """Deduct stock from main branch for every item in the order."""
    main_outlet = order.fulfilled_by_outlet
    for item in order.items.all():
        stock, _ = StockItem.objects.get_or_create(
            product=item.product,
            variant=item.variant,
            outlet=main_outlet,
            defaults={'quantity': Decimal('0.00')},
        )
        stock.quantity -= item.quantity
        stock.save()
        InventoryTransaction.objects.create(
            stock_item=stock,
            transaction_type='dispatch',
            quantity=-item.quantity,
            reference_id=order.order_number,
            notes=f"Dispatched to {order.distributor_outlet.name} — {order.order_number}",
        )


def _add_distributor_stock(order):
    """Add stock to distributor's outlet upon delivery confirmation."""
    dist_outlet = order.distributor_outlet
    for item in order.items.all():
        stock, _ = StockItem.objects.get_or_create(
            product=item.product,
            variant=item.variant,
            outlet=dist_outlet,
            defaults={'quantity': Decimal('0.00')},
        )
        stock.quantity += item.quantity
        stock.save()
        InventoryTransaction.objects.create(
            stock_item=stock,
            transaction_type='transfer',
            quantity=item.quantity,
            reference_id=order.order_number,
            notes=f"Received from main branch — {order.order_number}",
        )


# ─────────────────────────────────────────────
#  DistributorOrderViewSet
# ─────────────────────────────────────────────

class DistributorOrderViewSet(viewsets.ModelViewSet):
    """
    Main CRUD + workflow for distribution orders.

    Visibility:
    - Main branch staff  → all orders destined for them
    - Distributor staff  → only their own outlet's orders
    """
    permission_classes = [IsAuthenticated, IsMainOrDistributorUser]

    def get_queryset(self):
        user = self.request.user
        qs = (
            DistributorOrder.objects
            .select_related('distributor_outlet', 'fulfilled_by_outlet')
            .prefetch_related('items__product', 'items__variant', 'dispatches')
        )
        outlet_type = user.outlet.outlet_type if user.outlet else None
        if outlet_type == 'main':
            return qs.filter(fulfilled_by_outlet=user.outlet)
        elif outlet_type == 'distributor':
            return qs.filter(distributor_outlet=user.outlet)
        return qs.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return DistributorOrderCreateSerializer
        return DistributorOrderSerializer

    # ── CREATE ────────────────────────────────
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Only distributor users can create orders."""
        if request.user.outlet.outlet_type != 'distributor':
            return Response(
                {"error": "Only distributor outlets can place distribution orders."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DistributorOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        main_outlet = _get_main_outlet()
        if not main_outlet:
            return Response(
                {"error": "No main branch configured. Cannot place a distribution order."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        distributor_outlet = request.user.outlet
        discount_pct = distributor_outlet.distributor_discount_pct

        # Build the order
        order = DistributorOrder.objects.create(
            distributor_outlet=distributor_outlet,
            fulfilled_by_outlet=main_outlet,
            notes=data.get('notes', ''),
            expected_delivery_date=data.get('expected_delivery_date'),
        )

        subtotal = Decimal('0.00')
        for item_data in data['items']:
            product = get_object_or_404(Product, id=item_data['product_id'])
            variant = None
            if item_data.get('variant_id'):
                variant = get_object_or_404(ProductVariant, id=item_data['variant_id'])

            unit_price = item_data['unit_price']
            qty        = item_data['quantity']
            item_subtotal = unit_price * qty
            subtotal += item_subtotal

            DistributorOrderItem.objects.create(
                distributor_order=order,
                product=product,
                variant=variant,
                quantity=qty,
                unit_price=unit_price,
            )

        # Calculate totals
        order.subtotal       = subtotal
        order.discount_amount = (subtotal * discount_pct / Decimal('100'))
        order.total_amount   = subtotal - order.discount_amount
        order.save(update_fields=['subtotal', 'discount_amount', 'total_amount'])

        return Response(
            DistributorOrderSerializer(order).data,
            status=status.HTTP_201_CREATED,
        )

    # ── WORKFLOW ACTIONS ──────────────────────

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Distributor submits a draft order to the main branch."""
        order = self.get_object()
        if request.user.outlet.outlet_type != 'distributor':
            return Response({"error": "Only the distributor can submit this order."}, status=403)
        if order.status != DistributorOrderStatus.DRAFT:
            return Response({"error": f"Cannot submit an order in '{order.status}' status."}, status=400)

        order.status       = DistributorOrderStatus.SUBMITTED
        order.submitted_at = timezone.now()
        order.save(update_fields=['status', 'submitted_at'])
        return Response(DistributorOrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Main branch approves a submitted order."""
        order = self.get_object()
        if request.user.outlet.outlet_type != 'main':
            return Response({"error": "Only main branch staff can approve orders."}, status=403)
        if order.status != DistributorOrderStatus.SUBMITTED:
            return Response({"error": f"Cannot approve an order in '{order.status}' status."}, status=400)

        order.status      = DistributorOrderStatus.APPROVED
        order.approved_at = timezone.now()
        order.save(update_fields=['status', 'approved_at'])
        return Response(DistributorOrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """Main branch starts processing (preparing stock for dispatch)."""
        order = self.get_object()
        if request.user.outlet.outlet_type != 'main':
            return Response({"error": "Only main branch staff can process orders."}, status=403)
        if order.status != DistributorOrderStatus.APPROVED:
            return Response({"error": f"Cannot process an order in '{order.status}' status."}, status=400)

        order.status = DistributorOrderStatus.PROCESSING
        order.save(update_fields=['status'])
        return Response(DistributorOrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def dispatch(self, request, pk=None):
        """
        Main branch dispatches stock to the distributor.
        Creates a StockDispatch record and deducts from main branch inventory.
        """
        order = self.get_object()
        if request.user.outlet.outlet_type != 'main':
            return Response({"error": "Only main branch staff can dispatch orders."}, status=403)
        if order.status != DistributorOrderStatus.PROCESSING:
            return Response({"error": f"Cannot dispatch an order in '{order.status}' status."}, status=400)

        vehicle_number = request.data.get('vehicle_number', '')
        driver_name    = request.data.get('driver_name', '')
        notes          = request.data.get('notes', '')

        # Create dispatch record
        dispatch = StockDispatch.objects.create(
            distributor_order=order,
            dispatched_by=request.user,
            vehicle_number=vehicle_number,
            driver_name=driver_name,
            notes=notes,
        )

        # Deduct stock from main branch
        _deduct_main_stock(order)

        order.status       = DistributorOrderStatus.DISPATCHED
        order.dispatched_at = timezone.now()
        order.save(update_fields=['status', 'dispatched_at'])

        return Response(DistributorOrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def receive(self, request, pk=None):
        """
        Distributor confirms receipt of the goods.
        Adds stock to the distributor's own inventory.
        """
        order = self.get_object()
        if request.user.outlet.outlet_type != 'distributor':
            return Response({"error": "Only the distributor can confirm receipt."}, status=403)
        if order.status != DistributorOrderStatus.DISPATCHED:
            return Response({"error": f"Cannot receive an order in '{order.status}' status."}, status=400)

        # Mark dispatch(es) as received
        order.dispatches.filter(is_received=False).update(
            is_received=True,
            received_at=timezone.now(),
        )

        # Add stock to distributor's inventory
        _add_distributor_stock(order)

        order.status      = DistributorOrderStatus.DELIVERED
        order.delivered_at = timezone.now()
        order.save(update_fields=['status', 'delivered_at'])

        return Response(DistributorOrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel an order. Distributor can cancel draft/submitted; main branch can cancel up to processing."""
        order = self.get_object()
        outlet_type = request.user.outlet.outlet_type

        cancellable_by_distributor = {DistributorOrderStatus.DRAFT, DistributorOrderStatus.SUBMITTED}
        cancellable_by_main        = {
            DistributorOrderStatus.DRAFT,
            DistributorOrderStatus.SUBMITTED,
            DistributorOrderStatus.APPROVED,
            DistributorOrderStatus.PROCESSING,
        }

        if outlet_type == 'distributor' and order.status not in cancellable_by_distributor:
            return Response({"error": "Distributor can only cancel draft or submitted orders."}, status=400)
        if outlet_type == 'main' and order.status not in cancellable_by_main:
            return Response({"error": "Cannot cancel an order that has already been dispatched."}, status=400)

        order.status = DistributorOrderStatus.CANCELLED
        order.notes  = (order.notes or '') + f"\n[Cancelled by {request.user.full_name}]"
        order.save(update_fields=['status', 'notes'])
        return Response(DistributorOrderSerializer(order).data)


# ─────────────────────────────────────────────
#  StockDispatchViewSet  (read-only)
# ─────────────────────────────────────────────

class StockDispatchViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = StockDispatchSerializer
    permission_classes = [IsAuthenticated, IsMainOrDistributorUser]

    def get_queryset(self):
        user = self.request.user
        outlet_type = user.outlet.outlet_type if user.outlet else None
        qs = StockDispatch.objects.select_related(
            'distributor_order__distributor_outlet',
            'distributor_order__fulfilled_by_outlet',
            'dispatched_by',
        )
        if outlet_type == 'main':
            return qs.filter(distributor_order__fulfilled_by_outlet=user.outlet)
        elif outlet_type == 'distributor':
            return qs.filter(distributor_order__distributor_outlet=user.outlet)
        return qs.none()


# ─────────────────────────────────────────────
#  DistributorDashboardView
# ─────────────────────────────────────────────

class DistributorDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsMainOrDistributorUser]

    def get(self, request):
        user        = request.user
        outlet_type = user.outlet.outlet_type if user.outlet else None

        if outlet_type == 'main':
            data = self._main_branch_stats(user.outlet)
        else:
            data = self._distributor_stats(user.outlet)

        return Response(data)

    # --- Main Branch Stats ---
    def _main_branch_stats(self, outlet):
        from django.db.models import Sum as DSum
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        orders = DistributorOrder.objects.filter(fulfilled_by_outlet=outlet)

        pending_count     = orders.filter(status=DistributorOrderStatus.SUBMITTED).count()
        approved_count    = orders.filter(status=DistributorOrderStatus.APPROVED).count()
        processing_count  = orders.filter(status=DistributorOrderStatus.PROCESSING).count()
        in_transit_count  = orders.filter(status=DistributorOrderStatus.DISPATCHED).count()
        today_dispatches  = StockDispatch.objects.filter(
            distributor_order__fulfilled_by_outlet=outlet,
            created_at__date=now.date(),
        ).count()
        monthly_revenue   = orders.filter(
            status=DistributorOrderStatus.DELIVERED,
            delivered_at__gte=month_start,
        ).aggregate(total=DSum('total_amount'))['total'] or 0

        # Top 5 distributors by order value this month
        top_distributors = (
            orders.filter(delivered_at__gte=month_start)
            .values('distributor_outlet__name', 'distributor_outlet__id')
            .annotate(total=DSum('total_amount'), order_count=Count('id'))
            .order_by('-total')[:5]
        )

        # Recent 10 orders
        recent_orders = DistributorOrderSerializer(
            orders.select_related('distributor_outlet')[:10], many=True
        ).data

        return {
            'panel': 'main',
            'stats': {
                'pending_approval':  pending_count,
                'approved':          approved_count,
                'processing':        processing_count,
                'in_transit':        in_transit_count,
                'today_dispatches':  today_dispatches,
                'monthly_revenue':   float(monthly_revenue),
            },
            'top_distributors': list(top_distributors),
            'recent_orders':    recent_orders,
        }

    # --- Distributor Stats ---
    def _distributor_stats(self, outlet):
        from django.db.models import Sum as DSum
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        orders = DistributorOrder.objects.filter(distributor_outlet=outlet)

        open_orders      = orders.filter(
            status__in=[
                DistributorOrderStatus.DRAFT, DistributorOrderStatus.SUBMITTED,
                DistributorOrderStatus.APPROVED, DistributorOrderStatus.PROCESSING,
            ]
        ).count()
        in_transit       = orders.filter(status=DistributorOrderStatus.DISPATCHED).count()
        delivered_this_month = orders.filter(
            status=DistributorOrderStatus.DELIVERED,
            delivered_at__gte=month_start,
        ).count()
        monthly_value    = orders.filter(
            status=DistributorOrderStatus.DELIVERED,
            delivered_at__gte=month_start,
        ).aggregate(total=DSum('total_amount'))['total'] or 0

        # Credit utilisation = value of non-delivered orders
        outstanding = orders.filter(
            status__in=[
                DistributorOrderStatus.SUBMITTED,
                DistributorOrderStatus.APPROVED,
                DistributorOrderStatus.PROCESSING,
                DistributorOrderStatus.DISPATCHED,
            ]
        ).aggregate(total=DSum('total_amount'))['total'] or 0

        recent_orders = DistributorOrderSerializer(orders[:10], many=True).data

        return {
            'panel': 'distributor',
            'stats': {
                'open_orders':           open_orders,
                'in_transit':            in_transit,
                'delivered_this_month':  delivered_this_month,
                'monthly_value':         float(monthly_value),
                'outstanding_amount':    float(outstanding),
                'credit_limit':          float(outlet.credit_limit),
            },
            'recent_orders': recent_orders,
        }
