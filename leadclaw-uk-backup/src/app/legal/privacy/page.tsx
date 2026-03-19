export default function PrivacyPage() {
  return (
    <article className="prose max-w-3xl">
      <h1>Privacy Policy</h1>
      <p>Last updated: 22 February 2026</p>

      <h2>1. Who we are</h2>
      <p>
        LeadClaw AI (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides AI lead capture and workflow software. We are the controller for
        personal data collected through our website and account onboarding.
      </p>

      <h2>2. Data we collect</h2>
      <ul>
        <li>Identity and contact data (name, email, phone, business details)</li>
        <li>Service configuration data (clinic services, lead volumes, notes)</li>
        <li>Technical data (IP, browser, logs, device information)</li>
        <li>Billing metadata via Stripe (we do not store full card details)</li>
      </ul>

      <h2>3. How we use data</h2>
      <ul>
        <li>Provide and improve our Services</li>
        <li>Administer trials, subscriptions, support, and account security</li>
        <li>Comply with legal obligations and prevent abuse/fraud</li>
        <li>Send service communications and operational updates</li>
      </ul>

      <h2>4. Lawful bases (UK GDPR)</h2>
      <ul>
        <li>Contract performance (service delivery)</li>
        <li>Legitimate interests (service improvement, security, B2B operations)</li>
        <li>Legal obligation (tax/accounting/regulatory)</li>
        <li>Consent where required (optional marketing)</li>
      </ul>

      <h2>5. Data sharing</h2>
      <p>
        We share data only with trusted processors and infrastructure providers (e.g., hosting, Supabase, Stripe,
        messaging APIs), subject to confidentiality and data protection obligations.
      </p>

      <h2>6. International transfers</h2>
      <p>
        Where data is transferred outside the UK, we use appropriate safeguards (such as UK IDTA/addendum or equivalent
        contractual protections) where required.
      </p>

      <h2>7. Retention</h2>
      <p>
        We retain personal data only as long as necessary for service provision, legal compliance, dispute resolution,
        and legitimate business records.
      </p>

      <h2>8. Security</h2>
      <p>
        We implement technical and organisational security controls, but no system is 100% secure. You should also
        maintain strong access controls for your account.
      </p>

      <h2>9. Your rights</h2>
      <p>
        Subject to applicable law, you may request access, correction, deletion, restriction, objection, portability,
        and withdrawal of consent (where consent is used). Contact us to exercise rights.
      </p>

      <h2>10. Complaints</h2>
      <p>
        You may contact us first at support@leadclaw.ai. You also have the right to complain to the UK Information
        Commissioner&apos;s Office (ICO).
      </p>

      <h2>11. Cookies</h2>
      <p>
        We may use essential cookies and analytics cookies. Where legally required, we obtain consent before non-
        essential cookies.
      </p>

      <h2>12. Contact</h2>
      <p>Privacy contact: support@leadclaw.ai</p>
    </article>
  )
}
