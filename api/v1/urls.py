import django.urls
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from apps.accounts.views import UserViewSet
from apps.outlets.views import OutletViewSet
from apps.menu.views import (
    CategoryViewSet, ProductViewSet, ProductVariantViewSet, 
    ModifierGroupViewSet, ModifierViewSet
)
from apps.orders.views import OrderViewSet
from apps.accounts.auth_views import LoginView, OutletSwitchView
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'outlets', OutletViewSet)
router.register(r'orders', OrderViewSet, basename='orders')

# Menu specific nesting
menu_router = DefaultRouter()
menu_router.register(r'categories', CategoryViewSet, basename='menu-categories')
menu_router.register(r'products', ProductViewSet, basename='menu-products')
menu_router.register(r'variants', ProductVariantViewSet, basename='menu-variants')
menu_router.register(r'modifier-groups', ModifierGroupViewSet, basename='menu-modifier-groups')
menu_router.register(r'modifiers', ModifierViewSet, basename='menu-modifiers')

urlpatterns = [
    path('', include(router.urls)),
    path('menu/', include(menu_router.urls)),
    path('analytics/', include('apps.analytics.urls')),
    path('staff/', include('apps.staff.urls')),
    path('inventory/', include('apps.inventory.urls')),
    path('customers/',    include('apps.customers.urls')),
    path('distribution/', include('apps.distribution.urls')),

    # Auth Endpoints
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/outlet-switch/', OutletSwitchView.as_view(), name='outlet_switch'),
]
