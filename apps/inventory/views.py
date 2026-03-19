from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
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
        outlet_id = self.request.query_params.get('outlet_id')
        if outlet_id:
            qs = qs.filter(outlet_id=outlet_id)
        
        # Searching by product name
        query = self.request.query_params.get('q')
        if query:
            qs = qs.filter(product__name__icontains=query)
            
        return qs.order_by('product__name')

    @action(detail=False, methods=['post'])
    def batch_adjust(self, request):
        """Batch update stock for an outlet (Bulk Purchase/Adjustment entries)."""
        outlet_id = request.data.get('outlet_id')
        entries = request.data.get('entries', []) # List of {product_id, variant_id, delta, type, notes}
        
        if not outlet_id:
            return Response({"error": "outlet_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        outlet = Outlet.objects.get(id=outlet_id)
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
            stock.quantity += delta
            stock.save()
            
            InventoryTransaction.objects.create(
                stock_item=stock,
                transaction_type=entry.get('type', 'adjustment'),
                quantity=delta,
                notes=entry.get('notes', f"Batch {entry.get('type', 'adjustment')}")
            )
            results.append(stock)
            
        return Response(StockItemSerializer(results, many=True).data)

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().prefetch_related('items')
    serializer_class = PurchaseOrderSerializer

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Finalize PO and add items to stock."""
        po = self.get_object_or_404(PurchaseOrder, pk=pk)
        if po.status == 'received':
            return Response({"error": "Already received"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Logic to update StockItem
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

    def get_object_or_404(self, model, **kwargs):
        from django.shortcuts import get_object_or_404
        return get_object_or_404(model, **kwargs)

from django.shortcuts import get_object_or_404
