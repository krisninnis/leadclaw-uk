from __future__ import annotations

import json
import sys
from typing import Any

from email_discovery import (
    EmailDiscoveryConfig,
    discover_public_email,
    merge_email_discovery_into_lead,
)


def bounded_int(raw: Any, fallback: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return fallback

    return max(minimum, min(parsed, maximum))


def bounded_float(raw: Any, fallback: float, minimum: float, maximum: float) -> float:
    try:
        parsed = float(raw)
    except (TypeError, ValueError):
        return fallback

    return max(minimum, min(parsed, maximum))


def build_config(payload: dict[str, Any]) -> EmailDiscoveryConfig:
    raw_config = payload.get("config") if isinstance(payload.get("config"), dict) else {}

    return EmailDiscoveryConfig(
        enabled=True,
        max_pages=bounded_int(raw_config.get("max_pages"), 3, 1, 12),
        timeout_seconds=bounded_float(raw_config.get("timeout_seconds"), 5.0, 0.1, 5.0),
        delay_seconds=bounded_float(raw_config.get("delay_seconds"), 0.5, 0.0, 5.0),
    )


def run_email_backfill(payload: dict[str, Any]) -> dict[str, Any]:
    config = build_config(payload)
    leads = payload.get("leads") if isinstance(payload.get("leads"), list) else []
    results: list[dict[str, Any]] = []

    for lead in leads:
        if not isinstance(lead, dict):
            continue

        lead_id = str(lead.get("id") or "").strip()
        website = str(lead.get("website") or "").strip()
        company_name = str(lead.get("company_name") or "").strip() or None

        if not lead_id:
            continue

        try:
            discovery = discover_public_email(
                website,
                company_name=company_name,
                config=config,
                log=lambda _event, **_fields: None,
            )
            merged = merge_email_discovery_into_lead(
                {
                    "contact_email": "",
                    "notes": lead.get("notes"),
                },
                discovery,
            )

            results.append(
                {
                    "id": lead_id,
                    "contact_email": discovery.contact_email,
                    "notes": merged.get("notes"),
                    "status": discovery.status,
                    "reason": discovery.reason,
                    "confidence": discovery.confidence,
                    "source_url": discovery.source_url,
                    "candidates_count": discovery.candidates_count,
                    "pages_checked": discovery.pages_checked,
                }
            )
        except Exception as exc:  # Keep one bad site from failing the whole batch.
            results.append(
                {
                    "id": lead_id,
                    "contact_email": "",
                    "notes": lead.get("notes"),
                    "status": "failed",
                    "reason": exc.__class__.__name__,
                    "error": str(exc),
                    "candidates_count": 0,
                    "pages_checked": 0,
                }
            )

    return {"ok": True, "results": results}


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except ValueError as exc:
        print(json.dumps({"ok": False, "error": f"invalid_json: {exc}"}))
        return 2

    if not isinstance(payload, dict):
        print(json.dumps({"ok": False, "error": "payload_must_be_object"}))
        return 2

    print(json.dumps(run_email_backfill(payload), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
