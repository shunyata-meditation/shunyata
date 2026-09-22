VERIFICATION_EMAIL_SUBJECT = "Verify your email for Shunyata Meditation"

VERIFICATION_URL = "{frontend_url}/api/auth/verify-email/{token}"

VERIFICATION_EMAIL_MESSAGE = """Welcome to Shunyata Meditation!

Please verify your email address by clicking the link below:

{verification_url}

This link will expire in {expiry_hours} hours.

If you did not create an account, please ignore this email.

Namaste,
The Shunyata Team"""
