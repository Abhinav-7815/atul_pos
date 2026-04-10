import json

with open('master_project_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Filter out orders, transactions, and logs which usually cause issues
data = [d for d in data if not d['model'].startswith('orders.') and not d['model'].startswith('inventory.inventorytransaction') and not d['model'].startswith('accounts.useractivity')]

# Gather valid IDs
valid_products = {d['pk'] for d in data if d['model'] == 'menu.product'}
valid_outlets = {d['pk'] for d in data if d['model'] == 'outlets.outlet'}
valid_categories = {d['pk'] for d in data if d['model'] == 'menu.category'}

clean_data = []
for d in data:
    model = d['model']
    fields = d.get('fields', {})
    
    # Check foreign keys
    if model == 'menu.productvariant' and fields.get('product') not in valid_products:
        continue
    if model == 'menu.product' and fields.get('category') not in valid_categories:
        continue
    if model == 'inventory.stockitem' and (fields.get('product') not in valid_products or fields.get('outlet') not in valid_outlets):
        continue
    if model == 'menu.modifier' and fields.get('group') not in {x['pk'] for x in data if x['model'] == 'menu.modifiergroup'}:
        continue
    
    clean_data.append(d)

with open('master_project_data_superclean.json', 'w', encoding='utf-8') as f:
    json.dump(clean_data, f)
print("Cleaned super cleanly!")
