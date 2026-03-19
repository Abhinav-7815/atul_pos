from django.urls import path
from .views import DashboardStatsView, ReportsView, AdvancedAnalyticsView

urlpatterns = [
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('reports/', ReportsView.as_view(), name='reports'),
    path('advanced/', AdvancedAnalyticsView.as_view(), name='advanced-analytics'),
]
