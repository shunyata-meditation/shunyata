VERIFICATION_EMAIL_SUBJECT = "Verify your email for Shunyata Meditation"

VERIFICATION_URL = "{frontend_url}/api/auth/verify-email/{token}"

VERIFICATION_EMAIL_MESSAGE = """Welcome to Shunyata Meditation!

Please verify your email address by clicking the link below:

{verification_url}

This link will expire in {expiry_hours} hours.

If you did not create an account, please ignore this email.

Namaste,
The Shunyata Team"""

PASSWORD_RESET_EMAIL_SUBJECT = "Reset your Shunyata password"

PASSWORD_RESET_URL = "{frontend_url}/reset-password/{uid}/{token}"

PASSWORD_RESET_EMAIL_MESSAGE = """Hello,

We received a request to reset your Shunyata password. Use the link below:

{reset_url}

This link will expire in one hour and can only be used once.

If you did not request this, you can ignore this email.

The Shunyata Team"""
