import sys
import os
import django
import json

# Setup django
sys.path.append(r'c:\Abhinav Projects\atul_pos')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.accounts.models import User
from apps.orders.serializers import OrderSerializer
from apps.menu.models import Product
from django.test import RequestFactory
from rest_framework.request import Request

user = User.objects.get(username='admin')
product = Product.objects.first()

data = {
    'order_type': 'dine_in',
    'table_number': '01',
    'notes': '',
    'payment_mode': 'Cash',
    'items': [{
        'product': str(product.id),
        'variant': None,
        'quantity': 1.0,
        'modifiers': []
    }]
}

factory = RequestFactory()
req = factory.post('/api/v1/orders/', data, content_type='application/json')
req.user = user
drf_req = Request(req)

serializer = OrderSerializer(data=data, context={'request': drf_req})
if serializer.is_valid():
    order = serializer.save()
    print("ORDER CREATED ID:", order.id)
    print("SERIALIZER DATA:", serializer.data)
else:
    print("ERRORS:", serializer.errors)
