import json
from .models import AuditLog

def record_audit(user, action, instance=None, description="", changes=None, ip_address=None):
    """
    Utility to record an audit log entry.
    """
    app_label = ""
    model_name = ""
    object_id = ""
    
    if instance:
        app_label = instance._meta.app_label
        model_name = instance._meta.model_name
        object_id = str(instance.pk)
    
    changes_json = json.dumps(changes or {})
    
    return AuditLog.objects.create(
        user=user,
        action=action,
        app_label=app_label,
        model_name=model_name,
        object_id=object_id,
        description=description,
        changes=changes_json,
        ip_address=ip_address
    )
