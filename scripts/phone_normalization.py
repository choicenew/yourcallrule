"""Shared phone normalization helpers powered dynamically by libphonenumber."""

from __future__ import annotations

import phonenumbers

FORMAT_CONTROL_CODES = {0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFEFF}
TRUNK_ZERO_SIGNIFICANT_COUNTRY_CODES = frozenset({"39", "225"})


def split_country_code(digits: str) -> tuple[str, str] | None:
    """Dynamically split E.164 digits into (country_code, national_number) using libphonenumber."""
    if not digits:
        return None
    raw = f"+{digits.lstrip('+')}"
    try:
        parsed = phonenumbers.parse(raw, None)
        cc = str(parsed.country_code)
        national = str(parsed.national_number)
        if cc and national:
            return cc, national
    except Exception:
        pass
    return None


def strip_national_trunk_prefix(digits: str) -> str:
    """Drop national trunk prefix using libphonenumber country splitting."""
    split = split_country_code(digits)
    if split is None:
        return digits
    country_code, national = split
    if country_code in TRUNK_ZERO_SIGNIFICANT_COUNTRY_CODES:
        return digits
    stripped = national.lstrip("0")
    if not stripped:
        return digits
    return country_code + stripped


def normalize_phone_number(raw: str | None) -> str:
    if not raw:
        return ""

    cleaned = "".join(ch for ch in str(raw) if ord(ch) not in FORMAT_CONTROL_CODES).strip()
    has_plus = cleaned.startswith("+")
    digits = "".join(ch for ch in cleaned if "0" <= ch <= "9")
    if not digits:
        return ""
    return f"+{digits}" if has_plus else digits


def normalize_report_number(raw: str | None) -> str | None:
    normalized = normalize_phone_number(raw)
    digits = "".join(ch for ch in normalized if "0" <= ch <= "9")
    if len(digits) < 7 or len(digits) > 15:
        return None
    if normalized.startswith("+"):
        digits = strip_national_trunk_prefix(digits)
        if len(digits) < 7 or len(digits) > 15:
            return None
    elif len(digits) == 10:
        digits = f"1{digits}"
    return f"+{digits}"


def normalize_nanp_number(raw: str | None) -> str | None:
    normalized = normalize_report_number(raw)
    if not normalized:
        return None
    digits = normalized[1:]
    if len(digits) == 11 and digits.startswith("1") and is_plausible_number(normalized):
        return normalized
    return None


def is_plausible_number(e164: str | None) -> bool:
    if not e164 or not e164.startswith("+"):
        return False
    try:
        parsed = phonenumbers.parse(e164, None)
        return phonenumbers.is_possible_number(parsed) and phonenumbers.is_valid_number(parsed)
    except Exception:
        digits = e164[1:]
        return digits.isdigit() and 8 <= len(digits) <= 15 and digits[0] != "0"


def validated_report_number(raw: str | None) -> str | None:
    normalized = normalize_report_number(raw)
    if normalized and is_plausible_number(normalized):
        return normalized
    return None
