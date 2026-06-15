from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from email_discovery import (
    EmailDiscoveryConfig,
    discover_public_email,
    merge_email_discovery_into_lead,
)
from niche_config import queries_for

PRODUCTION_IMPORT_URL = "https://www.leadclaw.uk/api/leads/import"
GOOGLE_HTTP_STATUS_KEY = "_leadclaw_http_status"

CLINIC_NICHES = ["beauty", "dental"]
LOCAL_SERVICE_NICHES = [
    "plumber",
    "electrician",
    "heating",
    "roofer",
    "garage",
    "estate_agent",
]
DEFAULT_LOCATIONS = ["London"]

SOCIAL_OR_PLATFORM_HOSTS = (
    "facebook.com",
    "instagram.com",
    "x.com",
    "twitter.com",
    "linkedin.com",
    "youtube.com",
    "tiktok.com",
)


@dataclass(frozen=True)
class ScraperConfig:
    dry_run: bool
    limit: int
    niche_mode: str
    niches: list[str]
    locations: list[str]
    delay_seconds: float
    google_places_api_key: str
    import_url: str
    import_token: str
    email_discovery: EmailDiscoveryConfig


class GooglePlacesRequestError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        http_status: int | None = None,
        google_status: str | None = None,
        error_message: str | None = None,
    ) -> None:
        super().__init__(message)
        self.http_status = http_status
        self.google_status = google_status
        self.error_message = error_message


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_event(event: str, **fields: Any) -> None:
    payload = {"event": event, "ts": utc_now(), **fields}
    print(json.dumps(payload, sort_keys=True))


def select_niches(niche_mode: str, explicit_niches: list[str] | None = None) -> list[str]:
    cleaned = [n.strip() for n in explicit_niches or [] if n and n.strip()]
    if cleaned:
        return cleaned

    if niche_mode == "clinic":
        return list(CLINIC_NICHES)

    if niche_mode == "local-service":
        return list(LOCAL_SERVICE_NICHES)

    if niche_mode == "custom":
        raise ValueError("--niche-mode custom requires --niches")

    raise ValueError(f"Unsupported niche mode: {niche_mode}")


def build_config(
    *,
    dry_run: bool,
    limit: int,
    niche_mode: str,
    niches: list[str] | None,
    locations: list[str] | None,
    delay_seconds: float,
    discover_emails: bool = False,
    email_discovery_max_pages: int = 3,
    email_discovery_timeout_seconds: float = 5.0,
    email_discovery_delay_seconds: float = 0.5,
    env: dict[str, str] | None = None,
) -> ScraperConfig:
    env = env or os.environ
    selected_niches = select_niches(niche_mode, niches)
    selected_locations = [l.strip() for l in locations or [] if l and l.strip()]

    if not selected_locations:
        selected_locations = list(DEFAULT_LOCATIONS)

    if limit < 1:
        raise ValueError("--limit must be at least 1")

    if limit > 200:
        raise ValueError("--limit must be 200 or lower")

    if delay_seconds < 0:
        raise ValueError("--delay-seconds cannot be negative")

    if email_discovery_max_pages < 1 or email_discovery_max_pages > 7:
        raise ValueError("--email-discovery-max-pages must be between 1 and 7")

    if email_discovery_timeout_seconds <= 0 or email_discovery_timeout_seconds > 15:
        raise ValueError("--email-discovery-timeout must be between 0 and 15 seconds")

    if email_discovery_delay_seconds < 0:
        raise ValueError("--email-discovery-delay-seconds cannot be negative")

    google_key = (env.get("GOOGLE_PLACES_API_KEY") or "").strip()
    import_url = (env.get("LEADCLAW_IMPORT_URL") or PRODUCTION_IMPORT_URL).strip()
    import_token = (env.get("LEAD_IMPORT_TOKEN") or "").strip()

    if not dry_run and not google_key:
        raise ValueError("GOOGLE_PLACES_API_KEY is required for live runs")

    if not dry_run and not import_url:
        raise ValueError("LEADCLAW_IMPORT_URL is required for live runs")

    if not dry_run and not import_token:
        raise ValueError("LEAD_IMPORT_TOKEN is required for live imports")

    return ScraperConfig(
        dry_run=dry_run,
        limit=limit,
        niche_mode=niche_mode,
        niches=selected_niches,
        locations=selected_locations,
        delay_seconds=delay_seconds,
        google_places_api_key=google_key,
        import_url=import_url,
        import_token=import_token,
        email_discovery=EmailDiscoveryConfig(
            enabled=discover_emails,
            max_pages=email_discovery_max_pages,
            timeout_seconds=email_discovery_timeout_seconds,
            delay_seconds=email_discovery_delay_seconds,
        ),
    )


