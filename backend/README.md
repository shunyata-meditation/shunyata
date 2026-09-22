# Shunyata Backend

Backend server for the Shunyata meditation tracking app. Built with Django and Django REST Framework, it provides a REST API for logging and managing meditation sessions, plus the Django admin for data management.

## Tech Stack

- **Python** 3.13
- **Django** 6.0.5 + Django REST Framework
- **Database** PostgreSQL
- **Authentication** JWT via `djangorestframework-simplejwt`
- **Email Delivery** Resend via `django-anymail`
- **API Docs** Swagger UI via `drf-spectacular`
- **Package Manager** [uv](https://github.com/astral-sh/uv)

## Getting Started

### Prerequisites

- Python 3.13
- PostgreSQL
- [uv](https://github.com/astral-sh/uv)

### Setup

1. Clone the repository and install dependencies:

```bash
git clone git@github.com:shunyata-meditation/shunyata-backend.git
cd shunyata-backend
uv sync
```

2. Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

3. Create the database and apply migrations:

```bash
uv run python manage.py migrate
```

4. Run the development server:

```bash
uv run python manage.py runserver
```

The server will be available at `http://localhost:8000`.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DJANGO_SECRET_KEY` | Django secret key | insecure dev key |
| `DJANGO_DEBUG` | Enable debug mode | `True` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed hosts | `""` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Comma-separated trusted origins for CSRF (include scheme) | `""` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call the API (include scheme) | `""` |
| `DB_NAME` | PostgreSQL database name | `shunyata` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `""` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_SSLMODE` | PostgreSQL SSL mode (`prefer` for local, `require` for hosted DBs like Neon) | `prefer` |
| `RESEND_API_KEY` | Resend API key used by `django-anymail` | `""` |
| `VERIFICATION_EMAIL_EXPIRY_HOURS` | Email verification token TTL in hours | `24` |
| `PASSWORD_RESET_TIMEOUT` | Password reset token TTL in seconds | `3600` |
| `FRONTEND_URL` | Base URL for verification and reset links | `http://localhost:3000` |

> The app now sends mail through Resend using the `anymail.backends.resend.EmailBackend` backend and the `Shunyata <onboarding@resend.dev>` sender address. For local-only development, override the backend to Django's console backend in a local settings file or test setup instead of using SMTP env vars.

## API Reference

Interactive documentation is available at `/api/docs/` when the server is running.

### Authentication

| Method | Endpoint | Description | Auth required |
|---|---|---|---|
| `POST` | `/api/auth/register/` | Register a new user | No |
| `GET` | `/api/auth/verify-email/<token>/` | Verify email address | No |
| `POST` | `/api/auth/resend-verification/` | Resend a verification email | No |
| `POST` | `/api/auth/password-reset/` | Request a password reset | No |
| `GET`, `POST` | `/api/auth/password-reset/<uid>/<token>/` | Validate or complete a password reset | No |
| `POST` | `/api/auth/login/` | Obtain JWT token pair | No |
| `POST` | `/api/auth/refresh/` | Refresh access token | No |
| `GET` | `/api/auth/profile/` | Read account details | Yes |
| `POST` | `/api/auth/password-change/` | Change the account password | Yes |

**Registration flow:** `POST /api/auth/register/` creates an inactive user and sends a verification email. The account is activated when the user clicks the link, after which they can log in. Expired verification links leave the account available for email resend.

Recovery request responses do not reveal whether an account exists. Recovery emails are limited to five of each kind per account per rolling hour. Changing or resetting a password invalidates existing JWTs.

**Auth header:** `Authorization: Bearer <access_token>`

### Meditation Sessions

All endpoints require authentication.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/meditations/sessions/` | List current user's sessions |
| `POST` | `/api/meditations/sessions/` | Create a new session |
| `GET` | `/api/meditations/sessions/<id>/` | Retrieve a session |
| `PUT` | `/api/meditations/sessions/<id>/` | Update a session |
| `PATCH` | `/api/meditations/sessions/<id>/` | Partially update a session |
| `DELETE` | `/api/meditations/sessions/<id>/` | Delete a session |
| `GET` | `/api/meditations/types/` | List available meditation types |

**Session fields:**

| Field | Type | Description |
|---|---|---|
| `meditation_type` | integer | ID of a meditation type from `/api/meditations/types/` |
| `meditation_type_name` | string | Read-only meditation type name |
| `start_time` | datetime | Session start (ISO 8601) |
| `end_time` | datetime | Session end (ISO 8601) |
| `duration` | duration | Length of the session |
| `completed` | boolean | Whether the session was completed |
| `notes` | string | Optional notes |

## Running Tests

```bash
# Run all tests
uv run python manage.py test

# Run a specific test module
uv run python manage.py test meditation.tests.test_views
uv run python manage.py test meditation.tests.test_models
uv run python manage.py test meditation.tests.test_serializers
```

## Deployment

The project includes a `Dockerfile` for containerised deployment. It uses `gunicorn` with 3 workers and serves static files via WhiteNoise.

### Using the pre-built image (recommended)

Images are published to GitHub Container Registry on every push to `main` and on version tags:

```bash
# latest build from main
docker pull ghcr.io/shunyata-meditation/shunyata-backend:latest

# specific commit
docker pull ghcr.io/shunyata-meditation/shunyata-backend:f4db0ed

# specific release
docker pull ghcr.io/shunyata-meditation/shunyata-backend:1.2.0
```

Run the pulled image:

```bash
docker run -p 8000:8000 --env-file .env ghcr.io/shunyata-meditation/shunyata-backend:latest
```

### Building locally

```bash
docker build -t shunyata-backend .
docker run -p 8000:8000 --env-file .env shunyata-backend
```

The container entrypoint runs `migrate` before starting gunicorn, so no separate migration step is needed on deploy.
