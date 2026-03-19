from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Count, Avg, F
from django.db.models.functions import TruncDate
from apps.orders.models import Order, OrderStatus, OrderItem
from apps.menu.models import Product
from apps.inventory.models import StockItem
from decimal import Decimal
from datetime import timedelta

class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        outlet_id = request.query_params.get('outlet_id')
        if not outlet_id:
            # Fallback to user's outlet if available
            outlet_id = getattr(request.user, 'outlet_id', None)
        
        if not outlet_id:
            return Response({"error": "Outlet ID is required"}, status=400)

        today = timezone.now().date()
        seven_days_ago = today - timedelta(days=6)

        # Base queryset for this outlet
        orders_qs = Order.objects.filter(outlet_id=outlet_id)
        
        # Today's metrics
        today_orders = orders_qs.filter(created_at__date=today).exclude(status=OrderStatus.CANCELLED)
        today_sales = today_orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        order_count = today_orders.count()
        avg_bill = today_sales / order_count if order_count > 0 else Decimal('0.00')

        # Active Orders (Live Queue)
        active_statuses = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY]
        active_orders_count = orders_qs.filter(status__in=active_statuses).count()

        # Sales Trend (Last 7 Days)
        trend = orders_qs.filter(
            created_at__date__gte=seven_days_ago
        ).exclude(
            status=OrderStatus.CANCELLED
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            total=Sum('total_amount'),
            count=Count('id')
        ).order_by('date')

        # Top Products
        top_products = OrderItem.objects.filter(
            order__outlet_id=outlet_id,
            order__created_at__date__gte=seven_days_ago
        ).exclude(
            order__status=OrderStatus.CANCELLED
        ).values(
            'product_id', 
            'product__name'
        ).annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum('item_total')
        ).order_by('-total_qty')[:5]

        # Inventory Alerts
        low_stock = StockItem.objects.filter(
            outlet_id=outlet_id,
            quantity__lte=F('min_threshold')
        ).select_related('product', 'variant')[:4]

        return Response({
            "today": {
                "sales": float(today_sales),
                "orders": order_count,
                "avg_bill": float(avg_bill),
                "active_orders": active_orders_count
            },
            "trend": [
                {
                    "date": t['date'].strftime('%Y-%m-%d'),
                    "sales": float(t['total']),
                    "orders": t['count']
                } for t in trend
            ],
            "top_products": [
                {
                    "name": p['product__name'],
                    "quantity": p['total_qty'],
                    "revenue": float(p['total_revenue'])
                } for p in top_products
            ],
            "inventory_alerts": [
                {
                    "name": f"{s.product.name} ({s.variant.name})" if s.variant else s.product.name,
                    "quantity": float(s.quantity),
                    "threshold": float(s.min_threshold),
                    "status": "DANGER" if s.quantity <= 0 else "WARNING"
                } for s in low_stock
            ]
        })

import csv
from django.http import HttpResponse

class ReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        outlet_id = request.query_params.get('outlet_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        export_mode = request.query_params.get('export', False)

        if not outlet_id:
            return Response({"error": "Outlet required"}, status=400)

        # Filters
        filters = {'outlet_id': outlet_id}
        if start_date:
            filters['created_at__date__gte'] = start_date
        if end_date:
            filters['created_at__date__lte'] = end_date
            
        orders = Order.objects.filter(**filters).exclude(status=OrderStatus.CANCELLED)

        # Totals
        agg = orders.aggregate(
            total_sales=Sum('total_amount'),
            total_orders=Count('id'),
            total_tax=Sum('tax_amount'),
            avg_order=Avg('total_amount')
        )
        summary = {
            "total_sales": float(agg['total_sales'] or 0.0),
            "total_orders": agg['total_orders'] or 0,
            "total_tax": float(agg['total_tax'] or 0.0),
            "avg_order": float(agg['avg_order'] or 0.0)
        }

        # Sales by Payment Mode
        payments_qs = orders.values('payment_mode').annotate(
            total=Sum('total_amount'),
            count=Count('id')
        )
        payments = [
            {
                "payment_mode": p['payment_mode'],
                "total": float(p['total'] or 0.0),
                "count": p['count']
            } for p in payments_qs
        ]

        # Wastage Analysis
        from apps.inventory.models import InventoryTransaction
        waste_filters = {'stock_item__outlet_id': outlet_id}
        if start_date: waste_filters['created_at__date__gte'] = start_date
        if end_date: waste_filters['created_at__date__lte'] = end_date
        
        wastage = InventoryTransaction.objects.filter(
            transaction_type__in=['waste', 'adjustment'],
            **waste_filters
        ).values('stock_item__product__name').annotate(
            total_qty=Sum('quantity'),
            count=Count('id')
        ).order_by('-total_qty')

        # Product Analytics
        items = OrderItem.objects.filter(order__in=orders).values(
            'product__name', 'product_id'
        ).annotate(
            qty=Sum('quantity'),
            total=Sum('item_total')
        ).order_by('-qty')

        if export_mode == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="sales_report_{start_date}_to_{end_date}.csv"'
            writer = csv.writer(response)
            writer.writerow(['Date Range:', f"{start_date} to {end_date}"])
            writer.writerow(['Total Sales:', summary['total_sales']])
            writer.writerow([])
            writer.writerow(['Payment Mode', 'Orders', 'Total Value'])
            for p in payments:
                writer.writerow([p['payment_mode'], p['count'], p['total']])
            writer.writerow([])
            writer.writerow(['Product Name', 'Quantity Sold', 'Revenue'])
            for i in items:
                writer.writerow([i['product__name'], i['qty'], i['total']])
            writer.writerow([])
            writer.writerow(['Wastage Analysis'])
            writer.writerow(['Product Name', 'Total Waste Qty', 'Entry Count'])
            for w in wastage:
                writer.writerow([w['stock_item__product__name'], w['total_qty'], w['count']])
            return response

        return Response({
            "summary": summary,
            "payments": payments,
            "performance": items[:10],
            "dead_stock": items.order_by('qty')[:10],
            "wastage": wastage[:10]
        })
from django.db.models.functions import TruncDate, ExtractHour, ExtractWeekDay

class AdvancedAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        outlet_id = request.query_params.get('outlet_id')
        days = int(request.query_params.get('days', 30))
        
        if not outlet_id:
            outlet_id = getattr(request.user, 'outlet_id', None)
        if not outlet_id:
            return Response({"error": "Outlet required"}, status=400)

        start_date = timezone.now() - timedelta(days=days)
        orders_qs = Order.objects.filter(
            outlet_id=outlet_id, 
            created_at__gte=start_date
        ).exclude(status=OrderStatus.CANCELLED)

        # 1. Peak Hour Heatmap (Day of Week vs Hour)
        heatmap = orders_qs.annotate(
            hour=ExtractHour('created_at'),
            weekday=ExtractWeekDay('created_at')
        ).values('hour', 'weekday').annotate(
            order_count=Count('id'),
            revenue=Sum('total_amount')
        ).order_by('weekday', 'hour')

        # 2. Category Performance Distribution
        category_perf = OrderItem.objects.filter(
            order__in=orders_qs
        ).values(
            'product__category__name'
        ).annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum('item_total')
        ).order_by('-total_revenue')

        # 3. Sales Velocity (Items sold per day)
        velocity = OrderItem.objects.filter(
            order__in=orders_qs
        ).annotate(
            date=TruncDate('order__created_at')
        ).values('date', 'product__name').annotate(
            daily_qty=Sum('quantity')
        ).order_by('-daily_qty')[:15]

        # 4. Payment Velocity (Success rates/volume trends)
        payment_trend = orders_qs.annotate(
            date=TruncDate('created_at')
        ).values('date', 'payment_mode').annotate(
            volume=Sum('total_amount'),
            count=Count('id')
        ).order_by('date')

        return Response({
            "heatmap": heatmap,
            "category_performance": category_perf,
            "top_velocity": velocity,
            "payment_trends": payment_trend
        })
