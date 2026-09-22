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