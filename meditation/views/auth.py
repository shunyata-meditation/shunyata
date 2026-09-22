import logging
from typing import ClassVar

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from rest_framework import permissions, status
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from meditation.constants import (
    VERIFICATION_EMAIL_MESSAGE,
    VERIFICATION_EMAIL_SUBJECT,
    VERIFICATION_URL,
)
from meditation.models import EmailVerificationToken
from meditation.serializers import (
    CaseInsensitiveTokenObtainPairSerializer,
    UserRegistrationSerializer,
)

logger = logging.getLogger(__name__)


class CaseInsensitiveTokenObtainPairView(TokenObtainPairView):
    serializer_class = CaseInsensitiveTokenObtainPairSerializer


def _send_verification_email(user: User) -> None:
    verification_token = EmailVerificationToken.create_token(user)
    verification_url = VERIFICATION_URL.format(
        frontend_url=settings.FRONTEND_URL,
        token=verification_token.token,
    )
    message = VERIFICATION_EMAIL_MESSAGE.format(
        verification_url=verification_url,
        expiry_hours=settings.VERIFICATION_EMAIL_EXPIRY_HOURS,
    )
    send_mail(
        subject=VERIFICATION_EMAIL_SUBJECT,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],  # type: ignore
        fail_silently=False,
    )


class UserRegistrationView(GenericAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes: ClassVar[list[type[permissions.BasePermission]]] = [
        permissions.AllowAny
    ]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            user: User = serializer.save()  # type: ignore
            logger.info(f"User created: {user.username}")
            _send_verification_email(user)
            return Response(
                {
                    "message": "Registration successful. Please check your email to verify your account."
                },
                status=status.HTTP_201_CREATED,
            )

        logger.warning(f"Validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes: ClassVar[list[type[permissions.BasePermission]]] = [
        permissions.AllowAny
    ]

    def get(self, request, token):
        try:
            verification_token = EmailVerificationToken.objects.get(token=token)  # type: ignore

            if verification_token.is_expired():
                user = verification_token.user
                username = user.username
                email = user.email

                verification_token.delete()
                user.delete()

                logger.info(
                    f"Deleted expired token and inactive user: {username} ({email})"
                )

                return Response(
                    {"error": "Verification token has expired. Please register again."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = verification_token.user
            user.is_active = True
            user.save()

            verification_token.delete()

            logger.info(f"Email verified successfully for user: {user.username}")

            return Response(
                {
                    "message": "Email verified successfully. You can now login with your credentials."
                },
                status=status.HTTP_200_OK,
            )

        except EmailVerificationToken.DoesNotExist:  # type: ignore
            return Response(
                {"error": "Invalid verification token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
