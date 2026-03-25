from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import CashierShift, DrawerEntry
from .serializers import CashierShiftSerializer, DrawerEntrySerializer
from apps.orders.models import Payment, Order
from django.db.models import Sum

class ShiftViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CashierShiftSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not hasattr(user, 'outlet'):
             return CashierShift.objects.none()
        return CashierShift.objects.filter(outlet=user.outlet)


    @action(detail=False, methods=['post'], url_path='open')
    def open_shift(self, request):
        outlet = request.user.outlet
        if not outlet:
            return Response({"error": "User's outlet not set"}, status=400)
        
        # Check if already has an open shift (only one active at a time for whole outlet or per user)
        # This implementation allows only one active shift for the cashier.
        if CashierShift.objects.filter(cashier=request.user, is_active=True).exists():
            return Response({"error": "You already have an active shift"}, status=400)
        
        opening_balance = request.data.get('opening_balance', 0.00)
        notes = request.data.get('notes', '')
        
        shift = CashierShift.objects.create(
            cashier=request.user,
            outlet=outlet,
            opening_balance=opening_balance,
            notes=notes
        )
        return Response(CashierShiftSerializer(shift).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='close')
    def close_shift(self, request):
        try:
            shift = CashierShift.objects.get(cashier=request.user, is_active=True)
        except CashierShift.DoesNotExist:
            return Response({"error": "No active shift found"}, status=status.HTTP_404_NOT_FOUND)
        
        shift.closing_balance = request.data.get('closing_balance', 0.00)
        shift.actual_cash = request.data.get('actual_cash', 0.00)
        shift.end_time = timezone.now()
        shift.is_active = False
        shift.save()
        
        return Response(CashierShiftSerializer(shift).data)
    
    @action(detail=False, methods=['get'], url_path='current')
    def current_shift(self, request):
        try:
            shift = CashierShift.objects.get(cashier=request.user, is_active=True)
            stats = self._get_shift_stats(shift)
            return Response({
                "active": True,
                "shift": CashierShiftSerializer(shift).data,
                "stats": stats
            })
        except CashierShift.DoesNotExist:
            return Response({"active": False})

    def _get_shift_stats(self, shift):
        # All orders confirmed/served during this shift
        # Filtering by cashier and outlet within time range
        end_time = shift.end_time or timezone.now()
        
        # Get payments during this shift for this cashier
        payments = Payment.objects.filter(
            order__outlet=shift.outlet,
            created_at__gte=shift.start_time,
            created_at__lte=end_time,
            status='completed'
        )
        
        # Payment breakdown
        breakdown = payments.values('method').annotate(total=Sum('amount'))
        
        # Net Totals
        # We also need order totals (inclusive of tax)
        orders = Order.objects.filter(
            outlet=shift.outlet,
            created_at__gte=shift.start_time,
            created_at__lte=end_time
        ).exclude(status='voided')
        
        totals = orders.aggregate(
            subtotal=Sum('subtotal'),
            tax=Sum('tax_amount'),
            discount=Sum('discount_amount'),
            grand_total=Sum('total_amount')
        )

        return {
            "payment_breakdown": breakdown,
            "totals": totals,
            "order_count": orders.count()
        }

    @action(detail=False, methods=['post'], url_path='cash-entry')
    def add_cash_entry(self, request):
        try:
            shift = CashierShift.objects.get(cashier=request.user, is_active=True)
        except CashierShift.DoesNotExist:
            return Response({"error": "No active shift found"}, status=status.HTTP_404_NOT_FOUND)
        
        entry_type = request.data.get('entry_type')
        amount = request.data.get('amount')
        reason = request.data.get('reason')
        
        if not all([entry_type, amount, reason]):
            return Response({"error": "Missing fields"}, status=400)
            
        entry = DrawerEntry.objects.create(
            shift=shift,
            entry_type=entry_type,
            amount=amount,
            reason=reason
        )
        return Response(DrawerEntrySerializer(entry).data, status=status.HTTP_201_CREATED)
