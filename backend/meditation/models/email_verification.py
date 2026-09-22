import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class EmailVerificationToken(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification_token",
    )
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def __str__(self) -> str:
        return f"Verification token for {self.user.username}"  # type: ignore

    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @classmethod
    def create_token(cls, user: User) -> "EmailVerificationToken":
        token = secrets.token_urlsafe(48)
        expiry_hours = settings.VERIFICATION_EMAIL_EXPIRY_HOURS
        expires_at = timezone.now() + timedelta(hours=expiry_hours)

        verification_token, _ = cls.objects.update_or_create(  # type: ignore
            user=user,
            defaults={
                "token": token,
                "expires_at": expires_at,
            },
        )
        return verification_token
