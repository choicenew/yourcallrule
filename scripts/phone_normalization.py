"""Shared phone normalization helpers for report and import scripts."""

FORMAT_CONTROL_CODES = {0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFEFF}

TWO_DIGIT_COUNTRY_CODES = frozenset(
    {
        "20", "27",
        "30", "31", "32", "33", "34", "36", "39",
        "40", "41", "43", "44", "45", "46", "47", "48", "49",
        "51", "52", "53", "54", "55", "56", "57", "58",
        "60", "61", "62", "63", "64", "65", "66",
        "81", "82", "84", "86",
        "90", "91", "92", "93", "94", "95", "98",
    }
)
ONE_DIGIT_COUNTRY_CODES = frozenset({"1", "7"})

TRUNK_ZERO_SIGNIFICANT_COUNTRY_CODES = frozenset({"39", "225"})


def split_country_code(digits: str) -> tuple[str, str] | None:
    if not digits:
        return None
    if digits[0] in ONE_DIGIT_COUNTRY_CODES:
        return digits[0], digits[1:]
    if digits[:2] in TWO_DIGIT_COUNTRY_CODES:
        return digits[:2], digits[2:]
    if len(digits) >= 3:
        return digits[:3], digits[3:]
    return None


def strip_national_trunk_prefix(digits: str) -> str:
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
    digits = e164[1:]
    if not digits.isdigit():
        return False
    if not 8 <= len(digits) <= 15:
        return False
    if digits[0] == "0":
        return False
    if digits[0] == "1":
        if len(digits) != 11:
            return False
        npa, nxx = digits[1:4], digits[4:7]
        if npa[0] < "2" or npa[1:] == "11" or npa == "555":
            return False
        if nxx[0] < "2" or nxx == "555":
            return False
    return True


def validated_report_number(raw: str | None) -> str | None:
    normalized = normalize_report_number(raw)
    if normalized and is_plausible_number(normalized):
        return normalized
    return None
