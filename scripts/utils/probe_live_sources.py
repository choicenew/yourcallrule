#!/usr/bin/env python3
"""Check that every live caller-lookup source still answers."""

from __future__ import annotations

import argparse
import http.client
import json
import random
import re
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

FETCH_TIMEOUT_SECONDS = 20


@dataclass(frozen=True)
class Source:
    name: str
    url_prefix: str
    sample_digits: str
    marker: re.Pattern[str]
    spam_sample_digits: str
    spam_marker: re.Pattern[str]


SOURCES = (
    Source(
        name="SkipCalls",
        url_prefix="https://spam.skipcalls.app/check/",
        sample_digits="8443218090",
        marker=re.compile(r'"is_spam"\s*:\s*(true|false)'),
        spam_sample_digits="8333041447",
        spam_marker=re.compile(
            r'(?=.*"is_spam"\s*:\s*true)(?=.*"status_description"\s*:\s*"(?:scam|robocall|telemarketer|fraud)")',
            re.IGNORECASE | re.DOTALL,
        ),
    ),
)

Fetch = Callable[[str], tuple[int, str]]


def fetch(url: str) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "YourCallRule/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            return response.status, response.read(64 * 1024).decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, ""


def check(source: Source, fetcher: Fetch) -> tuple[bool, str]:
    try:
        status, body = fetcher(source.url_prefix + source.sample_digits)
    except OSError as error:
        return False, f"unreachable: {error}"
    if status != 200:
        return False, f"HTTP {status}"
    if not source.marker.search(body):
        return False, "answered without expected marker"
    try:
        status, body = fetcher(source.url_prefix + source.spam_sample_digits)
    except OSError as error:
        return False, f"unreachable for spam sample: {error}"
    if status != 200 or not source.spam_marker.search(body):
        return False, f"spam sample failed (HTTP {status})"
    return True, "answers correctly and flags spam sample"


def main() -> int:
    parser = argparse.ArgumentParser(description="Check live caller-lookup sources.")
    parser.parse_args()

    failures = 0
    for source in SOURCES:
        ok, detail = check(source, fetch)
        print(f"{'ok  ' if ok else 'FAIL'} {source.name}: {detail}")
        failures += 0 if ok else 1
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
