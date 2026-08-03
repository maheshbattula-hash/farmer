from __future__ import annotations

import random
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone
from rest_framework.authtoken.models import Token

from common.db import atomic_if_supported

from .models import AuthChallenge, OtpRequest, User

BLOCKED_EMAIL_DOMAINS = {
    "example.com",
    "example.org",
    "example.net",
    "invalid",
    "localhost",
    "test",
    "test.com",
    "test.local",
}


class OTPValidationError(Exception):
    def __init__(self, message: str, error_code: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code


def normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def get_email_domain(email: str | None) -> str:
    normalized = normalize_email(email)
    if "@" not in normalized:
        return ""
    return normalized.rsplit("@", 1)[1]


def is_blocked_email_domain(email: str | None) -> bool:
    domain = get_email_domain(email)
    return bool(domain) and (domain in BLOCKED_EMAIL_DOMAINS or domain.endswith(".invalid"))


def app_setting(key: str, default=None):
    return settings.SMART_FARMER.get(key, default)


def purge_old_otp_requests(email: str, scope: str) -> None:
    cutoff = timezone.now() - timedelta(hours=1)
    OtpRequest.objects.filter(requested_at__lt=cutoff).delete()
    OtpRequest.objects.filter(email=email, scope=scope, requested_at__lt=cutoff).delete()


def otp_limit_remaining(email: str, scope: str) -> int | None:
    if scope == AuthChallenge.PURPOSE_ADMIN:
        return None
    purge_old_otp_requests(email, scope)
    cutoff = timezone.now() - timedelta(hours=1)
    count = OtpRequest.objects.filter(email=email, scope=scope, requested_at__gte=cutoff).count()
    return max(app_setting("OTP_MAX_PER_HOUR", 3) - count, 0)


def send_email_message(recipient: str, subject: str, body: str) -> None:
    if getattr(settings, "MAIL_SUPPRESS_SEND", False):
        return
    message = EmailMessage(subject=subject, body=body, from_email=settings.DEFAULT_FROM_EMAIL, to=[recipient])
    message.send(fail_silently=False)


def create_challenge(user: User, purpose: str, metadata: dict | None = None) -> AuthChallenge:
    with atomic_if_supported():
        AuthChallenge.objects.filter(user=user, purpose=purpose, is_active=True).update(is_active=False)
        return AuthChallenge.objects.create(
            user=user,
            email=normalize_email(user.email),
            purpose=purpose,
            credential_verified=True,
            metadata=metadata or {},
        )


def get_challenge(challenge_id: str | int, purpose: str) -> AuthChallenge:
    try:
        challenge = AuthChallenge.objects.get(id=challenge_id, purpose=purpose, is_active=True)
    except AuthChallenge.DoesNotExist as exc:
        raise OTPValidationError("Challenge not found or expired.", "challenge_not_found", 404) from exc
    return challenge


def issue_otp(challenge: AuthChallenge) -> dict:
    email = normalize_email(challenge.email)
    if is_blocked_email_domain(email):
        raise OTPValidationError(
            "Use a real email inbox. Example or test domains cannot receive OTP emails.",
            "invalid_email_domain",
            400,
        )

    remaining = otp_limit_remaining(email, challenge.purpose)
    if challenge.purpose != AuthChallenge.PURPOSE_ADMIN and remaining is not None and remaining <= 0:
        raise OTPValidationError(
            "OTP request limit reached. You can request up to 3 codes per hour.",
            "otp_rate_limited",
            429,
        )

    otp = f"{random.randint(0, 999999):06d}"
    expiry_seconds = app_setting("OTP_EXPIRY_SECONDS", 300)
    challenge.otp_code = otp
    challenge.otp_requested_at = timezone.now()
    challenge.otp_expires_at = timezone.now() + timedelta(seconds=expiry_seconds)
    challenge.save(update_fields=["otp_code", "otp_requested_at", "otp_expires_at", "updated_at"])

    expiry_minutes = max(int(expiry_seconds / 60), 1)
    send_email_message(
        email,
        "Your Smart Farmer OTP",
        (
            f"Your Smart Farmer {challenge.get_purpose_display().lower()} OTP is {otp}.\n\n"
            f"It expires in {expiry_minutes} minute(s). "
            "If you did not request this sign-in, ignore this email."
        ),
    )
    OtpRequest.objects.create(email=email, scope=challenge.purpose)
    remaining_after = otp_limit_remaining(email, challenge.purpose)
    return {
        "otp": otp if app_setting("EXPOSE_TEST_OTP", False) else None,
        "remaining_requests": remaining_after,
    }


def verify_challenge_otp(challenge: AuthChallenge, email: str, otp: str, deactivate: bool = True) -> None:
    normalized = normalize_email(email)
    if normalized != normalize_email(challenge.email):
        raise OTPValidationError("Invalid OTP or email", "invalid_otp", 400)
    if not challenge.otp_code or not challenge.otp_requested_at:
        raise OTPValidationError("Request a fresh OTP before verifying.", "otp_not_requested", 400)
    if not challenge.otp_expires_at or timezone.now() > challenge.otp_expires_at:
        raise OTPValidationError("OTP has expired. Request a new code.", "otp_expired", 400)
    if (otp or "").strip().replace(" ", "") != challenge.otp_code:
        raise OTPValidationError("Incorrect OTP. Enter the latest code from your inbox.", "invalid_otp", 400)

    challenge.verified_at = timezone.now()
    challenge.is_active = not deactivate
    challenge.save(update_fields=["verified_at", "is_active", "updated_at"])


def issue_token(user: User) -> str:
    token, _ = Token.objects.get_or_create(user=user)
    return token.key


def ensure_admin_account() -> User | None:
    admin_email = normalize_email(app_setting("ADMIN_EMAIL", ""))
    admin_password = app_setting("ADMIN_PASSWORD", "")
    admin_username = (app_setting("ADMIN_USERNAME", "admin") or "admin").strip() or "admin"
    admin_full_name = (
        (app_setting("ADMIN_FULL_NAME", "System Administrator") or "System Administrator").strip()
        or "System Administrator"
    )

    if not admin_email or not admin_password:
        return None

    with atomic_if_supported():
        existing = User.objects.filter(role=User.ROLE_ADMIN).order_by("id").first()
        if existing:
            existing.username = admin_username
            existing.email = admin_email
            existing.full_name = admin_full_name
            existing.role = User.ROLE_ADMIN
            existing.is_verified = True
            existing.is_staff = True
            existing.is_superuser = True
            existing.set_password(admin_password)
            existing.save()
            return existing

        return User.objects.create_user(
            username=admin_username,
            email=admin_email,
            password=admin_password,
            role=User.ROLE_ADMIN,
            full_name=admin_full_name,
            is_verified=True,
            is_staff=True,
            is_superuser=True,
        )
