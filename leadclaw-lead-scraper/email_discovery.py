from __future__ import annotations

import html
import json
import re
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
from urllib.robotparser import RobotFileParser

USER_AGENT = "LeadClawEmailDiscoveryBot/1.0 (+https://www.leadclaw.uk)"
SAFE_DISCOVERY_PATHS = (
    "/",
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/book",
    "/booking",
)
ROLE_EMAIL_LOCAL_PARTS = (
    "info",
    "hello",
    "contact",
    "enquiries",
    "enquiry",
    "reception",
    "bookings",
    "booking",
    "team",
    "admin",
    "office",
    "sales",
)
IGNORED_EMAIL_LOCAL_PARTS = {
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "privacy",
    "dpo",
}
IGNORED_EMAIL_LOCAL_PREFIXES = (
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "privacy",
    "dpo",
    "support-only",
    "support_only",
)
FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "hotmail.com",
    "hotmail.co.uk",
    "outlook.com",
    "live.com",
    "icloud.com",
    "yahoo.com",
    "yahoo.co.uk",
    "aol.com",
    "proton.me",
    "protonmail.com",
}
FILE_LIKE_TLDS = {"png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "avif", "pdf"}
EMAIL_RE = re.compile(r"[A-Z0-9._%+\-]+@(?:[A-Z0-9\-]+\.)+[A-Z]{2,63}", re.IGNORECASE)
EMAIL_FULL_RE = re.compile(r"^[A-Z0-9._%+\-]+@(?:[A-Z0-9\-]+\.)+[A-Z]{2,63}$", re.IGNORECASE)


@dataclass(frozen=True)
class EmailDiscoveryConfig:
    enabled: bool = False
    max_pages: int = 3
    timeout_seconds: float = 5.0
    delay_seconds: float = 0.5
    max_bytes: int = 512_000
    max_redirects: int = 3


@dataclass(frozen=True)
class EmailCandidate:
    email: str
    confidence: str
    source_url: str
    role_priority: int
    sequence: int


@dataclass(frozen=True)
class EmailDiscoveryResult:
    contact_email: str
    confidence: str | None
    source_url: str | None
    candidates_count: int
    pages_checked: int
    status: str
    reason: str | None = None


@dataclass(frozen=True)
class PageFetchResult:
    url: str
    status_code: int | None
    body: str
    skipped_reason: str | None = None


class NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req: Request, fp: Any, code: int, msg: str, headers: Any, newurl: str):
        return None


NO_REDIRECT_OPENER = build_opener(NoRedirectHandler)


def noop_log(event: str, **fields: Any) -> None:
    return None


def normalise_host(host: str | None) -> str:
    value = (host or "").strip().lower().rstrip(".")
    if value.startswith("www."):
        value = value[4:]
    return value


def same_domain(base_host: str, candidate_host: str | None) -> bool:
    return normalise_host(base_host) == normalise_host(candidate_host)


