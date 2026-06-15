from __future__ import annotations

import argparse
import json
import sys

from scraper_core import build_config, discover_leads, import_leads, log_event


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Safely discover public UK business leads from Google Places.",
    )
    parser.set_defaults(dry_run=True)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Plan/discover only; do not import leads. This is the default.",
    )
    parser.add_argument(
        "--live",
        dest="dry_run",
        action="store_false",
        help="Import discovered leads into LeadClaw. Requires LEAD_IMPORT_TOKEN.",
    )
    parser.add_argument("--limit", type=int, default=10, help="Maximum leads per run.")
    parser.add_argument(
        "--niche-mode",
        choices=["clinic", "local-service", "custom"],
        default="clinic",
        help="Default clinic mode keeps scraping aligned with current site positioning.",
    )
    parser.add_argument(
        "--niches",
        nargs="*",
        default=None,
        help="Explicit niche list. Overrides --niche-mode when supplied.",
    )
    parser.add_argument(
        "--locations",
        "--cities",
        nargs="*",
        default=None,
        help="Locations/cities to search. Defaults to London.",
    )
    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=1.0,
        help="Politeness delay between Google Places/detail requests.",
    )
    parser.add_argument(
        "--discover-emails",
        action="store_true",
        help="Opt in to safe public website email discovery after a valid website is found.",
    )
    parser.add_argument(
        "--email-discovery-max-pages",
        type=int,
        default=3,
        help="Maximum same-domain pages checked per website when --discover-emails is enabled.",
    )
    parser.add_argument(
        "--email-discovery-timeout",
        type=float,
        default=5.0,
        help="Timeout in seconds per website email discovery request.",
    )
    parser.add_argument(
        "--email-discovery-delay-seconds",
        type=float,
        default=0.5,
        help="Politeness delay between website email discovery page requests.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        config = build_config(
            dry_run=args.dry_run,
            limit=args.limit,
            niche_mode=args.niche_mode,
            niches=args.niches,
            locations=args.locations,
            delay_seconds=args.delay_seconds,
            discover_emails=args.discover_emails,
            email_discovery_max_pages=args.email_discovery_max_pages,
            email_discovery_timeout_seconds=args.email_discovery_timeout,
            email_discovery_delay_seconds=args.email_discovery_delay_seconds,
        )
    except ValueError as exc:
        log_event("scraper_config_invalid", error=str(exc))
        return 2

    log_event(
        "scraper_run_plan",
        dry_run=config.dry_run,
        limit=config.limit,
        niche_mode=config.niche_mode,
        niches=config.niches,
        locations=config.locations,
        delay_seconds=config.delay_seconds,
        email_discovery_enabled=config.email_discovery.enabled,
        email_discovery_max_pages=config.email_discovery.max_pages,
        email_discovery_timeout_seconds=config.email_discovery.timeout_seconds,
        email_discovery_delay_seconds=config.email_discovery.delay_seconds,
        google_key_configured=bool(config.google_places_api_key),
        import_url=config.import_url if not config.dry_run else None,
    )

    leads, skipped = discover_leads(config)
    log_event("scraper_discovery_complete", discovered=len(leads), skipped=len(skipped))

    try:
        result = import_leads(config, leads)
    except Exception as exc:
        log_event("scraper_import_failed", error=str(exc))
        return 1

    log_event(
        "scraper_import_complete",
        dry_run=config.dry_run,
        discovered=len(leads),
        skipped=len(skipped),
        result={k: v for k, v in result.items() if k != "leads"},
    )

    if config.dry_run:
        print(json.dumps({"leads": leads, "skipped": skipped}, indent=2, sort_keys=True))

    return 0


if __name__ == "__main__":
    sys.exit(main())
