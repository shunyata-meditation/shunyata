from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from meditation.models import MeditationSession, MeditationType
from meditation.serializers import (
    MeditationSessionSerializer,
    MeditationTypeSerializer,
    UserRegistrationSerializer,
)


class MeditationSessionSerializerTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.mindfulness = MeditationType.objects.get(name="Mindfulness")
        self.breathing = MeditationType.objects.get(name="Breathing")

        self.start_time = timezone.now()
        self.end_time = self.start_time + timedelta(minutes=20)
        self.duration = self.end_time - self.start_time

        self.session_data = {
            "meditation_type": self.mindfulness.pk,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "duration": str(self.duration),
            "completed": True,
            "notes": "Great session"
        }

    def test_serializer_with_valid_data(self):
        serializer = MeditationSessionSerializer(data=self.session_data)
        self.assertTrue(serializer.is_valid())

    def test_serializer_save(self):
        serializer = MeditationSessionSerializer(data=self.session_data)
        self.assertTrue(serializer.is_valid())

        session = serializer.save(user=self.user)

        self.assertEqual(session.user, self.user)
        self.assertEqual(session.meditation_type, self.mindfulness)
        self.assertTrue(session.completed)
        self.assertEqual(session.notes, "Great session")

    def test_serializer_read_only_user_field(self):
        serializer = MeditationSessionSerializer(data=self.session_data)
        self.assertTrue(serializer.is_valid())

        self.assertIn("user", serializer.Meta.read_only_fields)

    def test_serializer_contains_expected_fields(self):
        serializer = MeditationSessionSerializer()
        expected_fields = [
            "id",
            "user",
            "start_time",
            "end_time",
            "duration",
            "meditation_type",
            "meditation_type_name",
            "completed",
            "notes"
        ]

        self.assertEqual(set(serializer.fields.keys()), set(expected_fields))

    def test_serializer_with_existing_session(self):
        session = MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.breathing,
            start_time=self.start_time,
            end_time=self.end_time,
            duration=self.duration,
            completed=True,
            notes="Test notes"
        )

        serializer = MeditationSessionSerializer(session)

        self.assertEqual(serializer.data["meditation_type"], self.breathing.pk)
        self.assertEqual(serializer.data["meditation_type_name"], "Breathing")
        self.assertEqual(serializer.data["notes"], "Test notes")
        self.assertTrue(serializer.data["completed"])

    def test_serializer_without_notes(self):
        data = self.session_data.copy()
        data["notes"] = ""

        serializer = MeditationSessionSerializer(data=data)
        self.assertTrue(serializer.is_valid())

        session = serializer.save(user=self.user)
        self.assertEqual(session.notes, "")

    def test_meditation_type_serializer(self):
        serializer = MeditationTypeSerializer(self.mindfulness)

        self.assertEqual(serializer.data, {"id": self.mindfulness.pk, "name": "Mindfulness"})


class UserRegistrationSerializerTest(TestCase):
    def setUp(self):
        self.valid_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "password_confirm": "SecurePass123!"
        }

    def test_serializer_with_valid_data(self):
        serializer = UserRegistrationSerializer(data=self.valid_data)
        self.assertTrue(serializer.is_valid())

    def test_serializer_creates_user(self):
        serializer = UserRegistrationSerializer(data=self.valid_data)
        self.assertTrue(serializer.is_valid())

        user = serializer.save()

        self.assertEqual(user.username, "newuser")
        self.assertEqual(user.email, "newuser@example.com")
        self.assertFalse(user.is_active)
        self.assertTrue(user.check_password("SecurePass123!"))

    def test_password_mismatch(self):
        data = self.valid_data.copy()
        data["password_confirm"] = "DifferentPassword123!"

        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("password_confirm", serializer.errors)

    def test_duplicate_email(self):
        User.objects.create_user(
            username="existinguser",
            email="newuser@example.com",
            password="testpass123"
        )

        serializer = UserRegistrationSerializer(data=self.valid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_email_required(self):
        data = self.valid_data.copy()
        del data["email"]

        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_weak_password(self):
        data = self.valid_data.copy()
        data["password"] = "123"
        data["password_confirm"] = "123"

        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())

    def test_password_not_in_response(self):
        serializer = UserRegistrationSerializer(data=self.valid_data)
        self.assertTrue(serializer.is_valid())

        user = serializer.save()
        serializer = UserRegistrationSerializer(user)

        self.assertNotIn("password", serializer.data)
        self.assertNotIn("password_confirm", serializer.data)

    def test_serializer_contains_expected_fields(self):
        serializer = UserRegistrationSerializer()
        expected_fields = ["username", "email", "password", "password_confirm"]

        self.assertEqual(set(serializer.fields.keys()), set(expected_fields))

    def test_user_created_as_inactive(self):
        serializer = UserRegistrationSerializer(data=self.valid_data)
        self.assertTrue(serializer.is_valid())

        user = serializer.save()
        self.assertFalse(user.is_active)

    def test_password_confirm_removed_from_validated_data(self):
        serializer = UserRegistrationSerializer(data=self.valid_data)
        self.assertTrue(serializer.is_valid())

        user = serializer.save()

        self.assertTrue(User.objects.filter(username="newuser").exists())
        self.assertFalse(hasattr(user, "password_confirm"))
