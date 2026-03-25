import requests
import json
auth = requests.post('http://localhost:8000/api/v1/auth/login/', json={'pin': '1234'})
token = auth.json().get('access')

# Get categories and products to find a valid product ID
categories = requests.get('http://localhost:8000/api/v1/menu/categories/', headers={'Authorization': f'Bearer {token}'}).json()['data']
products_req = requests.get(f"http://localhost:8000/api/v1/menu/products/?category={categories[0]['id']}", headers={'Authorization': f'Bearer {token}'})
products = products_req.json()['data']

data = {
    'order_type': 'dine_in',
    'table_number': '01',
    'notes': '',
    'payment_mode': 'Cash',
    'items': [{
        'product': products[0]['id'],
        'variant': None,
        'quantity': 1,
        'modifiers': [1] # sending array of ids to simulate frontend
    }]
}

res = requests.post(
    'http://localhost:8000/api/v1/orders/', 
    json=data, 
    headers={'Authorization': f'Bearer {token}'}
)
print('STATUS CODE:', res.status_code)
print('RESPONSE:', res.text)
