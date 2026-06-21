"use client";

import Link from "next/link";
import {
  LEGAL_TERMS_URL,
  LEGAL_PRIVACY_URL,
  LEGAL_DPA_URL,
  MARKETING_CONSENT_LABEL,
} from "@/lib/legal-consent";

type Props = {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingConsent: boolean;
  onTermsChange: (value: boolean) => void;
  onPrivacyChange: (value: boolean) => void;
  onMarketingChange: (value: boolean) => void;
  disabled?: boolean;
  // When true, shows a one-line pointer to the DPA (used in onboarding so the
  // customer-facing DPA is surfaced, not buried in the footer).
  showDpaReference?: boolean;
};

// Shared legal-acceptance + optional-marketing checkboxes used by signup and the
// onboarding wizard. The two legal checkboxes are mandatory; the marketing
// checkbox is optional and unticked by default. Gating ("cannot continue until
// both are checked") is enforced by the parent disabling its submit button.
export default function LegalConsentCheckboxes({
  termsAccepted,
  privacyAccepted,
  marketingConsent,
  onTermsChange,
  onPrivacyChange,
  onMarketingChange,
  disabled = false,
  showDpaReference = false,
}: Props) {
  return (
    <div className="space-y-2.5 text-left">
      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          checked={termsAccepted}
          disabled={disabled}
          onChange={(e) => onTermsChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
          required
        />
        <span>
          I agree to the{" "}
          <Link
            href={LEGAL_TERMS_URL}
            target="_blank"
            rel="noreferrer"
            className="underline text-foreground"
          >
            Terms of Service
          </Link>
          .
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          checked={privacyAccepted}
          disabled={disabled}
          onChange={(e) => onPrivacyChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
          required
        />
        <span>
          I have read the{" "}
          <Link
            href={LEGAL_PRIVACY_URL}
            target="_blank"
            rel="noreferrer"
            className="underline text-foreground"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          checked={marketingConsent}
          disabled={disabled}
          onChange={(e) => onMarketingChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          {MARKETING_CONSENT_LABEL}{" "}
          <span className="text-muted-2">(optional)</span>
        </span>
      </label>

      {showDpaReference && (
        <p className="text-xs text-muted-2">
          Processing of enquiries we handle on your behalf is governed by our{" "}
          <Link
            href={LEGAL_DPA_URL}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Data Processing Addendum
          </Link>
          .
        </p>
      )}
    </div>
  );
}
