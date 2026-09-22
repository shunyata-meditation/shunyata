from typing import ClassVar

from django.conf import settings
from django.db import models


class MeditationType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering: ClassVar[list[str]] = ["name"]

    def __str__(self) -> str:
        return self.name


class MeditationSession(models.Model):
    meditation_type = models.ForeignKey(
        MeditationType,
        on_delete=models.PROTECT,
        related_name="sessions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    duration = models.DurationField()
    completed = models.BooleanField()
    notes = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.meditation_type} - {self.user.username}"  # type: ignore
