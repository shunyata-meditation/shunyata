from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from meditation.views import (
    CaseInsensitiveTokenObtainPairView,
    MeditationSessionViewSet,
    MeditationTypeViewSet,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PracticeGoalView,
    ProfileView,
    ResendVerificationView,
    UserRegistrationView,
    VerifyEmailView,
)

router = DefaultRouter()
router.register("sessions", MeditationSessionViewSet, basename="meditation-session")
router.register("types", MeditationTypeViewSet, basename="meditation-type")

urlpatterns = [
    path("auth/register/", UserRegistrationView.as_view(), name="register"),
    path(
        "auth/resend-verification/",
        ResendVerificationView.as_view(),
        name="resend-verification",
    ),
    path(
        "auth/password-reset/",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "auth/password-reset/<str:uid>/<str:token>/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("auth/profile/", ProfileView.as_view(), name="profile"),
    path(
        "auth/password-change/",
        PasswordChangeView.as_view(),
        name="password-change",
    ),
    path(
        "auth/verify-email/<str:token>/",
        VerifyEmailView.as_view(),
        name="verify_email",
    ),
    path(
        "auth/login/",
        CaseInsensitiveTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("meditations/", include(router.urls)),
    path("meditations/goal/", PracticeGoalView.as_view(), name="practice-goal"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
