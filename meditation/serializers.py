from typing import ClassVar

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from meditation.models import MeditationSession, MeditationType


class MeditationTypeSerializer(serializers.ModelSerializer):
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = MeditationType
        fields: ClassVar[list[str]] = ["id", "name"]


class CaseInsensitiveTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get(self.username_field)
        if username:
            try:
                user = User.objects.get(username__iexact=username)
                attrs[self.username_field] = user.username
            except User.DoesNotExist:
                pass
        return super().validate(attrs)


class MeditationSessionSerializer(serializers.ModelSerializer):
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = MeditationSession
        fields: ClassVar[list[str]] = [
            "id",
            "user",
            "start_time",
            "end_time",
            "duration",
            "meditation_type",
            "meditation_type_name",
            "completed",
            "notes",
        ]
        read_only_fields: ClassVar[list[str]] = ["user"]

    meditation_type_name = serializers.CharField(
        source="meditation_type.name", read_only=True
    )


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = User
        fields: ClassVar[list[str]] = [
            "username",
            "email",
            "password",
            "password_confirm",
        ]
        extra_kwargs: ClassVar[dict[str, dict[str, bool]]] = {
            "email": {"required": True},
        }

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Password fields didn't match."}
            )

        validate_password(attrs["password"])

        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            is_active=False,
        )

        return user
