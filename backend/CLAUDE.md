# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands use `uv run` as the package manager.

```bash
# Development server
uv run python manage.py runserver

# Run all tests
uv run python manage.py test

# Run a single test module / class / method
uv run python manage.py test meditation.tests.test_views
uv run python manage.py test meditation.tests.test_views.MeditationSessionViewSetTest
uv run python manage.py test meditation.tests.test_views.MeditationSessionViewSetTest.test_create_session_authenticated

# Django system check
uv run python manage.py check

# Database migrations
uv run python manage.py makemigrations
uv run python manage.py migrate

# Install dependencies
uv sync
```

## Architecture

**Project layout**: `shunyata_backend/` is the Django project config package (settings, root urlconf, wsgi/asgi); `meditation/` is the single Django app. This is a **pure backend API plus the Django admin** — there is no server-rendered frontend (templates and static assets were removed). The root urlconf (`shunyata_backend/urls.py`) only mounts `admin/` and `include("meditation.urls")` under `api/`; the entire API surface (auth, sessions, types, schema/docs) is defined in `meditation/urls.py` via a DRF `DefaultRouter` plus explicit `path()`s. `/` returns 404.

**Package structure within the app**: `models/`, `views/`, and `serializers` are split — `meditation/models/` and `meditation/views/` are packages whose `__init__.py` re-exports the public names, so import from the package (`from meditation.models import MeditationSession`, `from meditation.views import MeditationSessionViewSet`), not the submodules. `meditation/constants.py` holds the verification-email subject/body/URL templates.

**Database**: PostgreSQL. Configure via env vars (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_SSLMODE`). Copy `.env.example` to `.env` before first run. `DJANGO_ALLOWED_HOSTS` and `DJANGO_CSRF_TRUSTED_ORIGINS` are comma-separated env vars (empty by default).

**Meditation types are a seeded FK table**: `MeditationSession.meditation_type` is a `ForeignKey(MeditationType, on_delete=PROTECT)`, not a free-text/choice field. `MeditationType` rows (Mindfulness, Breathing, Body Scan, Loving Kindness, Walking, Other) are seeded by data migration `0007_meditationtype.py`, which also converts the legacy `meditation_type` CharField into the FK. Because seeding happens in a migration, tests can rely on those rows existing (e.g. `MeditationType.objects.get(name="Mindfulness")`). `MeditationSessionSerializer` accepts the type's integer PK on write and exposes a read-only `meditation_type_name`. Sessions are scoped to the authenticated user via `MeditationSessionViewSet.get_queryset`; `MeditationTypeViewSet` is read-only.

**Authentication flow**: JWT via `djangorestframework-simplejwt`. New users register with `is_active=False` and receive a verification email containing a token link. `EmailVerificationToken` (`meditation/models/email_verification.py`) handles token creation/expiry; clicking the link (`GET /api/auth/verify-email/<token>/`) activates the user, while hitting it with an expired token deletes both the token and the inactive user. The verification URL is built from `settings.FRONTEND_URL` (see `VERIFICATION_URL` in `meditation/constants.py`).

**API surface** (all under `/api/`, defined in `meditation/urls.py`):
- `POST /api/auth/register/` — creates inactive user, sends verification email
- `GET /api/auth/verify-email/<token>/` — activates user
- `POST /api/auth/login/` / `POST /api/auth/refresh/` — JWT token endpoints (simplejwt)
- `GET/POST /api/meditations/sessions/` and `…/sessions/<id>/` — `MeditationSession` CRUD, scoped to the authenticated user
- `GET /api/meditations/types/` — read-only `MeditationType` list
- `GET /api/schema/` + `GET /api/docs/` — OpenAPI schema and Swagger UI (drf-spectacular)

**Email in development**: Set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` in `.env` to print emails to the terminal instead of sending them.

**Deployment**: `Dockerfile` uses `uv`, runs `collectstatic` at build time (for admin static assets), and the container CMD runs `migrate` before starting gunicorn with 3 workers. Static files are served by WhiteNoise middleware. Images are published to GHCR on pushes to `main` and version tags.
