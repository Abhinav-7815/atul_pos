from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DistributorOrderViewSet, StockDispatchViewSet, DistributorDashboardView

router = DefaultRouter()
router.register(r'orders',     DistributorOrderViewSet, basename='distributor-orders')
router.register(r'dispatches', StockDispatchViewSet,    basename='stock-dispatches')

urlpatterns = [
    path('',          include(router.urls)),
    path('dashboard/', DistributorDashboardView.as_view(), name='distribution-dashboard'),
]
