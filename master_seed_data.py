import os
import sys
import django
from django.core.management import call_command

def setup_django():
    sys.path.append(os.getcwd())
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
    django.setup()

def dump_data(filename):
    print(f"📦 Exporting current data to {filename}...")
    with open(filename, 'w', encoding='utf-8') as f:
        call_command(
            'dumpdata',
            natural_foreign=True,
            natural_primary=True,
            exclude=[
                'contenttypes', 
                'auth.Permission', 
                'admin.logentry', 
                'sessions', 
                # Avoid exporting auth.User if you have a custom user model or just exclude specific tables that cause collisions
            ],
            indent=4,
            stdout=f
        )
    print("✅ Export complete!")

def load_data(filename):
    if not os.path.exists(filename):
        print(f"❌ Error: Backup file '{filename}' not found.")
        sys.exit(1)
        
    print(f"🚀 Loading data from {filename}...")
    try:
        call_command('loaddata', filename)
        print("\n✨ Master data successfully loaded! All data restored.")
    except Exception as e:
        print(f"\n❌ Error loading master data: {e}")
        print("\nTry migrating first: python3 manage.py migrate")


if __name__ == '__main__':
    setup_django()
    
    action = sys.argv[1] if len(sys.argv) > 1 else None
    filename = 'master_project_data.json'
    
    if action == 'export':
        dump_data(filename)
    elif action == 'import':
        load_data(filename)
    else:
        print("Usage:")
        print("  python3 master_seed_data.py export   -> Exports all database data to master_project_data.json")
        print("  python3 master_seed_data.py import   -> Imports data from master_project_data.json into the DB")
        print("\nTo load data into another cloned folder:")
        print("  1. Run `python3 master_seed_data.py export` here.")
        print("  2. Copy `master_project_data.json` to the other folder.")
        print("  3. Run `python3 master_seed_data.py import` in the other folder.")
