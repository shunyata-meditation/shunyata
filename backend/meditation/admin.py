from typing import ClassVar

from django.contrib import admin

from meditation.models import (
    EmailVerificationToken,
    MeditationSession,
    MeditationType,
    PracticeGoal,
    RecoveryEmailEvent,
)


@admin.register(MeditationType)
class MeditationTypeAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ["id", "name"]
    search_fields: ClassVar[list[str]] = ["name"]


@admin.register(MeditationSession)
class MeditationSessionAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = [
        "id",
        "user",
        "meditation_type",
        "start_time",
        "end_time",
        "duration",
    ]
    list_filter: ClassVar[list[str]] = ["meditation_type", "start_time", "user"]
    search_fields: ClassVar[list[str]] = ["user__username", "user__email"]
    date_hierarchy = "start_time"


@admin.register(PracticeGoal)
class PracticeGoalAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ["id", "user", "weekly_minutes"]
    search_fields: ClassVar[list[str]] = ["user__username", "user__email"]


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = [
        "id",
        "user",
        "token",
        "created_at",
        "expires_at",
    ]
    list_filter: ClassVar[list[str]] = ["created_at", "user"]
    search_fields: ClassVar[list[str]] = ["user__username", "user__email"]
    date_hierarchy = "created_at"


@admin.register(RecoveryEmailEvent)
class RecoveryEmailEventAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ["id", "user", "kind", "sent_at"]
    list_filter: ClassVar[list[str]] = ["kind", "sent_at"]
    date_hierarchy = "sent_at"
