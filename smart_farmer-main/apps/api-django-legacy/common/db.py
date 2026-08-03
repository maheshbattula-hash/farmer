from __future__ import annotations

from contextlib import nullcontext
from typing import Any

from django.db import connection, transaction

MONGODB_ENGINE = "django_mongodb_backend"


def using_mongodb() -> bool:
    return connection.settings_dict.get("ENGINE") == MONGODB_ENGINE


def atomic_if_supported():
    return nullcontext() if using_mongodb() else transaction.atomic()


def stringify_pk(value: Any) -> str:
    return "" if value is None else str(value)


def ids_match(left: Any, right: Any) -> bool:
    if left is None or right is None:
        return False
    return stringify_pk(left) == stringify_pk(right)
