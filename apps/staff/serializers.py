from rest_framework import serializers
from .models import CashierShift, DrawerEntry

class DrawerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = DrawerEntry
        fields = '__all__'

class CashierShiftSerializer(serializers.ModelSerializer):
    drawer_entries = DrawerEntrySerializer(many=True, read_only=True)
    
    class Meta:
        model = CashierShift
        fields = '__all__'
        read_only_fields = ('cashier', 'outlet', 'start_time', 'end_time', 'is_active')
