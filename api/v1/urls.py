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
from apps.accounts.auth_views import LoginView, OutletSwitchView, QZSignView, POSKeyListCreateView, POSKeyDetailView
from rest_framework_simplejwt.views import TokenRefreshView
from apps.core.exe_views import (
    EXEOutletView, EXEOrderListView, EXEOrderDetailView,
    EXEStockListView, EXEStockDetailView, EXEStockAdjustView,
    EXETransactionListView, APIKeyManageView, APIKeyRevokeView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'outlets', OutletViewSet)
router.register(r'orders', OrderViewSet, basename='orders')

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

    path('accounts/', include('apps.accounts.urls_advanced')),

    # Auth Endpoints
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/outlet-switch/', OutletSwitchView.as_view(), name='outlet_switch'),
    path('auth/qz-sign/', QZSignView.as_view(), name='qz_sign'),

    # POS Terminal Key Management (JWT auth)
    path('auth/pos-keys/', POSKeyListCreateView.as_view(), name='pos_keys'),
    path('auth/pos-keys/<int:pk>/', POSKeyDetailView.as_view(), name='pos_key_detail'),

    # EXE / External Integration API (API Key secured)
    path('exe/outlet/',                EXEOutletView.as_view(),          name='exe_outlet'),
    path('exe/orders/',                EXEOrderListView.as_view(),       name='exe_orders'),
    path('exe/orders/<uuid:pk>/',      EXEOrderDetailView.as_view(),     name='exe_order_detail'),
    path('exe/stocks/',                EXEStockListView.as_view(),       name='exe_stocks'),
    path('exe/stocks/<uuid:pk>/',      EXEStockDetailView.as_view(),     name='exe_stock_detail'),
    path('exe/stocks/adjust/',         EXEStockAdjustView.as_view(),     name='exe_stocks_adjust'),
    path('exe/transactions/',          EXETransactionListView.as_view(), name='exe_transactions'),

    # API Key management (JWT superadmin only)
    path('exe/keys/',                  APIKeyManageView.as_view(),       name='exe_keys'),
    path('exe/keys/<uuid:pk>/revoke/', APIKeyRevokeView.as_view(),       name='exe_keys_revoke'),
]
