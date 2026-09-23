from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from meditation.models import (
    EmailVerificationToken,
    MeditationSession,
    MeditationType,
    PracticeGoal,
    RecoveryEmailEvent,
)


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


class PracticeGoalViewTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="goaluser", email="goal@example.com", password="testpass123"
        )
        self.other_user = User.objects.create_user(
            username="othergoal", email="othergoal@example.com", password="testpass123"
        )
        self.url = reverse("practice-goal")

    def test_goal_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_without_goal_returns_null(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"weekly_minutes": None})

    def test_create_update_and_delete_goal(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.put(
            self.url, {"weekly_minutes": 75}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"weekly_minutes": 75})

        response = self.client.put(
            self.url, {"weekly_minutes": 90}, format="json"
        )
        self.assertEqual(response.data, {"weekly_minutes": 90})
        self.assertEqual(PracticeGoal.objects.get(user=self.user).weekly_minutes, 90)

        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PracticeGoal.objects.filter(user=self.user).exists())

    def test_invalid_goal_does_not_create_a_record(self):
        self.client.force_authenticate(user=self.user)
        for value in (0, 10_081):
            response = self.client.put(
                self.url, {"weekly_minutes": value}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(PracticeGoal.objects.filter(user=self.user).exists())

    def test_goal_is_isolated_by_user(self):
        PracticeGoal.objects.create(user=self.other_user, weekly_minutes=120)
        self.client.force_authenticate(user=self.user)
        self.client.put(self.url, {"weekly_minutes": 45}, format="json")
        self.assertEqual(
            PracticeGoal.objects.get(user=self.other_user).weekly_minutes, 120
        )
        self.assertEqual(self.client.get(self.url).data, {"weekly_minutes": 45})


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

    def test_login_with_email(self):
        response = self.client.post(
            self.url,
            {"username": "test@example.com", "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_email_case_insensitive(self):
        response = self.client.post(
            self.url,
            {"username": "TEST@Example.com", "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_login_with_email_wrong_password(self):
        response = self.client.post(
            self.url,
            {"username": "test@example.com", "password": "wrongpassword"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_with_unknown_email(self):
        response = self.client.post(
            self.url,
            {"username": "nobody@example.com", "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_username_takes_precedence_over_email(self):
        User.objects.create_user(
            username="test@example.com",
            email="other@example.com",
            password="otherpass123",
        )

        response = self.client.post(
            self.url,
            {"username": "test@example.com", "password": "otherpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            self.url,
            {"username": "test@example.com", "password": "testpass123"},
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

        self.assertTrue(User.objects.filter(username="testuser").exists())
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


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="http://localhost:3000",
    PASSWORD_RESET_TIMEOUT=3600,
)
class AccountRecoveryViewTest(APITestCase):
    def setUp(self):
        self.active = User.objects.create_user(
            username="activeuser",
            email="active@example.com",
            password="OldSecurePass123!",
        )
        self.inactive = User.objects.create_user(
            username="inactiveuser",
            email="inactive@example.com",
            password="OldSecurePass123!",
            is_active=False,
        )

    def reset_link(self):
        uid = urlsafe_base64_encode(force_bytes(self.active.pk))
        token = default_token_generator.make_token(self.active)
        return uid, token

    def test_password_reset_request_is_generic_and_active_only(self):
        url = reverse("password-reset-request")
        for email in ("unknown@example.com", self.inactive.email):
            response = self.client.post(url, {"email": email}, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

        response = self.client.post(
            url, {"email": "ACTIVE@example.com"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/reset-password/", mail.outbox[0].body)

    def test_recovery_email_limit_is_five_per_hour(self):
        url = reverse("password-reset-request")
        for _ in range(6):
            response = self.client.post(
                url, {"email": self.active.email}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 5)
        self.assertEqual(
            RecoveryEmailEvent.objects.filter(
                user=self.active,
                kind=RecoveryEmailEvent.Kind.PASSWORD_RESET,
            ).count(),
            5,
        )

    def test_reset_link_validation_password_rules_and_single_use(self):
        uid, token = self.reset_link()
        url = reverse(
            "password-reset-confirm", kwargs={"uid": uid, "token": token}
        )
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)
        weak = self.client.post(
            url,
            {"new_password": "123", "password_confirm": "123"},
            format="json",
        )
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            url,
            {
                "new_password": "NewSecurePass456!",
                "password_confirm": "NewSecurePass456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.active.refresh_from_db()
        self.assertTrue(self.active.check_password("NewSecurePass456!"))
        self.assertEqual(self.client.get(url).status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_and_expired_reset_links_are_rejected(self):
        uid, token = self.reset_link()
        invalid = reverse(
            "password-reset-confirm", kwargs={"uid": uid, "token": f"{token}x"}
        )
        self.assertEqual(self.client.get(invalid).status_code, status.HTTP_400_BAD_REQUEST)
        with override_settings(PASSWORD_RESET_TIMEOUT=-1):
            expired = reverse(
                "password-reset-confirm", kwargs={"uid": uid, "token": token}
            )
            self.assertEqual(
                self.client.get(expired).status_code, status.HTTP_400_BAD_REQUEST
            )

    def test_resend_is_generic_reuses_token_and_keeps_inactive_user(self):
        token = EmailVerificationToken.create_token(self.inactive)
        url = reverse("resend-verification")
        response = self.client.post(
            url, {"email": "INACTIVE@example.com"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        token.refresh_from_db()
        self.assertIn(token.token, mail.outbox[0].body)

        for _ in range(5):
            self.client.post(url, {"email": self.inactive.email}, format="json")
        self.assertEqual(len(mail.outbox), 5)
        self.assertTrue(all(token.token in message.body for message in mail.outbox))
        self.assertEqual(
            RecoveryEmailEvent.objects.filter(
                user=self.inactive,
                kind=RecoveryEmailEvent.Kind.VERIFICATION,
            ).count(),
            5,
        )

        self.client.post(url, {"email": self.active.email}, format="json")
        self.client.post(url, {"email": "unknown@example.com"}, format="json")
        self.assertEqual(len(mail.outbox), 5)

    def test_profile_and_password_change(self):
        self.client.force_authenticate(user=self.active)
        profile = self.client.get(reverse("profile"))
        self.assertEqual(
            profile.data,
            {"username": "activeuser", "email": "active@example.com"},
        )
        wrong = self.client.post(
            reverse("password-change"),
            {
                "current_password": "wrong",
                "new_password": "NewSecurePass456!",
                "password_confirm": "NewSecurePass456!",
            },
            format="json",
        )
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(
            reverse("password-change"),
            {
                "current_password": "OldSecurePass123!",
                "new_password": "NewSecurePass456!",
                "password_confirm": "NewSecurePass456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_change_revokes_existing_jwt(self):
        login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": self.active.username, "password": "OldSecurePass123!"},
            format="json",
        )
        access = login.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.post(
            reverse("password-change"),
            {
                "current_password": "OldSecurePass123!",
                "new_password": "NewSecurePass456!",
                "password_confirm": "NewSecurePass456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.get(reverse("profile")).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
