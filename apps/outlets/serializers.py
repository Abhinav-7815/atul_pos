from rest_framework import serializers
from .models import Outlet


class OutletSerializer(serializers.ModelSerializer):
    manager      = serializers.SerializerMethodField()
    staff_count  = serializers.SerializerMethodField()
    branch_type_display = serializers.SerializerMethodField()
    outlet_type_display = serializers.SerializerMethodField()

    class Meta:
        model  = Outlet
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']

    def get_manager(self, obj):
        mgr = obj.staff.filter(
            role__in=['owner', 'outlet_manager', 'distributor'], is_active=True
        ).first()
        if mgr:
            return {
                'id':        str(mgr.id),
                'full_name': mgr.full_name,
                'email':     mgr.email,
                'role':      mgr.role,
                'phone':     mgr.phone or '',
            }
        return None

    def get_staff_count(self, obj):
        return obj.staff.count()

    def get_branch_type_display(self, obj):
        return obj.get_branch_type_display() if obj.branch_type else None

    def get_outlet_type_display(self, obj):
        return obj.get_outlet_type_display()
