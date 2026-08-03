from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    allowed_roles: set[str] = set()

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.role in self.allowed_roles)


class IsFarmer(RolePermission):
    allowed_roles = {"farmer"}


class IsCustomer(RolePermission):
    allowed_roles = {"customer"}


class IsAdminRole(RolePermission):
    allowed_roles = {"admin"}
