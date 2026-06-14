import unittest

from scraper_core import (
    build_config,
    dedupe_leads,
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


if __name__ == "__main__":
    unittest.main()
