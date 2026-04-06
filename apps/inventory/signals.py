from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.orders.models import Order, OrderStatus
from .models import StockItem, InventoryTransaction

@receiver(post_save, sender=Order)
def sync_stock_on_order_status_change(sender, instance, created, **kwargs):
    """Handle stock deductions and restorations based on order status."""
    
    # 🛒 STOCK DEDUCTION (CONFIRMED)
    if instance.status == OrderStatus.CONFIRMED:
        if InventoryTransaction.objects.filter(reference_id=str(instance.id), transaction_type='sale').exists():
            return

        for item in instance.items.all():
            # Consolidated: Always deduct from the base product's stock (variant=None)
            # This handles cases like 'Loose Ice Cream' where all portion sizes/weights 
            # come from the same bulk stock set in the Inventory page.
            stock, _ = StockItem.objects.get_or_create(
                product=item.product,
                variant=None, # Centralize stock at product level
                outlet=instance.outlet,
                defaults={'quantity': 0}
            )
            stock.quantity -= item.quantity
            stock.save()
            
            InventoryTransaction.objects.create(
                stock_item=stock,
                transaction_type='sale',
                quantity=item.quantity,
                reference_id=str(instance.id),
                notes=f"Order {instance.order_number}"
            )

    # 🔄 STOCK RESTORATION (VOIDED / CANCELLED)
    elif instance.status in [OrderStatus.VOIDED, OrderStatus.CANCELLED]:
        # Only restore if it was previously deducted (i.e., 'sale' transactions exist)
        sales = InventoryTransaction.objects.filter(reference_id=str(instance.id), transaction_type='sale')
        if not sales.exists():
            return
            
        # Avoid double restoration
        if InventoryTransaction.objects.filter(reference_id=str(instance.id), transaction_type='adjustment', notes__icontains='RESTORE').exists():
            return
            
        for sale in sales:
            stock = sale.stock_item
            stock.quantity += sale.quantity
            stock.save()
            
            InventoryTransaction.objects.create(
                stock_item=stock,
                transaction_type='adjustment',
                quantity=sale.quantity,
                reference_id=str(instance.id),
                notes=f"RESTORE from {instance.status.upper()} Order {instance.order_number}"
            )
