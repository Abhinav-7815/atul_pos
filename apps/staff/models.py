from django.db import models
from apps.core.models import BaseModel
from apps.accounts.models import User
from apps.outlets.models import Outlet

class CashierShift(BaseModel):
    cashier = models.ForeignKey(User, on_delete=models.CASCADE, related_name="shifts")
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    closing_balance = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    actual_cash = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.cashier.full_name} @ {self.outlet.name} ({self.start_time.date()})"

class DrawerEntry(BaseModel):
    TYPES = (
        ('cash_in', 'Cash In / Float'),
        ('cash_out', 'Cash Out / Expense'),
    )
    shift = models.ForeignKey(CashierShift, on_delete=models.CASCADE, related_name="drawer_entries")
    entry_type = models.CharField(max_length=10, choices=TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.entry_type}: {self.amount} ({self.reason})"
