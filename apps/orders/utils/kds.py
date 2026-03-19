from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

def broadcast_to_kds(order):
    """
    Broadcast order updates to KDS group for the specific outlet.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    # Prepare order data for KDS
    # We use a simple representation here
    order_data = {
        'id': order.id,
        'order_number': order.order_number,
        'order_type': order.order_type,
        'table_number': order.table_number,
        'token_number': order.token_number,
        'status': order.status,
        'created_at': order.created_at.isoformat(),
        'items': [
            {
                'id': item.id,
                'name': item.product.name,
                'variant': item.variant.name if item.variant else None,
                'quantity': item.quantity,
                'notes': item.notes,
                'status': item.status
            } for item in order.items.all()
        ]
    }

    async_to_sync(channel_layer.group_send)(
        f'kds_{order.outlet.id}',
        {
            'type': 'order_update',
            'message': order_data
        }
    )
