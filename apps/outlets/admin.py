from django.contrib import admin
from .models import Outlet

@admin.register(Outlet)
class OutletAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'outlet_code', 'is_active')
    search_fields = ('name', 'outlet_code', 'city')
    list_filter = ('city', 'is_active')
