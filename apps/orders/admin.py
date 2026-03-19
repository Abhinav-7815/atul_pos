from django.contrib import admin
from .models import Order, OrderItem, Payment

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['item_subtotal', 'item_tax', 'item_total']

class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'outlet', 'order_type', 'status', 'total_amount', 'created_at']
    list_filter = ['status', 'order_type', 'outlet', 'created_at']
    search_fields = ['order_number', 'customer__name', 'customer__phone']
    inlines = [OrderItemInline, PaymentInline]
    readonly_fields = ['order_number', 'subtotal', 'tax_amount', 'total_amount', 'token_number']

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'method', 'amount', 'status', 'created_at']
    list_filter = ['method', 'status', 'created_at']
