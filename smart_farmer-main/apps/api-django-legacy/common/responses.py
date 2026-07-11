from rest_framework import status
from rest_framework.response import Response


def ok(message: str, extra: dict | None = None, status_code: int = status.HTTP_200_OK) -> Response:
    payload = {"success": True, "message": message, "error_code": None}
    if extra:
        payload.update(extra)
    return Response(payload, status=status_code)


def err(message: str, error_code: str, status_code: int = status.HTTP_400_BAD_REQUEST, extra: dict | None = None) -> Response:
    payload = {"success": False, "message": message, "error_code": error_code}
    if extra:
        payload.update(extra)
    return Response(payload, status=status_code)
