from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Product, ProductVariant, ModifierGroup, Modifier
from .serializers import (
    CategorySerializer, ProductSerializer, ProductVariantSerializer, 
    ModifierGroupSerializer, ModifierSerializer
)
from apps.core.permissions import IsSuperAdmin

class IsSuperAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and (
            request.user.role == 'superadmin' or request.user.is_superuser
        )

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.filter(is_active=True).order_by('display_order')
    serializer_class = CategorySerializer
    permission_classes = [IsSuperAdminOrReadOnly]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        context['outlet'] = user.outlet if user.is_authenticated and hasattr(user, 'outlet') else None
        return context


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsSuperAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category']
    search_fields = ['name', 'description']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not hasattr(user, 'outlet'):
             # For unauthenticated or users without outlet, show global products
            return Product.objects.filter(outlet=None, is_active=True)

        if user.role == 'superadmin' or user.is_superuser:
            # Super admins see everything
            return Product.objects.filter(is_active=True).prefetch_related(
                'variants', 
                'modifier_groups__modifiers',
                'outlet_statuses'
            )

        outlet = user.outlet
        from django.db.models import Q
        return Product.objects.filter(
            Q(outlet=None) | Q(outlet=outlet),
            is_active=True
        ).prefetch_related(
            'variants', 
            'modifier_groups__modifiers',
            'outlet_statuses'
        )

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

