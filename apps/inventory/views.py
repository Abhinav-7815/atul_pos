from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import StockItem, InventoryTransaction, Supplier, PurchaseOrder, PurchaseOrderItem
from .serializers import (
    StockItemSerializer, InventoryTransactionSerializer, 
    SupplierSerializer, PurchaseOrderSerializer
)
from apps.menu.models import Product, ProductVariant
from apps.outlets.models import Outlet
from decimal import Decimal

class InventoryViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.all()
    serializer_class = StockItemSerializer

    def get_queryset(self):
        qs = self.queryset
        outlet_id = self.request.query_params.get('outlet') or self.request.query_params.get('outlet_id')
        if not outlet_id:
            outlet_id = getattr(self.request.user, 'outlet_id', None)
            
        if outlet_id:
            qs = qs.filter(outlet_id=outlet_id)
        
        query = self.request.query_params.get('q')
        if query:
            qs = qs.filter(product__name__icontains=query)
        
        stock_status = self.request.query_params.get('status')
        if stock_status == 'LOW_STOCK':
            from django.db.models import F
            qs = qs.filter(quantity__lte=F('min_threshold'), quantity__gt=0)
        elif stock_status == 'OUT_OF_STOCK':
            qs = qs.filter(quantity__lte=0)
            
        return qs.order_by('product__name')

    @action(detail=False, methods=['post'])
    def set_quantity(self, request):
        """Set absolute stock quantity for a product (upsert)."""
        product_id     = request.data.get('product_id')
        outlet_id      = request.data.get('outlet')
        qty            = request.data.get('quantity')
        min_threshold  = request.data.get('min_threshold')

        if not product_id or qty is None:
            return Response({'error': 'product_id and quantity required'}, status=status.HTTP_400_BAD_REQUEST)

        product = get_object_or_404(Product, id=product_id)

        # Resolve outlet: from request, then from user profile, then first available
        outlet = None
        if outlet_id:
            outlet = get_object_or_404(Outlet, id=outlet_id)
        elif hasattr(request.user, 'outlet') and request.user.outlet:
            outlet = request.user.outlet
        elif hasattr(request.user, 'outlet_id') and request.user.outlet_id:
            outlet = get_object_or_404(Outlet, id=request.user.outlet_id)
        else:
            outlet = Outlet.objects.first()

        if not outlet:
            return Response({'error': 'No outlet found. Please set up an outlet first.'}, status=status.HTTP_400_BAD_REQUEST)

        stock, _ = StockItem.objects.get_or_create(
            product=product,
            variant=None,
            outlet=outlet,
            defaults={'quantity': Decimal('0.00')}
        )
        old_qty = stock.quantity
        stock.quantity = Decimal(str(qty))
        
        if min_threshold is not None:
            stock.min_threshold = Decimal(str(min_threshold))
            
        stock.save()

        delta = stock.quantity - old_qty
        InventoryTransaction.objects.create(
            stock_item=stock,
            transaction_type='adjustment',
            quantity=abs(delta),
            notes=f'Manual set: {old_qty} → {stock.quantity}'
        )
        return Response(StockItemSerializer(stock).data)

    @action(detail=False, methods=['post'])
    def batch_adjust(self, request):
        """Batch update stock for an outlet (Bulk Purchase/Adjustment entries)."""
        outlet_id = request.data.get('outlet') or request.data.get('outlet_id')
        entries = request.data.get('entries', [])
        
        if not outlet_id:
            return Response({"error": "outlet_id or outlet is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        outlet = get_object_or_404(Outlet, id=outlet_id)
        results = []
        
        for entry in entries:
            product = get_object_or_404(Product, id=entry.get('product_id'))
            variant_id = entry.get('variant_id')
            variant = ProductVariant.objects.get(id=variant_id) if variant_id else None
            
            stock, _ = StockItem.objects.get_or_create(
                product=product,
                variant=variant,
                outlet=outlet,
                defaults={'quantity': Decimal('0.00')}
            )
            
            delta = Decimal(str(entry.get('quantity', '0.00')))
            
            # For waste, we subtract
            transaction_type = entry.get('type', 'adjustment')
            if transaction_type == 'waste':
                stock.quantity -= delta
            else:
                stock.quantity += delta
            
            stock.save()
            
            InventoryTransaction.objects.create(
                stock_item=stock,
                transaction_type=transaction_type,
                quantity=delta,
                notes=entry.get('notes', f"Batch {transaction_type}")
            )
            results.append(stock)
            
        return Response(StockItemSerializer(results, many=True).data)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InventoryTransaction.objects.all().order_by('-created_at')
    serializer_class = InventoryTransactionSerializer

    def get_queryset(self):
        qs = self.queryset
        product_id = self.request.query_params.get('product')
        outlet_id = self.request.query_params.get('outlet')
        transaction_type = self.request.query_params.get('type')

        if product_id:
            qs = qs.filter(stock_item__product_id=product_id)
        if outlet_id:
            qs = qs.filter(stock_item__outlet_id=outlet_id)
        if transaction_type:
            qs = qs.filter(transaction_type=transaction_type)

        return qs[:100]  # Limit to latest 100


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().prefetch_related('items')
    serializer_class = PurchaseOrderSerializer

    def get_queryset(self):
        qs = self.queryset
        outlet_id = self.request.query_params.get('outlet')
        if outlet_id:
            qs = qs.filter(outlet_id=outlet_id)
        return qs.order_by('-created_at')

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Finalize PO and add items to stock."""
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status == 'received':
            return Response({"error": "Already received"}, status=status.HTTP_400_BAD_REQUEST)
        
        for item in po.items.all():
            stock, _ = StockItem.objects.get_or_create(
                product=item.product,
                variant=item.variant,
                outlet=po.outlet,
                defaults={'quantity': Decimal('0.00')}
            )
            stock.quantity += item.quantity
            stock.save()
            
            InventoryTransaction.objects.create(
                stock_item=stock,
                transaction_type='purchase',
                quantity=item.quantity,
                reference_id=po.po_number,
                notes=f"PO {po.po_number} received"
            )
        
        po.status = 'received'
        po.save()
        return Response(PurchaseOrderSerializer(po).data)
