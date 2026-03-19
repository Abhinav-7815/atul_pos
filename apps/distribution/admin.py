from django.contrib import admin
from .models import DistributorOrder, DistributorOrderItem, StockDispatch


class DistributorOrderItemInline(admin.TabularInline):
    model  = DistributorOrderItem
    extra  = 0
    fields = ('product', 'variant', 'quantity', 'unit_price', 'subtotal')
    readonly_fields = ('subtotal',)


@admin.register(DistributorOrder)
class DistributorOrderAdmin(admin.ModelAdmin):
    list_display  = ('order_number', 'distributor_outlet', 'status', 'total_amount', 'created_at')
    list_filter   = ('status', 'distributor_outlet')
    search_fields = ('order_number', 'distributor_outlet__name')
    inlines       = [DistributorOrderItemInline]
    readonly_fields = ('order_number', 'subtotal', 'discount_amount', 'total_amount',
                       'submitted_at', 'approved_at', 'dispatched_at', 'delivered_at')


@admin.register(StockDispatch)
class StockDispatchAdmin(admin.ModelAdmin):
    list_display  = ('dispatch_number', 'distributor_order', 'vehicle_number', 'driver_name', 'is_received')
    list_filter   = ('is_received',)
    search_fields = ('dispatch_number', 'distributor_order__order_number')
    readonly_fields = ('dispatch_number',)
