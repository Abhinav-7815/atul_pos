from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.outlets.models import Outlet
from apps.menu.models import Category, Product, ProductVariant, ModifierGroup, Modifier
import uuid

User = get_user_model()

class AtulPOSTestCase(TestCase):
    def setUp(self):
        # Create a test outlet
        self.outlet = Outlet.objects.create(
            name="Vastrapur Outlet",
            address="Ahmedabad",
            city="Ahmedabad",
            phone="1234567890",
            email="vastrapur@atul.com",
            outlet_code="VAST-01"
        )
        
        # Create a test user
        self.user = User.objects.create_user(
            email="cashier@atul.com",
            password="testpassword",
            full_name="Test Cashier",
            role="cashier",
            outlet=self.outlet
        )

    def test_base_model_soft_delete(self):
        """Test that soft delete works correctly on Outlet (BaseModel)"""
        self.outlet.delete()
        self.assertIsNotNone(self.outlet.deleted_at)
        self.assertFalse(self.outlet.is_active)
        self.assertEqual(Outlet.objects.count(), 0)  # Filtered by SoftDeleteManager
        self.assertEqual(Outlet.all_objects.count(), 1)  # All objects manager should see it

    def test_menu_hierarchy(self):
        """Test Product, Variant and Modifier creation"""
        category = Category.objects.create(name="Scoops", icon_emoji="🍨")
        product = Product.objects.create(
            category=category,
            name="Belgian Chocolate",
            base_price=240,
        )
        variant = ProductVariant.objects.create(
            product=product,
            name="Regular",
            price_delta=0
        )
        mod_group = ModifierGroup.objects.create(name="Toppings")
        mod_group.product.add(product)
        modifier = Modifier.objects.create(
            group=mod_group,
            name="Sprinkles",
            price_delta=20
        )

        self.assertEqual(product.variants.count(), 1)
        self.assertEqual(product.modifier_groups.count(), 1)
        self.assertEqual(mod_group.modifiers.count(), 1)

    def test_user_uuid_and_role(self):
        """Test User UUID generation and role assignment"""
        self.assertIsInstance(self.user.id, uuid.UUID)
        self.assertEqual(self.user.role, "cashier")
        self.assertEqual(self.user.outlet, self.outlet)
