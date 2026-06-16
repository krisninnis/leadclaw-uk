import json
import unittest
from unittest.mock import patch

from email_discovery import (
    EmailDiscoveryConfig,
    EmailDiscoveryResult,
    PageFetchResult,
    choose_best_email,
    classify_website_quality,
    discover_public_email,
    extract_email_candidates,
    merge_email_discovery_into_lead,
    public_page_urls,
)
from scraper_core import (
    GOOGLE_HTTP_STATUS_KEY,
    build_config,
    dedupe_leads,
    discover_leads,
    import_leads,
    lead_from_place,
    select_niches,
)


class ScraperCoreTests(unittest.TestCase):
    def test_clinic_mode_is_default_safe_niche_set(self):
        self.assertEqual(select_niches("clinic"), ["beauty", "dental"])

    def test_local_service_mode_requires_explicit_selection(self):
        self.assertIn("plumber", select_niches("local-service"))
        self.assertIn("estate_agent", select_niches("local-service"))

    def test_explicit_niches_override_mode(self):
        self.assertEqual(select_niches("clinic", ["plumber"]), ["plumber"])

    def test_live_config_requires_import_token(self):
        with self.assertRaisesRegex(ValueError, "LEAD_IMPORT_TOKEN"):
            build_config(
                dry_run=False,
                limit=1,
                niche_mode="clinic",
                niches=None,
                locations=["London"],
                delay_seconds=0,
                env={"GOOGLE_PLACES_API_KEY": "google-key"},
            )

    def test_dry_run_config_does_not_require_env(self):
        config = build_config(
            dry_run=True,
            limit=1,
            niche_mode="clinic",
            niches=None,
            locations=["London"],
            delay_seconds=0,
            env={},
        )

        self.assertTrue(config.dry_run)
        self.assertEqual(config.niches, ["beauty", "dental"])
        self.assertFalse(config.email_discovery.enabled)

    def test_dedupes_before_import(self):
        leads = [
            {"company_name": "A Ltd", "city": "London", "website": "https://a.example"},
            {"company_name": "A Ltd", "city": "London", "website": "https://a.example"},
            {"company_name": "B Ltd", "city": "London", "website": ""},
        ]

        kept, skipped = dedupe_leads(leads)

        self.assertEqual(len(kept), 2)
        self.assertEqual(skipped[0]["reason"], "duplicate_in_batch")

    def test_dry_run_import_does_not_write(self):
        config = build_config(
            dry_run=True,
            limit=1,
            niche_mode="clinic",
            niches=None,
            locations=["London"],
            delay_seconds=0,
            env={},
        )

        result = import_leads(config, [{"company_name": "A Ltd"}])

        self.assertTrue(result["dry_run"])
        self.assertEqual(result["would_import"], 1)

    def test_payload_shape_from_google_place_details(self):
        lead, reason = lead_from_place(
            place={"name": "Calm Clinic", "formatted_address": "London"},
            details={
                "result": {
                    "name": "Calm Clinic",
                    "website": "https://calmclinic.example",
                    "formatted_phone_number": "020 0000 0000",
                    "rating": 4.8,
                    "user_ratings_total": 48,
                }
            },
            niche="beauty",
            city="London",
        )

        self.assertIsNone(reason)
        self.assertEqual(lead["source"], "google-places")
        self.assertEqual(lead["contact_email"], "")
        self.assertEqual(lead["company_name"], "Calm Clinic")

    def test_logs_google_zero_results_status_without_api_key(self):
        config = build_config(
            dry_run=True,
            limit=5,
            niche_mode="custom",
            niches=["plumber"],
            locations=["Leeds"],
            delay_seconds=0,
            env={"GOOGLE_PLACES_API_KEY": "test-google-key"},
        )

        with (
            patch("scraper_core.queries_for", return_value=["plumber"]),
            patch(
                "scraper_core.google_text_search",
                return_value={
                    "status": "ZERO_RESULTS",
                    "results": [],
                    GOOGLE_HTTP_STATUS_KEY: 200,
                },
            ),
            patch("scraper_core.log_event") as log_event,
        ):
            leads, skipped = discover_leads(config)

        self.assertEqual(leads, [])
        self.assertEqual(skipped, [])

        response_event = next(
            call.kwargs
            for call in log_event.call_args_list
            if call.args[0] == "google_places_search_response"
        )
        summary_event = next(
            call.kwargs
            for call in log_event.call_args_list
            if call.args[0] == "google_places_search_filter_summary"
        )

        self.assertEqual(response_event["http_status"], 200)
        self.assertEqual(response_event["google_status"], "ZERO_RESULTS")
        self.assertEqual(response_event["result_count_before_filtering"], 0)
        self.assertEqual(summary_event["result_count_after_filtering"], 0)
        self.assertEqual(summary_event["skip_reason"], "google_status_not_ok")
        self.assertNotIn("test-google-key", str(log_event.call_args_list))

    def test_logs_google_denied_error_message(self):
        config = build_config(
            dry_run=True,
            limit=5,
            niche_mode="custom",
            niches=["beauty"],
            locations=["London"],
            delay_seconds=0,
            env={"GOOGLE_PLACES_API_KEY": "test-google-key"},
        )

        with (
            patch("scraper_core.queries_for", return_value=["beauty salon"]),
            patch(
                "scraper_core.google_text_search",
                return_value={
                    "status": "REQUEST_DENIED",
                    "error_message": "API project is not authorised",
                    "results": [],
                    GOOGLE_HTTP_STATUS_KEY: 200,
                },
            ),
            patch("scraper_core.log_event") as log_event,
        ):
            discover_leads(config)

        response_event = next(
            call.kwargs
            for call in log_event.call_args_list
            if call.args[0] == "google_places_search_response"
        )

        self.assertEqual(response_event["google_status"], "REQUEST_DENIED")
        self.assertEqual(response_event["error_message"], "API project is not authorised")
        self.assertNotIn("test-google-key", str(log_event.call_args_list))

    def test_logs_result_counts_after_filtering(self):
        config = build_config(
            dry_run=True,
            limit=5,
            niche_mode="custom",
            niches=["plumber"],
            locations=["Leeds"],
            delay_seconds=0,
            env={"GOOGLE_PLACES_API_KEY": "test-google-key"},
        )

        with (
            patch("scraper_core.queries_for", return_value=["plumber"]),
            patch(
                "scraper_core.google_text_search",
                return_value={
                    "status": "OK",
                    "results": [
                        {"name": "Missing Place Id"},
                        {"name": "Platform Only", "place_id": "place_1"},
                    ],
                    GOOGLE_HTTP_STATUS_KEY: 200,
                },
            ),
            patch(
                "scraper_core.google_place_details",
                return_value={
                    "status": "OK",
                    "result": {
                        "name": "Platform Only",
                        "website": "https://www.instagram.com/platformonly",
                    },
                    GOOGLE_HTTP_STATUS_KEY: 200,
                },
            ),
            patch("scraper_core.log_event") as log_event,
        ):
            leads, skipped = discover_leads(config)

        self.assertEqual(leads, [])
        self.assertEqual(len(skipped), 2)

        search_summary = next(
            call.kwargs
            for call in log_event.call_args_list
            if call.args[0] == "google_places_search_filter_summary"
        )
        details_response = next(
            call.kwargs
            for call in log_event.call_args_list
            if call.args[0] == "google_place_details_response"
        )
        details_summary = next(
            call.kwargs
            for call in log_event.call_args_list
            if call.args[0] == "google_place_details_filter_summary"
        )

        self.assertEqual(search_summary["result_count_before_filtering"], 2)
        self.assertEqual(search_summary["result_count_after_filtering"], 0)
        self.assertEqual(search_summary["skipped_count"], 2)
        self.assertEqual(details_response["http_status"], 200)
        self.assertEqual(details_response["google_status"], "OK")
        self.assertEqual(details_response["result_count_before_filtering"], 1)
        self.assertEqual(details_summary["result_count_after_filtering"], 0)
        self.assertEqual(details_summary["skipped_reason"], "platform_only_website")

    def test_email_discovery_prefers_role_email_over_personal_email(self):
        candidates = extract_email_candidates(
            "Email kris@example.com or info@example.com",
            source_url="https://example.com/contact",
            website_host="example.com",
        )
        best = choose_best_email(candidates)

        lead = merge_email_discovery_into_lead(
            {"notes": "{}"},
            EmailDiscoveryResult(
                contact_email=best.email if best else "",
                confidence=best.confidence if best else None,
                source_url="https://example.com/contact",
                candidates_count=len(candidates),
                pages_checked=1,
                status="found",
            ),
        )

        self.assertIsNotNone(best)
        self.assertEqual(best.email, "info@example.com")
        self.assertEqual(json.loads(lead["notes"])["email_collection"], "website_public_contact_page")

    def test_email_discovery_ignores_noreply_privacy_and_file_artifacts(self):
        candidates = extract_email_candidates(
            "noreply@example.com privacy@example.com dpo@example.com abuse@example.com logo@2x.png hello@example.com",
            source_url="https://example.com/contact",
            website_host="example.com",
        )

        self.assertEqual([candidate.email for candidate in candidates], ["hello@example.com"])

    def test_email_discovery_safe_pages_include_v2_paths_without_changing_default(self):
        urls = public_page_urls("https://example.com/start?utm=test", 7)

        self.assertEqual(
            urls,
            [
                "https://example.com/",
                "https://example.com/contact",
                "https://example.com/contact-us",
                "https://example.com/about",
                "https://example.com/about-us",
                "https://example.com/team",
                "https://example.com/get-in-touch",
            ],
        )
        self.assertEqual(
            public_page_urls("https://example.com", 3),
            [
                "https://example.com/",
                "https://example.com/contact",
                "https://example.com/contact-us",
            ],
        )

    def test_email_discovery_prioritises_mailto_over_footer_for_same_role(self):
        candidates = extract_email_candidates(
            """
            <a href="mailto:hello@example.com">Email us</a>
            <footer>Reach us at hello.footer@example.com</footer>
            """,
            source_url="https://example.com/contact",
            website_host="example.com",
        )
        best = choose_best_email(candidates)

        self.assertIsNotNone(best)
        self.assertEqual(best.email, "hello@example.com")
        self.assertEqual(best.source_kind, "mailto")

    def test_email_discovery_extracts_footer_and_structured_data_emails(self):
        candidates = extract_email_candidates(
            """
            <script type="application/ld+json">
            {
              "@type": "LocalBusiness",
              "contactPoint": {"email": "contact@example.com"}
            }
            </script>
            <footer>Footer email reception@example.com</footer>
            """,
            source_url="https://example.com/contact",
            website_host="example.com",
        )

        by_email = {candidate.email: candidate for candidate in candidates}
        self.assertEqual(by_email["contact@example.com"].source_kind, "structured_data")
        self.assertEqual(by_email["reception@example.com"].source_kind, "footer")

    def test_classifies_website_quality(self):
        cases = {
            "https://example.co.uk": "business_website",
            "https://clinic.com": "business_website",
            "https://facebook.com/example": "social_profile",
            "https://www.instagram.com/example": "social_profile",
            "https://fresha.com/book/example": "booking_platform",
            "https://book.app/example": "booking_platform",
            "https://www.yell.com/biz/example": "directory_listing",
            "https://cylex-uk.co.uk/company/example": "directory_listing",
            "not a url": "unknown",
        }

        for url, expected in cases.items():
            with self.subTest(url=url):
                self.assertEqual(classify_website_quality(url), expected)

    def test_email_discovery_contact_page_and_same_domain_only(self):
        config = EmailDiscoveryConfig(enabled=True, max_pages=3, delay_seconds=0, timeout_seconds=1)

        def fake_fetch(url, **kwargs):
            if url.endswith("/"):
                return PageFetchResult(url, 200, "No email here")
            if url.endswith("/contact"):
                return PageFetchResult(
                    url,
                    200,
                    "Contact us at hello@example.com or kris@example.com",
                )
            return PageFetchResult("https://evil.example/contact-us", 302, "", "redirected_off_domain")

        with (
            patch("email_discovery.fetch_robots_rules", return_value=None),
            patch("email_discovery.fetch_website_page", side_effect=fake_fetch),
            patch("email_discovery.time.sleep"),
        ):
            result = discover_public_email(
                "https://example.com?utm_source=test",
                company_name="Example Ltd",
                config=config,
            )

        self.assertEqual(result.contact_email, "hello@example.com")
        self.assertEqual(result.confidence, "high")
        self.assertEqual(result.source_url, "https://example.com/contact")

    def test_email_discovery_skips_non_business_websites_without_fetching(self):
        config = EmailDiscoveryConfig(enabled=True, max_pages=3, delay_seconds=0, timeout_seconds=1)

        with (
            patch("email_discovery.fetch_robots_rules") as fetch_robots,
            patch("email_discovery.fetch_website_page") as fetch_page,
            patch("email_discovery.noop_log") as _noop_log,
        ):
            result = discover_public_email(
                "https://treatwell.co.uk/place/example",
                company_name="Example Clinic",
                config=config,
            )

        self.assertEqual(result.contact_email, "")
        self.assertEqual(result.status, "skipped")
        self.assertEqual(result.reason, "non_business_website:booking_platform")
        fetch_robots.assert_not_called()
        fetch_page.assert_not_called()

    def test_email_discovery_no_email_found_case(self):
        config = EmailDiscoveryConfig(enabled=True, max_pages=1, delay_seconds=0, timeout_seconds=1)

        with (
            patch("email_discovery.fetch_robots_rules", return_value=None),
            patch(
                "email_discovery.fetch_website_page",
                return_value=PageFetchResult("https://example.com/", 200, "Call us today"),
            ),
        ):
            result = discover_public_email("https://example.com", config=config)

        self.assertEqual(result.contact_email, "")
        self.assertEqual(result.status, "not_found")
        self.assertEqual(result.reason, "no_safe_email_found")

    def test_email_discovery_metadata_added_to_notes(self):
        lead = {
            "company_name": "Example Ltd",
            "contact_email": "",
            "notes": json.dumps({"source": "google-places-textsearch"}),
        }
        result = EmailDiscoveryResult(
            contact_email="info@example.com",
            confidence="high",
            source_url="https://example.com/contact",
            candidates_count=2,
            pages_checked=2,
            status="found",
        )

        updated = merge_email_discovery_into_lead(lead, result)
        notes = json.loads(updated["notes"])

        self.assertEqual(updated["contact_email"], "info@example.com")
        self.assertEqual(notes["email_collection"], "website_public_contact_page")
        self.assertEqual(notes["email_confidence"], "high")
        self.assertEqual(notes["email_source_url"], "https://example.com/contact")
        self.assertEqual(notes["email_candidates_count"], 2)

    def test_discover_leads_adds_email_only_when_enabled_without_logging_key(self):
        config = build_config(
            dry_run=True,
            limit=1,
            niche_mode="custom",
            niches=["plumber"],
            locations=["Leeds"],
            delay_seconds=0,
            discover_emails=True,
            email_discovery_delay_seconds=0,
            env={"GOOGLE_PLACES_API_KEY": "test-google-key"},
        )

        with (
            patch("scraper_core.queries_for", return_value=["plumber"]),
            patch(
                "scraper_core.google_text_search",
                return_value={
                    "status": "OK",
                    "results": [{"name": "Example Plumbing", "place_id": "place_1"}],
                    GOOGLE_HTTP_STATUS_KEY: 200,
                },
            ),
            patch(
                "scraper_core.google_place_details",
                return_value={
                    "status": "OK",
                    "result": {
                        "name": "Example Plumbing",
                        "website": "https://example.com",
                    },
                    GOOGLE_HTTP_STATUS_KEY: 200,
                },
            ),
            patch(
                "scraper_core.discover_public_email",
                return_value=EmailDiscoveryResult(
                    contact_email="info@example.com",
                    confidence="high",
                    source_url="https://example.com/contact",
                    candidates_count=1,
                    pages_checked=2,
                    status="found",
                ),
            ),
            patch("scraper_core.log_event") as log_event,
        ):
            leads, skipped = discover_leads(config)

        self.assertEqual(skipped, [])
        self.assertEqual(leads[0]["contact_email"], "info@example.com")
        self.assertEqual(
            json.loads(leads[0]["notes"])["email_collection"],
            "website_public_contact_page",
        )
        self.assertNotIn("test-google-key", str(log_event.call_args_list))


if __name__ == "__main__":
    unittest.main()
