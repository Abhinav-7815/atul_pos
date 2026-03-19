from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer
from apps.core.permissions import IsCashier

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.filter(is_active=True).order_by('display_order')
    serializer_class = CategorySerializer
    permission_classes = [IsCashier]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['outlet'] = self.request.user.outlet
        return context

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsCashier]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category']
    search_fields = ['name', 'description']

    def get_queryset(self):
        outlet = self.request.user.outlet
        # Products available globally (outlet=None) OR specifically for this outlet
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
        context['outlet'] = self.request.user.outlet
        return context
