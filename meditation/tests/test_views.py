from datetime import timedelta

from django.contrib.auth.models import User
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from meditation.models import EmailVerificationToken, MeditationSession, MeditationType


class MeditationSessionViewSetTest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="testpass123"
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
            "notes": "Great session",
        }

    def test_list_sessions_unauthenticated(self):
        url = reverse("meditation-session-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_sessions_authenticated(self):
        self.client.force_authenticate(user=self.user)

        MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.mindfulness,
            start_time=self.start_time,
            end_time=self.end_time,
            duration=self.duration,
            completed=True,
        )

        url = reverse("meditation-session-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_list_sessions_filters_by_user(self):
        self.client.force_authenticate(user=self.user)

        MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.mindfulness,
            start_time=self.start_time,
            end_time=self.end_time,
            duration=self.duration,
            completed=True,
        )

        MeditationSession.objects.create(
            user=self.other_user,
            meditation_type=self.breathing,
            start_time=self.start_time,
            end_time=self.end_time,
            duration=self.duration,
            completed=True,
        )

        url = reverse("meditation-session-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["meditation_type"], self.mindfulness.pk)
        self.assertEqual(response.data[0]["meditation_type_name"], "Mindfulness")

    def test_create_session_authenticated(self):
        self.client.force_authenticate(user=self.user)

        url = reverse("meditation-session-list")
        response = self.client.post(url, self.session_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MeditationSession.objects.count(), 1)
        self.assertEqual(MeditationSession.objects.get().user, self.user)

    def test_create_session_unauthenticated(self):
        url = reverse("meditation-session-list")
        response = self.client.post(url, self.session_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(MeditationSession.objects.count(), 0)

    def test_retrieve_session(self):
        self.client.force_authenticate(user=self.user)

        session = MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.breathing,
            start_time=self.start_time,
            end_time=self.end_time,
            duration=self.duration,
            completed=True,
            notes="Test notes",
        )

        url = reverse("meditation-session-detail", kwargs={"pk": session.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["meditation_type"], self.breathing.pk)
        self.assertEqual(response.data["meditation_type_name"], "Breathing")
        self.assertEqual(response.data["notes"], "Test notes")

    def test_update_session(self):
        self.client.force_authenticate(user=self.user)

        session = MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.mindfulness,
            start_time=self.start_time,
            end_time=self.end_time,
            duration=self.duration,
            completed=False,
            notes="",
        )

        url = reverse("meditation-session-detail", kwargs={"pk": session.pk})
        updated_data = self.session_data.copy()
        updated_data["notes"] = "Updated notes"

        response = self.client.put(url, updated_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertEqual(session.notes, "Updated notes")

    def test_delete_session(self):
        self.client.force_authenticate(user=self.user)

        session = MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.mindfulness,
            start_time=self.start_time,
            end_time=self.end_time,
            duration=self.duration,
            completed=True,
        )

        url = reverse("meditation-session-detail", kwargs={"pk": session.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(MeditationSession.objects.count(), 0)

    def test_cannot_access_other_user_session(self):
        self.client.force_authenticate(user=self.user)

        other_session = MeditationSession.objects.create(
            user=self.other_user,
            meditation_type=self.mindfulness,
            start_time=self.start_time,
            end_time=self.end_time,
            duration=self.duration,
            completed=True,
        )

        url = reverse("meditation-session-detail", kwargs={"pk": other_session.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_meditation_types(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse("meditation-type-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            {"Mindfulness", "Breathing"}.issubset(
                {item["name"] for item in response.data}
            )
        )


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    VERIFICATION_EMAIL_EXPIRY_HOURS=24,
    FRONTEND_URL="http://localhost:3000",
)
class UserRegistrationViewTest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.registration_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "password_confirm": "SecurePass123!",
        }

    @override_settings(
        STORAGES={
            "staticfiles": {
                "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
            },
        }
    )
    def test_browsable_api_shows_registration_inputs(self):
        response = self.client.get(reverse("register"), HTTP_ACCEPT="text/html")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        html = response.content.decode()
        for field in self.registration_data:
            self.assertRegex(html, rf'<input\b[^>]*name="{field}"')
        for field in ("password", "password_confirm"):
            self.assertRegex(
                html, rf'<input\b(?=[^>]*name="{field}")(?=[^>]*type="password")[^>]*>'
            )

    def test_register_user_from_html_form(self):
        response = self.client.post(
            reverse("register"), self.registration_data, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="newuser")
        self.assertTrue(user.check_password(self.registration_data["password"]))
        self.assertFalse(user.is_active)
        self.assertEqual(len(mail.outbox), 1)

    def test_register_user_success(self):
        url = reverse("register")
        response = self.client.post(url, self.registration_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("message", response.data)
        self.assertTrue(User.objects.filter(username="newuser").exists())

        user = User.objects.get(username="newuser")
        self.assertFalse(user.is_active)
        self.assertEqual(user.email, "newuser@example.com")

    def test_register_user_sends_verification_email(self):
        url = reverse("register")
        response = self.client.post(url, self.registration_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)

        email = mail.outbox[0]
        self.assertEqual(email.subject, "Verify your email for Shunyata Meditation")
        self.assertEqual(email.to, ["newuser@example.com"])
        self.assertIn("verify your email", email.body.lower())

    def test_register_user_creates_verification_token(self):
        url = reverse("register")
        response = self.client.post(url, self.registration_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username="newuser")
        verification_token = EmailVerificationToken.objects.get(user=user)
        self.assertIsNotNone(verification_token.token)

    def test_register_user_invalid_data(self):
        url = reverse("register")
        invalid_data = self.registration_data.copy()
        invalid_data["password_confirm"] = "DifferentPassword123!"

        response = self.client.post(url, invalid_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="newuser").exists())

    def test_register_user_duplicate_email(self):
        User.objects.create_user(
            username="existinguser", email="newuser@example.com", password="testpass123"
        )

        url = reverse("register")
        response = self.client.post(url, self.registration_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_register_user_weak_password(self):
        url = reverse("register")
        weak_data = self.registration_data.copy()
        weak_data["password"] = "123"
        weak_data["password_confirm"] = "123"

        response = self.client.post(url, weak_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginViewTest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        User.objects.create_user(
            username="TestUser",
            email="test@example.com",
            password="testpass123",
        )
        self.url = reverse("token_obtain_pair")

    def test_login_case_insensitive_username(self):
        response = self.client.post(
            self.url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_wrong_password(self):
        response = self.client.post(
            self.url,
            {"username": "TestUser", "password": "wrongpassword"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(
    VERIFICATION_EMAIL_EXPIRY_HOURS=24, FRONTEND_URL="http://localhost:3000"
)
class VerifyEmailViewTest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            is_active=False,
        )

    def test_verify_email_success(self):
        token = EmailVerificationToken.create_token(self.user)

        url = reverse("verify_email", kwargs={"token": token.token})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)

        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

        self.assertFalse(EmailVerificationToken.objects.filter(user=self.user).exists())

    def test_verify_email_invalid_token(self):
        url = reverse("verify_email", kwargs={"token": "invalid-token-123"})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_verify_email_expired_token(self):
        token = EmailVerificationToken.create_token(self.user)
        token.expires_at = timezone.now() - timedelta(hours=1)
        token.save()

        url = reverse("verify_email", kwargs={"token": token.token})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("expired", response.data["error"].lower())

        self.assertFalse(User.objects.filter(username="testuser").exists())
        self.assertFalse(
            EmailVerificationToken.objects.filter(token=token.token).exists()
        )

    def test_verify_email_deletes_token_on_success(self):
        token = EmailVerificationToken.create_token(self.user)
        token_value = token.token

        url = reverse("verify_email", kwargs={"token": token_value})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            EmailVerificationToken.objects.filter(token=token_value).exists()
        )
