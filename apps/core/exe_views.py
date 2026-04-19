"""
EXE API — secured by API Key (X-API-Key header).
Base URL: /api/v1/exe/

Endpoints:
  GET  /exe/orders/           — list orders (filterable by date, status)
  GET  /exe/orders/<id>/      — single order detail
  GET  /exe/stocks/           — current stock levels
  GET  /exe/stocks/<id>/      — single stock item
  POST /exe/stocks/adjust/    — adjust stock quantity
  GET  /exe/transactions/     — inventory transaction log
  GET  /exe/outlet/           — outlet info for this API key
  POST /exe/keys/generate/    — generate a new API key (requires JWT superadmin)
  GET  /exe/keys/             — list keys for outlet (requires JWT superadmin)
  DELETE /exe/keys/<id>/      — revoke a key (requires JWT superadmin)
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from decimal import Decimal

from .authentication import APIKeyAuthentication
from .permissions import HasAPIKey, IsSuperAdmin
from .models import APIKey
from apps.orders.models import Order, OrderItem, Payment
from apps.inventory.models import StockItem, InventoryTransaction
from apps.outlets.models import Outlet


# ─── Shared mixin ────────────────────────────────────────────────────────────

class EXEBaseView(APIView):
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [HasAPIKey]

    @property
    def outlet(self):
        return self.request.auth.outlet


# ─── Outlet Info ─────────────────────────────────────────────────────────────

class EXEOutletView(EXEBaseView):
    def get(self, request):
        o = self.outlet
        return Response({
            'id':           str(o.id),
            'name':         o.name,
            'outlet_code':  o.outlet_code,
            'address':      o.address,
            'city':         o.city,
            'phone':        o.phone,
            'gstin':        o.gstin or '',
            'base_tax_rate': float(o.base_tax_rate),
        })


# ─── Orders ──────────────────────────────────────────────────────────────────

def _serialize_order(o):
    items = []
    for item in o.items.select_related('product', 'variant').all():
        items.append({
            'id':           str(item.id),
            'product_id':   str(item.product_id),
            'product_name': item.product.name,
            'variant_id':   str(item.variant_id) if item.variant_id else None,
            'variant_name': item.variant.name if item.variant else None,
            'quantity':     float(item.quantity),
            'unit_price':   float(item.unit_price),
            'tax_rate':     float(item.tax_rate),
            'item_subtotal':float(item.item_subtotal),
            'item_tax':     float(item.item_tax),
            'item_total':   float(item.item_total),
        })
    payments = []
    for p in o.payments.all():
        payments.append({
            'id':       str(p.id),
            'method':   p.method,
            'amount':   float(p.amount),
            'status':   p.status,
        })
    return {
        'id':               str(o.id),
        'order_number':     o.order_number,
        'order_type':       o.order_type,
        'status':           o.status,
        'table_number':     o.table_number,
        'token_number':     o.token_number,
        'subtotal':         float(o.subtotal),
        'tax_amount':       float(o.tax_amount),
        'discount_amount':  float(o.discount_amount),
        'total_amount':     float(o.total_amount),
        'cashier':          o.created_by.full_name if o.created_by else 'POS',
        'customer_id':      str(o.customer_id) if o.customer_id else None,
        'notes':            o.notes or '',
        'created_at':       o.created_at.isoformat(),
        'items':            items,
        'payments':         payments,
    }


class EXEOrderListView(EXEBaseView):
    def get(self, request):
        qs = Order.objects.filter(outlet=self.outlet) \
                          .prefetch_related('items__product', 'items__variant', 'payments') \
                          .order_by('-created_at')

        # Filter: ?date=2026-04-14
        date_str = request.query_params.get('date')
        if date_str:
            d = parse_date(date_str)
            if d:
                qs = qs.filter(created_at__date=d)

        # Filter: ?status=confirmed,served
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status__in=status_filter.split(','))

        # Pagination: ?limit=50&offset=0
        limit  = min(int(request.query_params.get('limit',  100)), 500)
        offset = int(request.query_params.get('offset', 0))
        total  = qs.count()
        qs     = qs[offset: offset + limit]

        return Response({
            'total':   total,
            'limit':   limit,
            'offset':  offset,
            'results': [_serialize_order(o) for o in qs],
        })


class EXEOrderDetailView(EXEBaseView):
    def get(self, request, pk):
        order = get_object_or_404(
            Order.objects.prefetch_related('items__product', 'items__variant', 'payments'),
            pk=pk, outlet=self.outlet
        )
        return Response(_serialize_order(order))


# ─── Stocks ──────────────────────────────────────────────────────────────────

def _serialize_stock(s):
    if s.quantity <= 0:
        stock_status = 'OUT_OF_STOCK'
    elif s.quantity <= s.min_threshold:
        stock_status = 'LOW_STOCK'
    else:
        stock_status = 'NORMAL'

    return {
        'id':            str(s.id),
        'product_id':    str(s.product_id),
        'product_name':  s.product.name,
        'variant_id':    str(s.variant_id) if s.variant_id else None,
        'variant_name':  s.variant.name if s.variant else None,
        'quantity':      float(s.quantity),
        'min_threshold': float(s.min_threshold),
        'status':        stock_status,
    }


class EXEStockListView(EXEBaseView):
    def get(self, request):
        qs = StockItem.objects.filter(outlet=self.outlet) \
                              .select_related('product', 'variant') \
                              .order_by('product__name')

        # Filter: ?status=LOW_STOCK  or  OUT_OF_STOCK
        stock_status = request.query_params.get('status')
        if stock_status == 'LOW_STOCK':
            from django.db.models import F
            qs = qs.filter(quantity__lte=F('min_threshold'), quantity__gt=0)
        elif stock_status == 'OUT_OF_STOCK':
            qs = qs.filter(quantity__lte=0)

        # Filter: ?q=vanilla
        q = request.query_params.get('q')
        if q:
            qs = qs.filter(product__name__icontains=q)

        return Response({
            'count':   qs.count(),
            'results': [_serialize_stock(s) for s in qs],
        })


class EXEStockDetailView(EXEBaseView):
    def get(self, request, pk):
        stock = get_object_or_404(
            StockItem.objects.select_related('product', 'variant'),
            pk=pk, outlet=self.outlet
        )
        return Response(_serialize_stock(stock))


class EXEStockAdjustView(EXEBaseView):
    """
    POST /exe/stocks/adjust/
    Body: { "product_id": "...", "variant_id": "...|null", "delta": 5.0,
            "type": "purchase|adjustment|waste", "notes": "..." }
    delta > 0 = add stock, delta < 0 = remove stock
    """
    def post(self, request):
        product_id  = request.data.get('product_id')
        variant_id  = request.data.get('variant_id')
        delta       = request.data.get('delta')
        txn_type    = request.data.get('type', 'adjustment')
        notes       = request.data.get('notes', '')

        if not product_id or delta is None:
            return Response({'error': 'product_id and delta are required.'}, status=status.HTTP_400_BAD_REQUEST)

        valid_types = ('purchase', 'adjustment', 'waste', 'transfer')
        if txn_type not in valid_types:
            return Response({'error': f'type must be one of {valid_types}'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.menu.models import Product, ProductVariant
        product = get_object_or_404(Product, pk=product_id)
        variant = get_object_or_404(ProductVariant, pk=variant_id) if variant_id else None

        stock, _ = StockItem.objects.get_or_create(
            product=product, variant=variant, outlet=self.outlet,
            defaults={'quantity': Decimal('0.00')}
        )

        delta_dec = Decimal(str(delta))
        stock.quantity += delta_dec
        stock.save()

        InventoryTransaction.objects.create(
            stock_item=stock,
            transaction_type=txn_type,
            quantity=abs(delta_dec),
            notes=notes or f'EXE {txn_type}: delta={delta}',
        )

        return Response(_serialize_stock(stock), status=status.HTTP_200_OK)


# ─── Inventory Transactions ───────────────────────────────────────────────────

class EXETransactionListView(EXEBaseView):
    def get(self, request):
        qs = InventoryTransaction.objects.filter(stock_item__outlet=self.outlet) \
                                         .select_related('stock_item__product', 'stock_item__variant') \
                                         .order_by('-created_at')

        txn_type = request.query_params.get('type')
        if txn_type:
            qs = qs.filter(transaction_type=txn_type)

        product_id = request.query_params.get('product_id')
        if product_id:
            qs = qs.filter(stock_item__product_id=product_id)

        limit  = min(int(request.query_params.get('limit',  100)), 500)
        offset = int(request.query_params.get('offset', 0))
        total  = qs.count()
        qs     = qs[offset: offset + limit]

        results = []
        for t in qs:
            results.append({
                'id':           str(t.id),
                'product_name': t.stock_item.product.name,
                'variant_name': t.stock_item.variant.name if t.stock_item.variant else None,
                'type':         t.transaction_type,
                'quantity':     float(t.quantity),
                'reference_id': t.reference_id or '',
                'notes':        t.notes or '',
                'created_at':   t.created_at.isoformat(),
            })

        return Response({'total': total, 'limit': limit, 'offset': offset, 'results': results})


# ─── API Key Management (JWT superadmin only) ─────────────────────────────────

class APIKeyManageView(APIView):
    """
    GET  — list all API keys for an outlet
    POST — generate a new key
    Secured by JWT (superadmin), NOT by API key itself.
    """
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        outlet_id = request.query_params.get('outlet_id')
        qs = APIKey.objects.select_related('outlet').order_by('-created_at')
        if outlet_id:
            qs = qs.filter(outlet_id=outlet_id)
        elif hasattr(request.user, 'outlet_id') and request.user.outlet_id:
            qs = qs.filter(outlet_id=request.user.outlet_id)

        data = []
        for k in qs:
            data.append({
                'id':           str(k.id),
                'name':         k.name,
                'prefix':       k.prefix,
                'outlet_id':    str(k.outlet_id),
                'outlet_name':  k.outlet.name,
                'is_active':    k.is_active,
                'created_at':   k.created_at.isoformat(),
                'last_used_at': k.last_used_at.isoformat() if k.last_used_at else None,
            })
        return Response(data)

    def post(self, request):
        outlet_id = request.data.get('outlet_id')
        name      = request.data.get('name', 'EXE Integration')

        if outlet_id:
            outlet = get_object_or_404(Outlet, pk=outlet_id)
        elif hasattr(request.user, 'outlet') and request.user.outlet:
            outlet = request.user.outlet
        else:
            return Response({'error': 'outlet_id required.'}, status=status.HTTP_400_BAD_REQUEST)

        api_key, plain = APIKey.generate(outlet=outlet, name=name)

        return Response({
            'id':        str(api_key.id),
            'name':      api_key.name,
            'outlet':    outlet.name,
            'prefix':    api_key.prefix,
            'key':       plain,   # shown ONCE — store it now
            'warning':   'This key will NOT be shown again. Copy and store it securely.',
        }, status=status.HTTP_201_CREATED)


class APIKeyRevokeView(APIView):
    permission_classes = [IsSuperAdmin]

    def delete(self, request, pk):
        api_key = get_object_or_404(APIKey, pk=pk)
        api_key.is_active = False
        api_key.save(update_fields=['is_active'])
        return Response({'message': f'API key "{api_key.name}" revoked.'})
