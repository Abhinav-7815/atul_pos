from django.test import TestCase
from django.utils import timezone
from apps.outlets.models import Outlet
from apps.menu.models import Category, Product, ProductVariant
from apps.orders.models import Order, OrderItem, OrderType, OrderStatus
from decimal import Decimal

class OrderBusinessLogicTest(TestCase):
    def setUp(self):
        self.outlet = Outlet.objects.create(
            name="Test Outlet",
            outlet_code="TEST-01"
        )
        self.category = Category.objects.create(name="Ice Cream")
        self.product = Product.objects.create(
            category=self.category,
            name="Vanilla",
            base_price=Decimal("100.00"),
            tax_rate=Decimal("5.00") # 5% GST
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            name="Large",
            price_delta=Decimal("50.00")
        )

    def test_order_number_generation(self):
        order1 = Order.objects.create(outlet=self.outlet)
        order2 = Order.objects.create(outlet=self.outlet)
        
        today = timezone.now().strftime('%Y%m%d')
        self.assertTrue(order1.order_number.startswith(f"ORD-{today}-0001"))
        self.assertTrue(order2.order_number.startswith(f"ORD-{today}-0002"))

    def test_token_number_for_takeaway(self):
        order1 = Order.objects.create(outlet=self.outlet, order_type=OrderType.TAKEAWAY)
        order2 = Order.objects.create(outlet=self.outlet, order_type=OrderType.TAKEAWAY)
        order3 = Order.objects.create(outlet=self.outlet, order_type=OrderType.DINE_IN)
        
        self.assertEqual(order1.token_number, 1)
        self.assertEqual(order2.token_number, 2)
        self.assertIsNone(order3.token_number)

    def test_order_item_price_calculation(self):
        # Base price (100) + Variant delta (50) + Modifiers (20) = 170
        modifiers = [{"id": 1, "name": "Choco chips", "price_delta": 20.00}]
        item = OrderItem.objects.create(
            order=Order.objects.create(outlet=self.outlet),
            product=self.product,
            variant=self.variant,
            quantity=2,
            modifiers=modifiers
        )
        
        expected_unit_price = Decimal("170.00")
        self.assertEqual(item.unit_price, expected_unit_price)
        self.assertEqual(item.item_subtotal, expected_unit_price * 2) # 340
        self.assertEqual(item.item_tax, Decimal("17.00")) # 5% of 340
        self.assertEqual(item.item_total, Decimal("357.00"))

    def test_order_totals_calculation(self):
        order = Order.objects.create(outlet=self.outlet)
        
        OrderItem.objects.create(
            order=order,
            product=self.product,
            quantity=1, # 100 + 5% = 105
            unit_price=Decimal("100.00"),
            tax_rate=Decimal("5.00")
        )
        
        OrderItem.objects.create(
            order=order,
            product=self.product,
            quantity=2, # (100*2) + 5% = 210
            unit_price=Decimal("100.00"),
            tax_rate=Decimal("5.00")
        )
        
        order.refresh_from_db()
        self.assertEqual(order.subtotal, Decimal("300.00"))
        self.assertEqual(order.tax_amount, Decimal("15.00"))
        self.assertEqual(order.total_amount, Decimal("315.00"))

    def test_packaged_good_tax(self):
        packaged_product = Product.objects.create(
            category=self.category,
            name="Bottled Water",
            base_price=Decimal("20.00"),
            is_packaged_good=True
        )
        item = OrderItem.objects.create(
            order=Order.objects.create(outlet=self.outlet),
            product=packaged_product,
            quantity=1
        )
        self.assertEqual(item.tax_rate, Decimal("12.00"))
        self.assertEqual(item.item_tax, Decimal("2.40")) # 12% of 20

