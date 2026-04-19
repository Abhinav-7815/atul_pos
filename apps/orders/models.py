from django.db import models, transaction
from django.utils import timezone
from apps.core.models import BaseModel
from apps.outlets.models import Outlet
from apps.menu.models import Product, ProductVariant
from django.conf import settings
from django.db.models import Max
from decimal import Decimal

class OrderType(models.TextChoices):
    DINE_IN = 'dine_in', 'Dine-In'
    TAKEAWAY = 'takeaway', 'Takeaway'
    DELIVERY = 'delivery', 'Delivery'
    PARCEL = 'parcel', 'Parcel'
    DRIVE_THROUGH = 'drive_through', 'Drive-Through'

class OrderStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    CONFIRMED = 'confirmed', 'Confirmed'
    PREPARING = 'preparing', 'Preparing'
    READY = 'ready', 'Ready'
    SERVED = 'served', 'Served'
    CANCELLED = 'cancelled', 'Cancelled'
    VOIDED = 'voided', 'Voided'

class Order(BaseModel):
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name="orders")
    order_number = models.CharField(max_length=50, unique=True, editable=False)
    order_type = models.CharField(max_length=20, choices=OrderType.choices, default=OrderType.DINE_IN)
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.DRAFT)
    customer = models.ForeignKey('customers.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name="orders")
    table_number = models.CharField(max_length=20, null=True, blank=True)
    token_number = models.PositiveIntegerField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.order_number

    def generate_order_number(self):
        """Generates a unique order number with daily sequence and collision retry."""
        today = timezone.now().strftime('%Y%m%d')
        prefix = f"ORD-{today}"
        
        # We try up to 10 times to find a unique sequence number
        # This handles cases where manual deletes or race conditions occur
        for _ in range(10):
            with transaction.atomic():
                last_order = Order.objects.filter(
                    outlet=self.outlet,
                    order_number__startswith=prefix
                ).order_by('order_number').last()

                if last_order:
                    try:
                        last_seq = int(last_order.order_number.split('-')[-1])
                        new_seq = last_seq + 1
                    except (ValueError, IndexError):
                        # If format is corrupted, fall back to record count
                        new_seq = Order.objects.filter(outlet=self.outlet, order_number__startswith=prefix).count() + 1
                else:
                    new_seq = 1
                
                new_number = f"{prefix}-{str(new_seq).zfill(4)}"
                
                # Double check uniqueness before returning
                if not Order.objects.filter(order_number=new_number).exists():
                    return new_number
        
        # Absolute fallback: timestamp based
        return f"{prefix}-{int(timezone.now().timestamp())}"

    def generate_token_number(self):
        if self.order_type != OrderType.TAKEAWAY:
            return None
            
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        last_token = Order.all_objects.filter(
            outlet=self.outlet,
            created_at__gte=today_start
        ).aggregate(Max('token_number'))['token_number__max']
        
        return (last_token or 0) + 1

    def calculate_totals(self):
        items = self.items.all()
        self.subtotal = sum(item.item_subtotal for item in items)
        self.tax_amount = sum(item.item_tax for item in items)
        self.total_amount = (self.subtotal + self.tax_amount) - self.discount_amount
        self.save()

    def deduct_inventory(self):
        """Reduces stock levels for all items in the order."""
        from apps.inventory.models import StockItem, InventoryTransaction
        import re

        with transaction.atomic():
            for item in self.items.all():
                # 1. Try to find variant-specific stock
                stock = StockItem.objects.filter(
                    product=item.product,
                    variant=item.variant,
                    outlet=self.outlet
                ).first()

                # 2. Fallback to product bulk stock
                if not stock and item.variant:
                    stock = StockItem.objects.filter(
                        product=item.product,
                        variant=None,
                        outlet=self.outlet
                    ).first()

                if stock:
                    # Idempotency check: Ensure this specific item in this specific order hasn't been deducted yet
                    item_ref = f"Item:{item.id}"
                    if InventoryTransaction.objects.filter(
                        stock_item=stock,
                        transaction_type='sale',
                        reference_id=self.order_number,
                        notes__contains=item_ref
                    ).exists():
                        continue

                    qty_to_deduct = item.quantity
                    
                    # Heuristic for variant conversion (e.g. 500gm -> 0.5kg)
                    # This assumes the base stock quantity is kept in KG
                    if stock.variant is None and item.variant:
                        v_name = item.variant.name.lower()
                        match = re.search(r'(\d+)\s*(gm|g\b)', v_name)
                        if match:
                            grams = float(match.group(1))
                            qty_to_deduct = Decimal(str(grams / 1000.0)) * item.quantity
                        elif '1kg' in v_name or '1 kg' in v_name or '1000g' in v_name:
                            qty_to_deduct = Decimal('1.00') * item.quantity

                    stock.quantity -= qty_to_deduct
                    stock.save()

                    InventoryTransaction.objects.create(
                        stock_item=stock,
                        transaction_type='sale',
                        quantity=qty_to_deduct,
                        reference_id=self.order_number,
                        notes=f"Order {self.order_number} auto-deduction [{item_ref}]"
                    )

    def restore_inventory(self):
        """Restores stock levels (used for voided/cancelled orders)."""
        from apps.inventory.models import StockItem, InventoryTransaction
        import re

        with transaction.atomic():
            for item in self.items.all():
                # Logic is reverse of deduct_inventory
                stock = StockItem.objects.filter(product=item.product, variant=item.variant, outlet=self.outlet).first()
                if not stock and item.variant:
                    stock = StockItem.objects.filter(product=item.product, variant=None, outlet=self.outlet).first()
                
                if stock:
                    qty_to_restore = item.quantity
                    if stock.variant is None and item.variant:
                        v_name = item.variant.name.lower()
                        match = re.search(r'(\d+)\s*(gm|g\b)', v_name)
                        if match:
                            grams = float(match.group(1))
                            qty_to_restore = Decimal(str(grams / 1000.0)) * item.quantity
                        elif '1kg' in v_name or '1 kg' in v_name or '1000g' in v_name:
                            qty_to_restore = Decimal('1.00') * item.quantity

                    stock.quantity += qty_to_restore
                    stock.save()

                    InventoryTransaction.objects.create(
                        stock_item=stock,
                        transaction_type='adjustment',
                        quantity=qty_to_restore,
                        reference_id=self.order_number,
                        notes=f"Order {self.order_number} void/cancel restoration"
                    )

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_status = None
        if not is_new:
            try:
                old_info = Order.objects.get(pk=self.pk)
                old_status = old_info.status
            except Order.DoesNotExist:
                pass

        if not self.order_number:
            self.order_number = self.generate_order_number()
        if not self.token_number and self.order_type == OrderType.TAKEAWAY:
            self.token_number = self.generate_token_number()
        
        super().save(*args, **kwargs)

        # Inventory logic upon status change
        if not is_new and old_status != self.status:
            # 1. Deduct when moving out of DRAFT to active status
            if self.status in [OrderStatus.CONFIRMED, OrderStatus.SERVED] and old_status == OrderStatus.DRAFT:
                self.deduct_inventory()
            
            # 2. Restore when moving to VOIDED/CANCELLED from an active status
            elif self.status in [OrderStatus.VOIDED, OrderStatus.CANCELLED]:
                if old_status in [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED]:
                    self.restore_inventory()

class ItemStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    PREPARING = 'preparing', 'Preparing'
    READY = 'ready', 'Ready'

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1.00'))
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2)
    item_subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    item_tax = models.DecimalField(max_digits=10, decimal_places=2)
    item_total = models.DecimalField(max_digits=10, decimal_places=2)
    modifiers = models.TextField(default='[]', blank=True) # Changed from JSONField for SQLite compatibility
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=ItemStatus.choices, default=ItemStatus.PENDING)

    def calculate_item_price(self):
        """Calculates price based on current product/variant/modifiers snapshot info if needed,
        but usually this is called before saving to populate fields."""
        price = self.product.base_price
        if self.variant:
            price += self.variant.price_delta
        
        # Add modifier prices from the JSON list
        # Expected format: [{"id": 1, "name": "Sprinkles", "price_delta": 20}]
        import json
        try:
            mods = json.loads(self.modifiers) if isinstance(self.modifiers, str) else self.modifiers
            modifier_total = sum(Decimal(str(m.get('price_delta', 0))) for m in mods)
        except:
            modifier_total = Decimal('0.00')
        price += modifier_total
        return price

    def save(self, *args, **kwargs):
        if not self.unit_price:
            self.unit_price = self.calculate_item_price()
        
        if not self.tax_rate:
            if self.product.is_packaged_good:
                self.tax_rate = Decimal('12.00')
            else:
                self.tax_rate = Decimal('5.00')

        self.item_total = self.unit_price * self.quantity
        # Inclusive Tax: price already includes GST
        # tax = total - (total / (1 + rate/100))
        rate = self.tax_rate / Decimal('100.00')
        self.item_tax = (self.item_total - (self.item_total / (1 + rate))).quantize(Decimal('0.01'))
        self.item_subtotal = self.item_total - self.item_tax
        
        super().save(*args, **kwargs)
        # Trigger order total recalculation
        self.order.calculate_totals()

class PaymentMethod(models.TextChoices):
    CASH = 'cash', 'Cash'
    UPI = 'upi', 'UPI'
    CARD = 'card', 'Card'
    LOYALTY = 'loyalty_points', 'Loyalty Points'
    WALLET = 'wallet', 'Wallet'
    COUPON = 'coupon', 'Coupon'
    CORPORATE = 'corporate_credit', 'Corporate Credit'

class PaymentStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'
    REFUNDED = 'refunded', 'Refunded'

class Payment(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="payments")
    method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reference_number = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    gateway_response = models.TextField(default='{}', blank=True) # Changed from JSONField for SQLite compatibility
    tendered_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), null=True, blank=True)
    change_returned = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), null=True, blank=True)

    def __str__(self):
        return f"{self.method} - {self.amount} ({self.status})"