def is_valid_website(raw: str | None) -> bool:
    if not raw:
        return False

    value = raw.strip().lower()
    return value.startswith("https://") or value.startswith("http://")


def is_obviously_low_quality_website(raw: str | None) -> bool:
    if not raw:
        return False

    value = raw.lower()
    return any(host in value for host in SOCIAL_OR_PLATFORM_HOSTS)


def normalize_website(raw: str | None) -> str:
    return (raw or "").strip().rstrip("/")


def normalize_text(raw: str | None) -> str:
    return " ".join((raw or "").strip().lower().split())


def lead_key(lead: dict[str, Any]) -> str:
    website = normalize_website(lead.get("website"))
    email = normalize_text(lead.get("contact_email"))

    if website:
        return f"website:{website.lower()}"

    if email:
        return f"email:{email}"

    return (
        "name_city:"
        f"{normalize_text(lead.get('company_name'))}|{normalize_text(lead.get('city'))}"
    )


def dedupe_leads(leads: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    seen: set[str] = set()
    kept: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    for lead in leads:
        key = lead_key(lead)
        if key in seen:
            skipped.append({"lead": lead, "reason": "duplicate_in_batch"})
            continue

        seen.add(key)
        kept.append(lead)

    return kept, skipped


def parse_json_payload(raw: bytes) -> dict[str, Any]:
    payload = json.loads(raw.decode("utf-8"))
    if isinstance(payload, dict):
        return payload
    return {"status": "INVALID_JSON_SHAPE", "error_message": "Response was not a JSON object"}


def fetch_json(url: str, params: dict[str, Any], timeout: int = 20) -> dict[str, Any]:
    full_url = f"{url}?{urlencode(params)}"
    request = Request(
        full_url,
        headers={"User-Agent": "LeadClawResearchBot/1.0 (+https://www.leadclaw.uk)"},
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            data = response.read(1_000_000)
            payload = parse_json_payload(data)
            payload[GOOGLE_HTTP_STATUS_KEY] = getattr(response, "status", response.getcode())
            return payload
    except HTTPError as exc:
        data = exc.read(1_000_000)
        try:
            payload = parse_json_payload(data)
        except (UnicodeDecodeError, ValueError):
            payload = {}

        raise GooglePlacesRequestError(
            str(exc),
            http_status=exc.code,
            google_status=str(payload.get("status") or "HTTP_ERROR"),
            error_message=str(payload.get("error_message") or exc.reason or ""),
        ) from exc


def google_http_status(payload: dict[str, Any]) -> int | None:
    value = payload.get(GOOGLE_HTTP_STATUS_KEY)
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def google_status(payload: dict[str, Any]) -> str:
    return str(payload.get("status") or "UNKNOWN")


def google_error_message(payload: dict[str, Any]) -> str | None:
    value = payload.get("error_message")
    return str(value) if value else None


def google_results_count(payload: dict[str, Any]) -> int:
    results = payload.get("results")
    if isinstance(results, list):
        return len(results)

    result = payload.get("result")
    if isinstance(result, dict) and result:
        return 1

    return 0


def google_text_search(api_key: str, query: str) -> dict[str, Any]:
    return fetch_json(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        {"query": query, "key": api_key},
    )


def google_place_details(api_key: str, place_id: str) -> dict[str, Any]:
    return fetch_json(
        "https://maps.googleapis.com/maps/api/place/details/json",
        {
            "place_id": place_id,
            "fields": ",".join(
                [
                    "name",
                    "website",
                    "formatted_phone_number",
                    "formatted_address",
                    "rating",
                    "user_ratings_total",
                ]
            ),
            "key": api_key,
        },
    )


def lead_from_place(
    *,
    place: dict[str, Any],
    details: dict[str, Any],
    niche: str,
    city: str,
) -> tuple[dict[str, Any] | None, str | None]:
    result = details.get("result") or {}
    name = str(result.get("name") or place.get("name") or "").strip()

    if not name:
        return None, "missing_company_name"

    website = str(result.get("website") or "").strip()
    if website and not is_valid_website(website):
        return None, "invalid_website"

    if is_obviously_low_quality_website(website):
        return None, "platform_only_website"

    rating = result.get("rating") or place.get("rating")
    review_count = result.get("user_ratings_total") or place.get("user_ratings_total")
    phone = str(result.get("formatted_phone_number") or "").strip()
    address = str(result.get("formatted_address") or place.get("formatted_address") or "").strip()

    notes = {
        "address": address or None,
        "rating": rating,
        "review_count": review_count,
        "source": "google-places-textsearch",
        "email_collection": "not_attempted_by_scraper",
    }

    return (
        {
            "niche": niche,
            "company_name": name,
            "website": website,
            "contact_email": "",
            "contact_phone": phone,
            "city": city,
            "source": "google-places",
            "notes": json.dumps(notes, sort_keys=True),
        },
        None,
    )


def discover_leads(config: ScraperConfig) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    leads: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    if not config.google_places_api_key:
        log_event("scraper_plan_only_no_google_key", dry_run=config.dry_run)
        return leads, skipped

    for location in config.locations:
        for niche in config.niches:
            for query in queries_for(niche):
                if len(leads) >= config.limit:
                    break

                search_query = f"{query} {location} UK"
                log_event(
                    "google_places_search_started",
                    location=location,
                    niche=niche,
                    query=search_query,
                )

                try:
                    search = google_text_search(config.google_places_api_key, search_query)
                except GooglePlacesRequestError as exc:
                    log_event(
                        "google_places_search_response",
                        location=location,
                        niche=niche,
                        query=search_query,
                        http_status=exc.http_status,
                        google_status=exc.google_status,
                        error_message=exc.error_message,
                        result_count_before_filtering=0,
                        result_count_after_filtering=0,
                    )
                    continue
                except (HTTPError, URLError, TimeoutError, ValueError) as exc:
                    log_event(
                        "google_places_search_response",
                        location=location,
                        niche=niche,
                        query=search_query,
                        http_status=None,
                        google_status="NO_HTTP_RESPONSE",
                        error_message=str(exc),
                        result_count_before_filtering=0,
                        result_count_after_filtering=0,
                    )
                    continue

                places = search.get("results", [])
                if not isinstance(places, list):
                    places = []

                search_status = google_status(search)
                log_event(
                    "google_places_search_response",
                    location=location,
                    niche=niche,
                    query=search_query,
                    http_status=google_http_status(search),
                    google_status=search_status,
                    error_message=google_error_message(search),
                    result_count_before_filtering=len(places),
                )

                if search_status != "OK":
                    log_event(
                        "google_places_search_filter_summary",
                        location=location,
                        niche=niche,
                        query=search_query,
                        google_status=search_status,
                        result_count_before_filtering=len(places),
                        result_count_after_filtering=0,
                        skipped_count=len(places),
                        skip_reason="google_status_not_ok",
                    )
                    continue

                accepted_for_query = 0
                skipped_for_query = 0

                for place in places:
                    if len(leads) >= config.limit:
                        break

                    place_id = str(place.get("place_id") or "")
                    if not place_id:
                        skipped.append({"place": place.get("name"), "reason": "missing_place_id"})
                        skipped_for_query += 1
                        continue

                    time.sleep(config.delay_seconds)

                    try:
                        details = google_place_details(config.google_places_api_key, place_id)
                    except GooglePlacesRequestError as exc:
                        skipped.append({"place": place.get("name"), "reason": "details_failed"})
                        skipped_for_query += 1
                        log_event(
                            "google_place_details_response",
                            place_id=place_id,
                            place_name=place.get("name"),
                            http_status=exc.http_status,
                            google_status=exc.google_status,
                            error_message=exc.error_message,
                            result_count_before_filtering=0,
                            result_count_after_filtering=0,
                            skipped_reason="details_failed",
                        )
                        continue
                    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
                        skipped.append({"place": place.get("name"), "reason": "details_failed"})
                        skipped_for_query += 1
                        log_event(
                            "google_place_details_response",
                            place_id=place_id,
                            place_name=place.get("name"),
                            http_status=None,
                            google_status="NO_HTTP_RESPONSE",
                            error_message=str(exc),
                            result_count_before_filtering=0,
                            result_count_after_filtering=0,
                            skipped_reason="details_failed",
                        )
                        continue

                    details_status = google_status(details)
                    details_count = google_results_count(details)
                    log_event(
                        "google_place_details_response",
                        place_id=place_id,
                        place_name=place.get("name"),
                        http_status=google_http_status(details),
                        google_status=details_status,
                        error_message=google_error_message(details),
                        result_count_before_filtering=details_count,
                    )

                    if details_status != "OK":
                        skipped.append({"place": place.get("name"), "reason": "details_status_not_ok"})
                        skipped_for_query += 1
                        log_event(
                            "google_place_details_filter_summary",
                            place_id=place_id,
                            place_name=place.get("name"),
                            google_status=details_status,
                            result_count_before_filtering=details_count,
                            result_count_after_filtering=0,
                            skipped_reason="details_status_not_ok",
                        )
                        continue

                    lead, reason = lead_from_place(
                        place=place,
                        details=details,
                        niche=niche,
                        city=location,
                    )

                    if not lead:
                        skipped.append({"place": place.get("name"), "reason": reason or "skipped"})
                        skipped_for_query += 1
                        log_event(
                            "google_place_details_filter_summary",
                            place_id=place_id,
                            place_name=place.get("name"),
                            google_status=details_status,
                            result_count_before_filtering=details_count,
                            result_count_after_filtering=0,
                            skipped_reason=reason or "skipped",
                        )
                        continue

                    if config.email_discovery.enabled:
                        email_result = discover_public_email(
                            lead.get("website"),
                            company_name=lead.get("company_name"),
                            config=config.email_discovery,
                            log=log_event,
                        )
                        lead = merge_email_discovery_into_lead(lead, email_result)

                    leads.append(lead)
                    accepted_for_query += 1
                    log_event(
                        "google_place_details_filter_summary",
                        place_id=place_id,
                        place_name=place.get("name"),
                        google_status=details_status,
                        result_count_before_filtering=details_count,
                        result_count_after_filtering=1,
                        skipped_reason=None,
                    )
                    log_event(
                        "lead_discovered",
                        company_name=lead["company_name"],
                        city=location,
                        niche=niche,
                    )

                    time.sleep(config.delay_seconds)

                log_event(
                    "google_places_search_filter_summary",
                    location=location,
                    niche=niche,
                    query=search_query,
                    google_status=search_status,
                    result_count_before_filtering=len(places),
                    result_count_after_filtering=accepted_for_query,
                    skipped_count=skipped_for_query,
                    limit_reached=len(leads) >= config.limit,
                )

    deduped, duplicate_skips = dedupe_leads(leads)
    skipped.extend(duplicate_skips)
    return deduped[: config.limit], skipped


def import_leads(config: ScraperConfig, leads: list[dict[str, Any]]) -> dict[str, Any]:
    if config.dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "would_import": len(leads),
            "leads": leads,
        }

    payload = json.dumps({"leads": leads}).encode("utf-8")
    request = Request(
        config.import_url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {config.import_token}",
            "X-Lead-Import-Token": config.import_token,
            "Content-Type": "application/json",
            "User-Agent": "LeadClawLeadScraper/1.0",
        },
    )

    with urlopen(request, timeout=30) as response:
        return json.loads(response.read(1_000_000).decode("utf-8"))
