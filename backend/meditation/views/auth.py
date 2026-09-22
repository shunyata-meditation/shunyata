import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import permissions, status
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from meditation.constants import (
    PASSWORD_RESET_EMAIL_MESSAGE,
    PASSWORD_RESET_EMAIL_SUBJECT,
    PASSWORD_RESET_URL,
    VERIFICATION_EMAIL_MESSAGE,
    VERIFICATION_EMAIL_SUBJECT,
    VERIFICATION_URL,
)
from meditation.models import EmailVerificationToken, RecoveryEmailEvent
from meditation.serializers import (
    AccountEmailSerializer,
    CaseInsensitiveTokenObtainPairSerializer,
    PasswordChangeSerializer,
    PasswordPairSerializer,
    ProfileSerializer,
    UserRegistrationSerializer,
)

logger = logging.getLogger(__name__)


class CaseInsensitiveTokenObtainPairView(TokenObtainPairView):
    serializer_class = CaseInsensitiveTokenObtainPairSerializer


GENERIC_RESET_MESSAGE = (
    "If an eligible account uses that email, a password reset link is on its way."
)
GENERIC_RESEND_MESSAGE = (
    "If an unverified account uses that email, a verification link is on its way."
)


def _reserve_recovery_email(user: User, kind: str) -> bool:
    cutoff = timezone.now() - timedelta(hours=1)
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        events = RecoveryEmailEvent.objects.filter(user=user, kind=kind)
        events.filter(sent_at__lt=cutoff).delete()
        if events.count() >= 5:
            return False
        RecoveryEmailEvent.objects.create(user=user, kind=kind)
        return True


def _send_verification_email(
    user: User, *, reuse_valid_token: bool = False, enforce_limit: bool = False
) -> bool:
    if enforce_limit and not _reserve_recovery_email(
        user, RecoveryEmailEvent.Kind.VERIFICATION
    ):
        return False
    if not enforce_limit:
        _reserve_recovery_email(user, RecoveryEmailEvent.Kind.VERIFICATION)
    verification_token = None
    if reuse_valid_token:
        verification_token = EmailVerificationToken.objects.filter(user=user).first()
        if verification_token is not None and verification_token.is_expired():
            verification_token.delete()
            verification_token = None
    if verification_token is None:
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
        recipient_list=[user.email],
        fail_silently=False,
    )
    return True


def _password_reset_user(uid: str, token: str) -> User | None:
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None
    if not user.is_active or not default_token_generator.check_token(user, token):
        return None
    return user


class UserRegistrationView(GenericAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            user: User = serializer.save()
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
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            verification_token = EmailVerificationToken.objects.get(token=token)
            if verification_token.is_expired():
                verification_token.delete()
                logger.info("Deleted expired verification token")

                return Response(
                    {
                        "error": "Verification token has expired. Please request another."
                    },
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


class ResendVerificationView(GenericAPIView):
    serializer_class = AccountEmailSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"], is_active=False
        ).first()
        if user is not None:
            try:
                _send_verification_email(
                    user, reuse_valid_token=True, enforce_limit=True
                )
            except Exception:
                logger.exception("Failed to resend verification email")
        return Response({"message": GENERIC_RESEND_MESSAGE})


class PasswordResetRequestView(GenericAPIView):
    serializer_class = AccountEmailSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"], is_active=True
        ).first()
        if (
            user is not None
            and user.has_usable_password()
            and _reserve_recovery_email(user, RecoveryEmailEvent.Kind.PASSWORD_RESET)
        ):
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = PASSWORD_RESET_URL.format(
                frontend_url=settings.FRONTEND_URL,
                uid=uid,
                token=token,
            )
            try:
                send_mail(
                    subject=PASSWORD_RESET_EMAIL_SUBJECT,
                    message=PASSWORD_RESET_EMAIL_MESSAGE.format(reset_url=reset_url),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                logger.exception("Failed to send password reset email")
        return Response({"message": GENERIC_RESET_MESSAGE})


class PasswordResetConfirmView(GenericAPIView):
    serializer_class = PasswordPairSerializer
    permission_classes = [permissions.AllowAny]

    def get(self, request, uid, token):
        if _password_reset_user(uid, token) is None:
            return Response(
                {"error": "This password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"valid": True})

    def post(self, request, uid, token):
        user = _password_reset_user(uid, token)
        if user is None:
            return Response(
                {"error": "This password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(
            data=request.data,
            context={"user": user},
        )
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"message": "Your password has been reset."})


class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(ProfileSerializer(request.user).data)


class PasswordChangeView(GenericAPIView):
    serializer_class = PasswordChangeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(
            data=request.data,
            context={"user": request.user},
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"message": "Your password has been changed."})
