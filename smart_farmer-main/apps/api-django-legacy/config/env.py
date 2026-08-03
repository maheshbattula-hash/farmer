from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent.parent
ENV_PATH = PROJECT_ROOT / ".env"

load_dotenv(ENV_PATH, override=False)


def env_value(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    return value if value is not None else default


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def env_list(name: str, default: list[str] | tuple[str, ...]) -> list[str]:
    value = os.getenv(name)
    if value is None:
        return [item.strip() for item in default if item and item.strip()]
    return [item.strip() for item in value.split(",") if item.strip()]
