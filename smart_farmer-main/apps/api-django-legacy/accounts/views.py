from __future__ import annotations

from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.views import APIView

from common.responses import err, ok

from .models import AuthChallenge, User
from .serializers import UserSerializer
from .services import (
    OTPValidationError,
    create_challenge,
    ensure_admin_account,
    get_challenge,
    is_blocked_email_domain,
    issue_otp,
    issue_token,
    normalize_email,
    verify_challenge_otp,
)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        email = normalize_email(request.data.get("email"))
        password = request.data.get("password") or ""
        role = request.data.get("role") or User.ROLE_CUSTOMER
        full_name = request.data.get("full_name") or ""
        city = request.data.get("city") or ""
        state = request.data.get("state") or ""
        district = request.data.get("district") or ""
        pincode = request.data.get("pincode") or ""

        if not username or not email or not password:
            return err("Username, email, and password are required", "required_fields", 400)
        if is_blocked_email_domain(email):
            return err(
                "Use a real email inbox. Example or test domains are blocked for OTP delivery.",
                "invalid_email_domain",
                400,
            )
        if User.objects.filter(Q(username=username) | Q(email__iexact=email)).exists():
            return err("Username or email already exists", "already_exists", 409)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=role,
            full_name=full_name,
            city=city,
            state=state,
            district=district,
            pincode=pincode,
        )
        return ok("Registration successful! Please login.", {"user": UserSerializer(user).data}, status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = normalize_email(request.data.get("email"))
        password = request.data.get("password") or ""
        user = User.objects.filter(email__iexact=email).first()
        if not user or not user.check_password(password):
            return err("Invalid email or password", "invalid_credentials", status.HTTP_401_UNAUTHORIZED)
        challenge = create_challenge(user, AuthChallenge.PURPOSE_LOGIN)
        return ok(
            "Credentials verified. Continue to OTP.",
            {"challenge_id": challenge.id, "email": challenge.email, "purpose": challenge.purpose},
        )


class RequestOtpView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        purpose = request.data.get("purpose") or AuthChallenge.PURPOSE_LOGIN
        try:
            challenge = get_challenge(request.data.get("challenge_id"), purpose)
            if normalize_email(request.data.get("email")) != normalize_email(challenge.email):
                return err("This email is not registered", "email_not_registered", 404, {"otp": None})
            extra = issue_otp(challenge)
            return ok("OTP sent to your inbox. Check your email.", extra={**extra})
        except OTPValidationError as exc:
            extra = {"otp": None}
            if exc.error_code == "otp_rate_limited":
                extra["remaining_requests"] = 0
            return err(exc.message, exc.error_code, exc.status_code, extra)


class VerifyOtpView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        purpose = request.data.get("purpose") or AuthChallenge.PURPOSE_LOGIN
        try:
            challenge = get_challenge(request.data.get("challenge_id"), purpose)
            verify_challenge_otp(
                challenge,
                request.data.get("email"),
                request.data.get("otp"),
                deactivate=purpose != AuthChallenge.PURPOSE_PASSWORD_RESET,
            )
            if purpose == AuthChallenge.PURPOSE_PASSWORD_RESET:
                return ok("OTP verified successfully.", {"challenge_id": challenge.id, "verified": True, "redirect": "/reset_password"})

            token = issue_token(challenge.user)
            user_data = UserSerializer(challenge.user).data
            redirect = "/farmer/dashboard" if challenge.user.role == User.ROLE_FARMER else "/admin/dashboard" if challenge.user.role == User.ROLE_ADMIN else "/my_orders"
            return ok("OTP verified successfully.", {"token": token, "user": user_data, "redirect": redirect})
        except OTPValidationError as exc:
            return err(exc.message, exc.error_code, exc.status_code)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = normalize_email(request.data.get("email"))
        if not email:
            return err("Enter your registered email to reset your password.", "email_required", 400)
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return err("No account was found for that email address.", "email_not_found", 404)
        challenge = create_challenge(user, AuthChallenge.PURPOSE_PASSWORD_RESET)
        return ok(
            "Password reset flow started.",
            {"challenge_id": challenge.id, "email": challenge.email, "purpose": challenge.purpose},
        )


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        password = request.data.get("password") or ""
        confirm_password = request.data.get("confirm_password") or ""
        if not password or not confirm_password:
            return err("Both the new password and confirmation are required.", "password_required", 400)
        if password != confirm_password:
            return err("The new password and confirmation must match.", "password_mismatch", 400)
        if len(password) < 8:
            return err("The new password must be at least 8 characters long.", "password_too_short", 400)
        try:
            challenge = get_challenge(request.data.get("challenge_id"), AuthChallenge.PURPOSE_PASSWORD_RESET)
            if not challenge.verified_at:
                return err("Complete OTP verification before setting a new password.", "otp_not_verified", 400)
            challenge.user.set_password(password)
            challenge.user.save(update_fields=["password"])
            challenge.is_active = False
            challenge.save(update_fields=["is_active", "updated_at"])
            return ok("Password updated successfully. Login now with your new password.")
        except OTPValidationError as exc:
            return err(exc.message, exc.error_code, exc.status_code)


class AdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ensure_admin_account()
        email = normalize_email(request.data.get("email"))
        password = request.data.get("password") or ""
        admin_user = User.objects.filter(role=User.ROLE_ADMIN, email__iexact=email).first()
        if not admin_user or not admin_user.check_password(password):
            return err("Invalid admin credentials", "invalid_credentials", status.HTTP_401_UNAUTHORIZED, {"otp": None})
        challenge = create_challenge(admin_user, AuthChallenge.PURPOSE_ADMIN)
        try:
            extra = issue_otp(challenge)
            return ok(
                "OTP sent to your inbox. Check your email.",
                {"challenge_id": challenge.id, "email": challenge.email, "purpose": challenge.purpose, **extra},
            )
        except OTPValidationError as exc:
            return err(exc.message, exc.error_code, exc.status_code, {"otp": None})


class MeView(APIView):
    def get(self, request):
        return ok("Current user", {"user": UserSerializer(request.user).data})


class ToggleVerificationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id: str):
        if request.user.role != User.ROLE_ADMIN:
            return err("Unauthorized access", "unauthorized", status.HTTP_403_FORBIDDEN)
        user = User.objects.filter(id=user_id).first()
        if not user:
            return err("User not found", "user_not_found", 404)
        user.is_verified = not user.is_verified
        user.save(update_fields=["is_verified"])
        return ok("Farmer verification status updated!", {"user": UserSerializer(user).data})


class DeleteUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, user_id: str):
        if request.user.role != User.ROLE_ADMIN:
            return err("Unauthorized access", "unauthorized", status.HTTP_403_FORBIDDEN)
        user = User.objects.filter(id=user_id).first()
        if not user:
            return err("User not found", "user_not_found", 404)
        if user.role == User.ROLE_ADMIN:
            return err("Admin users are protected", "protected_user", 400)
        user.delete()
        return ok("User deleted successfully")