def normalise_website_url(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return ""

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""

    return urlunparse((parsed.scheme, parsed.netloc.lower(), "/", "", "", ""))


def public_page_urls(base_url: str, max_pages: int) -> list[str]:
    parsed = urlparse(base_url)
    origin = urlunparse((parsed.scheme, parsed.netloc, "", "", "", ""))
    urls: list[str] = []

    for path in SAFE_DISCOVERY_PATHS[:max_pages]:
        candidate = urljoin(f"{origin}/", path.lstrip("/"))
        parsed_candidate = urlparse(candidate)
        cleaned = urlunparse(
            (
                parsed_candidate.scheme,
                parsed_candidate.netloc.lower(),
                parsed_candidate.path or "/",
                "",
                "",
                "",
            )
        )
        if cleaned not in urls:
            urls.append(cleaned)

    return urls


def decode_response(raw: bytes, content_type: str) -> str:
    charset = "utf-8"
    match = re.search(r"charset=([^;\s]+)", content_type, re.IGNORECASE)
    if match:
        charset = match.group(1).strip("\"'")
    return raw.decode(charset, errors="replace")


def fetch_robots_rules(base_url: str, timeout_seconds: float) -> RobotFileParser | None:
    parsed = urlparse(base_url)
    robots_url = urlunparse((parsed.scheme, parsed.netloc, "/robots.txt", "", "", ""))
    request = Request(robots_url, headers={"User-Agent": USER_AGENT})

    try:
        with NO_REDIRECT_OPENER.open(request, timeout=timeout_seconds) as response:
            final_url = getattr(response, "url", response.geturl())
            if not same_domain(parsed.netloc, urlparse(final_url).netloc):
                return None

            body = response.read(100_000)
            rules = RobotFileParser()
            rules.set_url(robots_url)
            rules.parse(decode_response(body, response.headers.get("content-type", "")).splitlines())
            return rules
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return None


def robots_allows(rules: RobotFileParser | None, url: str) -> bool:
    if rules is None:
        return True

    return rules.can_fetch(USER_AGENT, url)


def fetch_website_page(
    url: str,
    *,
    base_host: str,
    timeout_seconds: float,
    max_bytes: int,
    max_redirects: int,
) -> PageFetchResult:
    current_url = url

    for _ in range(max_redirects + 1):
        request = Request(current_url, headers={"User-Agent": USER_AGENT})

        try:
            with NO_REDIRECT_OPENER.open(request, timeout=timeout_seconds) as response:
                status_code = response.getcode()
                final_url = getattr(response, "url", response.geturl())
                final_host = urlparse(final_url).netloc

                if not same_domain(base_host, final_host):
                    return PageFetchResult(final_url, status_code, "", "redirected_off_domain")

                content_type = response.headers.get("content-type", "")
                if content_type and not any(
                    token in content_type.lower()
                    for token in ("text/html", "application/xhtml+xml", "text/plain")
                ):
                    return PageFetchResult(final_url, status_code, "", "non_html_response")

                body = response.read(max_bytes + 1)
                return PageFetchResult(
                    final_url,
                    status_code,
                    html.unescape(decode_response(body[:max_bytes], content_type)),
                )
        except HTTPError as exc:
            if 300 <= exc.code < 400:
                location = exc.headers.get("Location")
                if not location:
                    return PageFetchResult(current_url, exc.code, "", "redirect_without_location")

                next_url = urljoin(current_url, location)
                parsed_next = urlparse(next_url)
                if parsed_next.scheme not in {"http", "https"}:
                    return PageFetchResult(next_url, exc.code, "", "redirect_to_unsupported_scheme")

                if not same_domain(base_host, parsed_next.netloc):
                    return PageFetchResult(next_url, exc.code, "", "redirected_off_domain")

                current_url = urlunparse(
                    (parsed_next.scheme, parsed_next.netloc.lower(), parsed_next.path or "/", "", "", "")
                )
                continue

            return PageFetchResult(current_url, exc.code, "", f"http_{exc.code}")
        except (URLError, TimeoutError, OSError, ValueError) as exc:
            return PageFetchResult(current_url, None, "", exc.__class__.__name__)

    return PageFetchResult(current_url, None, "", "redirect_limit_exceeded")


def normalise_email(raw: str) -> str:
    value = html.unescape(raw or "").strip().lower()
    value = value.replace("mailto:", "")
    value = value.split("?", 1)[0]
    value = value.strip(" \t\r\n.,;:<>[](){}\"'")
    return value


def is_valid_public_email(email: str) -> bool:
    if not EMAIL_FULL_RE.match(email):
        return False

    local, domain = email.rsplit("@", 1)
    if not local or not domain:
        return False

    if local in IGNORED_EMAIL_LOCAL_PARTS:
        return False

    if any(local.startswith(prefix) for prefix in IGNORED_EMAIL_LOCAL_PREFIXES):
        return False

    tld = domain.rsplit(".", 1)[-1].lower()
    if tld in FILE_LIKE_TLDS:
        return False

    return True


def is_role_email(local: str) -> bool:
    return any(local == role or local.startswith(f"{role}.") or local.startswith(f"{role}-") for role in ROLE_EMAIL_LOCAL_PARTS)


def is_personal_looking(local: str) -> bool:
    if is_role_email(local):
        return False

    if re.match(r"^[a-z]{2,20}[._-][a-z]{2,20}$", local):
        return True

    if re.match(r"^[a-z]{2,20}$", local) and local not in ROLE_EMAIL_LOCAL_PARTS:
        return True

    return False


def classify_email_confidence(email: str, website_host: str) -> tuple[str, int]:
    local, domain = email.rsplit("@", 1)
    role_index = next(
        (
            index
            for index, role in enumerate(ROLE_EMAIL_LOCAL_PARTS)
            if local == role or local.startswith(f"{role}.") or local.startswith(f"{role}-")
        ),
        len(ROLE_EMAIL_LOCAL_PARTS),
    )

    if is_role_email(local):
        return "high", role_index

    if domain in FREE_EMAIL_DOMAINS or is_personal_looking(local):
        return "low", role_index

    if same_domain(website_host, domain):
        return "medium", role_index

    return "low", role_index


def extract_email_candidates(body: str, *, source_url: str, website_host: str) -> list[EmailCandidate]:
    candidates: list[EmailCandidate] = []
    seen: set[str] = set()

    for sequence, match in enumerate(EMAIL_RE.findall(body or "")):
        email = normalise_email(match)
        if email in seen or not is_valid_public_email(email):
            continue

        seen.add(email)
        confidence, role_priority = classify_email_confidence(email, website_host)
        candidates.append(
            EmailCandidate(
                email=email,
                confidence=confidence,
                source_url=source_url,
                role_priority=role_priority,
                sequence=sequence,
            )
        )

    return candidates


def choose_best_email(candidates: list[EmailCandidate]) -> EmailCandidate | None:
    if not candidates:
        return None

    confidence_weight = {"high": 3, "medium": 2, "low": 1}
    return sorted(
        candidates,
        key=lambda candidate: (
            -confidence_weight.get(candidate.confidence, 0),
            candidate.role_priority,
            candidate.sequence,
        ),
    )[0]


def log_email_found(log: Callable[..., None], candidate: EmailCandidate, candidates_count: int) -> None:
    email_domain = candidate.email.rsplit("@", 1)[-1]
    log(
        "email_discovery_email_found",
        source_url=candidate.source_url,
        email_domain=email_domain,
        email_confidence=candidate.confidence,
        email_candidates_count=candidates_count,
    )


def discover_public_email(
    website: str | None,
    *,
    company_name: str | None = None,
    config: EmailDiscoveryConfig | None = None,
    log: Callable[..., None] | None = None,
) -> EmailDiscoveryResult:
    config = config or EmailDiscoveryConfig()
    log = log or noop_log

    if not config.enabled:
        return EmailDiscoveryResult("", None, None, 0, 0, "skipped", "disabled")

    base_url = normalise_website_url(website)
    if not base_url:
        log("email_discovery_skipped", company_name=company_name, reason="missing_or_invalid_website")
        return EmailDiscoveryResult("", None, None, 0, 0, "skipped", "missing_or_invalid_website")

    parsed_base = urlparse(base_url)
    base_host = parsed_base.netloc
    page_urls = public_page_urls(base_url, config.max_pages)
    robots_rules = fetch_robots_rules(base_url, config.timeout_seconds)
    candidates: list[EmailCandidate] = []
    pages_checked = 0

    log(
        "email_discovery_started",
        company_name=company_name,
        website=base_url,
        max_pages=config.max_pages,
        timeout_seconds=config.timeout_seconds,
    )

    for index, page_url in enumerate(page_urls):
        if index > 0 and config.delay_seconds > 0:
            time.sleep(config.delay_seconds)

        if not same_domain(base_host, urlparse(page_url).netloc):
            log(
                "email_discovery_page_checked",
                company_name=company_name,
                url=page_url,
                http_status=None,
                skipped_reason="off_domain_candidate",
                email_candidates_count=0,
            )
            continue

        if not robots_allows(robots_rules, page_url):
            log(
                "email_discovery_page_checked",
                company_name=company_name,
                url=page_url,
                http_status=None,
                skipped_reason="robots_disallowed",
                email_candidates_count=0,
            )
            continue

        page = fetch_website_page(
            page_url,
            base_host=base_host,
            timeout_seconds=config.timeout_seconds,
            max_bytes=config.max_bytes,
            max_redirects=config.max_redirects,
        )
        pages_checked += 1

        page_candidates = extract_email_candidates(
            page.body,
            source_url=page.url,
            website_host=base_host,
        )
        candidates.extend(page_candidates)
        log(
            "email_discovery_page_checked",
            company_name=company_name,
            url=page.url,
            http_status=page.status_code,
            skipped_reason=page.skipped_reason,
            email_candidates_count=len(page_candidates),
        )

    unique_candidates = {candidate.email: candidate for candidate in candidates}
    candidate_list = list(unique_candidates.values())
    best = choose_best_email(candidate_list)

    if best:
        log_email_found(log, best, len(candidate_list))
        log(
            "email_discovery_complete",
            company_name=company_name,
            status="found",
            pages_checked=pages_checked,
            email_candidates_count=len(candidate_list),
            email_confidence=best.confidence,
            email_source_url=best.source_url,
        )
        return EmailDiscoveryResult(
            best.email,
            best.confidence,
            best.source_url,
            len(candidate_list),
            pages_checked,
            "found",
        )

    log(
        "email_discovery_complete",
        company_name=company_name,
        status="not_found",
        pages_checked=pages_checked,
        email_candidates_count=len(candidate_list),
    )
    return EmailDiscoveryResult("", None, None, len(candidate_list), pages_checked, "not_found", "no_safe_email_found")


def email_discovery_notes(result: EmailDiscoveryResult) -> dict[str, Any]:
    notes: dict[str, Any] = {
        "email_discovery_status": result.status,
        "email_candidates_count": result.candidates_count,
        "email_pages_checked": result.pages_checked,
    }

    if result.contact_email:
        notes.update(
            {
                "email_collection": "website_public_contact_page",
                "email_confidence": result.confidence,
                "email_source_url": result.source_url,
            }
        )
    elif result.status == "not_found":
        notes.update(
            {
                "email_collection": "website_public_email_not_found",
                "email_discovery_reason": result.reason or "no_safe_email_found",
            }
        )
    else:
        notes.update(
            {
                "email_collection": "website_email_discovery_skipped",
                "email_discovery_reason": result.reason or "skipped",
            }
        )

    return notes


def merge_email_discovery_into_lead(
    lead: dict[str, Any],
    result: EmailDiscoveryResult,
) -> dict[str, Any]:
    existing_notes = lead.get("notes")
    try:
        parsed_notes = json.loads(existing_notes) if isinstance(existing_notes, str) else {}
        notes = parsed_notes if isinstance(parsed_notes, dict) else {}
    except ValueError:
        notes = {}

    notes.update(email_discovery_notes(result))
    updated = {**lead, "notes": json.dumps(notes, sort_keys=True)}

    if result.contact_email:
        updated["contact_email"] = result.contact_email

    return updated
