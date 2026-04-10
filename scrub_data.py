import json

with open('master_project_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Filter out orders and problematic relations
filtered_data = [d for d in data if not d['model'].startswith('orders.') and not d['model'].startswith('inventory.transaction')]

with open('master_project_data_clean.json', 'w', encoding='utf-8') as f:
    json.dump(filtered_data, f)
