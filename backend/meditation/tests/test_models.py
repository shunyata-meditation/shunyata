from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone

from meditation.models import EmailVerificationToken, MeditationSession, MeditationType


class MeditationSessionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.mindfulness = MeditationType.objects.get(name="Mindfulness")
        self.breathing = MeditationType.objects.get(name="Breathing")
        self.walking = MeditationType.objects.get(name="Walking")

    def test_create_meditation_session(self):
        start_time = timezone.now()
        end_time = start_time + timedelta(minutes=20)
        duration = end_time - start_time

        session = MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.mindfulness,
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            completed=True,
            notes="Great session"
        )

        self.assertEqual(session.user, self.user)
        self.assertEqual(session.meditation_type, self.mindfulness)
        self.assertEqual(session.duration, duration)
        self.assertTrue(session.completed)
        self.assertEqual(session.notes, "Great session")

    def test_meditation_session_str(self):
        session = MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.breathing,
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(minutes=10),
            duration=timedelta(minutes=10),
            completed=True
        )

        self.assertEqual(str(session), "Breathing - testuser")

    def test_new_meditation_type_can_be_used_without_changing_choices(self):
        meditation_type = MeditationType.objects.create(name="Visualization")
        session = MeditationSession.objects.create(
            user=self.user,
            meditation_type=meditation_type,
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(minutes=5),
            duration=timedelta(minutes=5),
            completed=True,
        )

        self.assertEqual(session.meditation_type, meditation_type)

    def test_meditation_session_cascade_delete(self):
        session = MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.mindfulness,
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(minutes=10),
            duration=timedelta(minutes=10),
            completed=True
        )

        session_id = session.pk
        self.user.delete()

        self.assertFalse(MeditationSession.objects.filter(id=session_id).exists())

    def test_meditation_session_blank_notes(self):
        session = MeditationSession.objects.create(
            user=self.user,
            meditation_type=self.walking,
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(minutes=15),
            duration=timedelta(minutes=15),
            completed=False,
            notes=""
        )

        self.assertEqual(session.notes, "")


@override_settings(VERIFICATION_EMAIL_EXPIRY_HOURS=24)
class EmailVerificationTokenModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )

    def test_create_token(self):
        token = EmailVerificationToken.create_token(self.user)

        self.assertIsNotNone(token.token)
        self.assertEqual(token.user, self.user)
        self.assertFalse(token.is_expired())
        self.assertTrue(len(token.token) > 0)

    def test_token_str(self):
        token = EmailVerificationToken.create_token(self.user)
        self.assertEqual(str(token), "Verification token for testuser")

    def test_token_is_not_expired(self):
        token = EmailVerificationToken.create_token(self.user)
        self.assertFalse(token.is_expired())

    def test_token_is_expired(self):
        token = EmailVerificationToken.create_token(self.user)
        token.expires_at = timezone.now() - timedelta(hours=1)
        token.save()

        self.assertTrue(token.is_expired())

    def test_token_expiry_time(self):
        with override_settings(VERIFICATION_EMAIL_EXPIRY_HOURS=48):
            token = EmailVerificationToken.create_token(self.user)
            expected_expiry = timezone.now() + timedelta(hours=48)

            time_diff = abs((token.expires_at - expected_expiry).total_seconds())
            self.assertLess(time_diff, 5)

    def test_token_update_or_create(self):
        token1 = EmailVerificationToken.create_token(self.user)
        first_token_value = token1.token

        token2 = EmailVerificationToken.create_token(self.user)

        self.assertEqual(EmailVerificationToken.objects.filter(user=self.user).count(), 1)
        self.assertNotEqual(first_token_value, token2.token)

    def test_token_cascade_delete_with_user(self):
        token = EmailVerificationToken.create_token(self.user)
        token_id = token.pk

        self.user.delete()

        self.assertFalse(EmailVerificationToken.objects.filter(id=token_id).exists())

    def test_one_to_one_relationship(self):
        token = EmailVerificationToken.create_token(self.user)

        self.assertEqual(
            self.user.email_verification_token,  # pyright: ignore[reportAttributeAccessIssue]
            token,
        )
