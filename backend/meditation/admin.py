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
    list_display = ["id", "name"]
    search_fields = ["name"]


@admin.register(MeditationSession)
class MeditationSessionAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "meditation_type",
        "start_time",
        "end_time",
        "duration",
    ]
    list_filter = ["meditation_type", "start_time", "user"]
    search_fields = ["user__username", "user__email"]
    date_hierarchy = "start_time"


@admin.register(PracticeGoal)
class PracticeGoalAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "weekly_minutes"]
    search_fields = ["user__username", "user__email"]


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "token",
        "created_at",
        "expires_at",
    ]
    list_filter = ["created_at", "user"]
    search_fields = ["user__username", "user__email"]
    date_hierarchy = "created_at"


@admin.register(RecoveryEmailEvent)
class RecoveryEmailEventAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "kind", "sent_at"]
    list_filter = ["kind", "sent_at"]
    date_hierarchy = "sent_at"
