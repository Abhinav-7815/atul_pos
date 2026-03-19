from django.db import models, transaction
from django.utils import timezone
from django.conf import settings
from decimal import Decimal

from apps.core.models import BaseModel
from apps.outlets.models import Outlet
from apps.menu.models import Product, ProductVariant


class DistributorOrderStatus(models.TextChoices):
    DRAFT       = 'draft',       'Draft'
    SUBMITTED   = 'submitted',   'Submitted'
    APPROVED    = 'approved',    'Approved'
    PROCESSING  = 'processing',  'Processing'
    DISPATCHED  = 'dispatched',  'Dispatched'
    DELIVERED   = 'delivered',   'Delivered'
    CANCELLED   = 'cancelled',   'Cancelled'


class DistributorOrder(BaseModel):
    """
    An order placed by a distributor outlet to the main branch (HQ).
    Lifecycle: draft → submitted → approved → processing → dispatched → delivered
    """
    order_number        = models.CharField(max_length=60, unique=True, editable=False)
    distributor_outlet  = models.ForeignKey(
        Outlet, on_delete=models.CASCADE,
        related_name='distribution_orders_placed',
        help_text='The distributor who placed this order.',
    )
    fulfilled_by_outlet = models.ForeignKey(
        Outlet, on_delete=models.CASCADE,
        related_name='distribution_orders_received',
        help_text='The main branch fulfilling this order.',
    )
    status              = models.CharField(
        max_length=20, choices=DistributorOrderStatus.choices,
        default=DistributorOrderStatus.DRAFT,
    )
    subtotal            = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount_amount     = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_amount        = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    notes               = models.TextField(blank=True, null=True)
    expected_delivery_date = models.DateField(null=True, blank=True)

    # Status timestamps
    submitted_at  = models.DateTimeField(null=True, blank=True)
    approved_at   = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Distributor Order'
        verbose_name_plural = 'Distributor Orders'

    def __str__(self):
        return f"{self.order_number} — {self.distributor_outlet.name}"

    def generate_order_number(self):
        today = timezone.now().strftime('%Y%m%d')
        prefix = f"DO-{today}"
        with transaction.atomic():
            last = (
                DistributorOrder.all_objects
                .filter(order_number__startswith=prefix)
                .order_by('order_number')
                .last()
            )
            seq = int(last.order_number.split('-')[-1]) + 1 if last else 1
            return f"{prefix}-{str(seq).zfill(4)}"

    def recalculate_totals(self):
        items = self.items.all()
        self.subtotal       = sum(i.subtotal for i in items)
        discount_pct        = self.distributor_outlet.distributor_discount_pct
        self.discount_amount = (self.subtotal * discount_pct / Decimal('100'))
        self.total_amount   = self.subtotal - self.discount_amount
        self.save(update_fields=['subtotal', 'discount_amount', 'total_amount'])

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self.generate_order_number()
        super().save(*args, **kwargs)


class DistributorOrderItem(BaseModel):
    """A single product line on a DistributorOrder."""
    distributor_order = models.ForeignKey(
        DistributorOrder, on_delete=models.CASCADE, related_name='items',
    )
    product  = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant  = models.ForeignKey(
        ProductVariant, on_delete=models.SET_NULL, null=True, blank=True,
    )
    quantity    = models.DecimalField(max_digits=10, decimal_places=2)
    # unit_price is snapshotted from Product.base_price at order creation time
    unit_price  = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal    = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = 'Distributor Order Item'
        verbose_name_plural = 'Distributor Order Items'

    def __str__(self):
        return f"{self.distributor_order.order_number}: {self.product.name} × {self.quantity}"

    def save(self, *args, **kwargs):
        self.subtotal = self.unit_price * self.quantity
        super().save(*args, **kwargs)


class StockDispatch(BaseModel):
    """
    Records a physical shipment from the main branch to the distributor.
    Created when the main branch marks a DistributorOrder as 'dispatched'.
    One order can have multiple partial dispatches (future enhancement),
    but the MVP creates exactly one dispatch per order.
    """
    distributor_order = models.ForeignKey(
        DistributorOrder, on_delete=models.CASCADE, related_name='dispatches',
    )
    dispatch_number = models.CharField(max_length=60, unique=True, editable=False)
    dispatched_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='dispatches_made',
    )
    vehicle_number  = models.CharField(max_length=30, blank=True, null=True)
    driver_name     = models.CharField(max_length=100, blank=True, null=True)
    notes           = models.TextField(blank=True, null=True)
    is_received     = models.BooleanField(default=False)
    received_at     = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Stock Dispatch'
        verbose_name_plural = 'Stock Dispatches'

    def __str__(self):
        return f"{self.dispatch_number}"

    def generate_dispatch_number(self):
        today = timezone.now().strftime('%Y%m%d')
        prefix = f"DSP-{today}"
        with transaction.atomic():
            last = (
                StockDispatch.all_objects
                .filter(dispatch_number__startswith=prefix)
                .order_by('dispatch_number')
                .last()
            )
            seq = int(last.dispatch_number.split('-')[-1]) + 1 if last else 1
            return f"{prefix}-{str(seq).zfill(4)}"

    def save(self, *args, **kwargs):
        if not self.dispatch_number:
            self.dispatch_number = self.generate_dispatch_number()
        super().save(*args, **kwargs)
