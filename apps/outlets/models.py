from django.db import models
from apps.core.models import BaseModel

class Outlet(BaseModel):
    name = models.CharField(max_length=255)
    address = models.TextField()
    city = models.CharField(max_length=100)
    gstin = models.CharField(max_length=15, blank=True, null=True)
    fssai_number = models.CharField(max_length=20, blank=True, null=True)
    phone = models.CharField(max_length=15)
    email = models.EmailField()
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')
    operating_hours = models.TextField(default='{}') 
    outlet_code = models.SlugField(unique=True)
    
    # Receipt & Tax Settings
    base_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5.00) # GST 5% by default
    receipt_header = models.TextField(blank=True, null=True)
    receipt_footer = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Outlet"
        verbose_name_plural = "Outlets"

    def __str__(self):
        return f"{self.name} ({self.outlet_code})"
