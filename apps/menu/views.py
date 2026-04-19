from rest_framework import viewsets, permissions, filters, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Product, ProductVariant, ModifierGroup, Modifier
from .serializers import (
    CategorySerializer, ProductSerializer, ProductVariantSerializer,
    ModifierGroupSerializer, ModifierSerializer
)
from apps.core.permissions import IsSuperAdmin
from apps.accounts.pos_auth import POSTerminalKeyAuthentication, POSTerminalUser


class IsSuperAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        # POS terminal key — read-only access allowed
        if isinstance(request.user, POSTerminalUser):
            return request.method in permissions.SAFE_METHODS
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and (
            request.user.role == 'superadmin' or request.user.is_superuser
        )


class POSAuthMixin:
    def get_authenticators(self):
        from rest_framework_simplejwt.authentication import JWTAuthentication
        return [POSTerminalKeyAuthentication(), JWTAuthentication()]


class CategoryViewSet(POSAuthMixin, viewsets.ModelViewSet):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = CategorySerializer

    def get_queryset(self):
        # Prefetch products and their related data to avoid N+1 queries during serialization
        return Category.objects.filter(is_active=True).order_by('display_order').prefetch_related(
            'products__variants',
            'products__modifier_groups__modifiers',
            'products__outlet_statuses'
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        context['outlet'] = user.outlet if user.is_authenticated and hasattr(user, 'outlet') else None
        return context

    def destroy(self, request, *args, **kwargs):
        """
        Custom delete method for categories with safe product handling.
        Soft deletes the category and moves products to 'Uncategorized' (null category).
        """
        instance = self.get_object()

        # Check if category has products
        active_products = instance.products.filter(is_active=True)
        product_count = active_products.count()

        if product_count > 0:
            # Move products to "Uncategorized" (set category to null)
            # This preserves the products instead of deleting them
            for product in active_products:
                product.category = None
                product.save()

        # Soft delete the category (uses BaseModel's soft delete)
        instance.delete()

        return Response(
            {
                'status': 'success',
                'message': f'Category "{instance.name}" deleted successfully.',
                'products_moved_to_uncategorized': product_count,
                'note': 'Products have been moved to Uncategorized and remain active.'
            },
            status=status.HTTP_200_OK
        )


class ProductViewSet(POSAuthMixin, viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsSuperAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category']
    search_fields = ['name', 'description']

    def get_queryset(self):
        user = self.request.user
        
        # Base query with optimized fetches
        base_qs = Product.objects.filter(is_active=True).select_related('category').prefetch_related(
            'variants__outlet_statuses', 
            'modifier_groups__modifiers',
            'outlet_statuses'
        )

        if not user.is_authenticated or not hasattr(user, 'outlet'):
            return base_qs.filter(outlet=None)

        if user.role == 'superadmin' or user.is_superuser:
            return base_qs

        outlet = user.outlet
        from django.db.models import Q
        return base_qs.filter(Q(outlet=None) | Q(outlet=outlet))

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        context['outlet'] = user.outlet if user.is_authenticated and hasattr(user, 'outlet') else None
        return context

class ProductVariantViewSet(viewsets.ModelViewSet):
    queryset = ProductVariant.objects.all()
    serializer_class = ProductVariantSerializer
    permission_classes = [IsSuperAdminOrReadOnly]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        context['outlet'] = user.outlet if user.is_authenticated and hasattr(user, 'outlet') else None
        return context

class ModifierGroupViewSet(viewsets.ModelViewSet):
    queryset = ModifierGroup.objects.all()
    serializer_class = ModifierGroupSerializer
    permission_classes = [IsSuperAdminOrReadOnly]

class ModifierViewSet(viewsets.ModelViewSet):
    queryset = Modifier.objects.all()
    serializer_class = ModifierSerializer
    permission_classes = [IsSuperAdminOrReadOnly]

