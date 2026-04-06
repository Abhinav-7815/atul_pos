from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InventoryViewSet, SupplierViewSet, PurchaseOrderViewSet, TransactionViewSet

router = DefaultRouter()
router.register(r'stocks', InventoryViewSet, basename='stocks')
router.register(r'suppliers', SupplierViewSet, basename='suppliers')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-orders')
router.register(r'transactions', TransactionViewSet, basename='transactions')

urlpatterns = [
    path('', include(router.urls)),
]
