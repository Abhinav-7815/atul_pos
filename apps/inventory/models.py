from django.db import models
from apps.core.models import BaseModel
from apps.menu.models import Product, ProductVariant
from apps.outlets.models import Outlet

class StockItem(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stocks")
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, null=True, blank=True)
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    min_threshold = models.DecimalField(max_digits=10, decimal_places=2, default=5.00)
    
    class Meta:
        unique_together = ('product', 'variant', 'outlet')

    def __str__(self):
        return f"{self.product.name} ({self.quantity})"

class InventoryTransaction(BaseModel):
    TYPES = (
        ('purchase', 'Purchase Order'),
        ('sale', 'Sale Deduction'),
        ('adjustment', 'Manual Adjustment'),
        ('transfer', 'Inter-outlet Transfer'),
        ('waste',     'Wastage Buffer'),
        ('dispatch',  'Distribution Dispatch'),
    )
    stock_item = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name="transactions")
    transaction_type = models.CharField(max_length=20, choices=TYPES)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    reference_id = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

class Supplier(BaseModel):
    name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    gstin = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        return self.name

class PurchaseOrder(BaseModel):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('ordered', 'Ordered'),
        ('received', 'Received'),
        ('cancelled', 'Cancelled'),
    )
    po_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="purchase_orders")
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE)
    order_date = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.po_number

class PurchaseOrderItem(BaseModel):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.purchase_order.po_number}: {self.product.name}"
