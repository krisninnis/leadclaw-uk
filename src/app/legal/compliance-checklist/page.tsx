export default function ComplianceChecklistPage() {
  return (
    <article className="prose max-w-3xl">
      <h1>Outreach Compliance Checklist (UK)</h1>
      <p>Operational checklist for GDPR/PECR-aware outreach.</p>

      <h2>Before outreach</h2>
      <ul>
        <li>Define lawful basis for processing (typically legitimate interests for B2B context).</li>
        <li>Document balancing test and keep a record.</li>
        <li>Collect business-contact data from lawful sources.</li>
      </ul>

      <h2>Message content rules</h2>
      <ul>
        <li>Clearly identify your business and contact details.</li>
        <li>Avoid deceptive subject lines or claims.</li>
        <li>Include clear opt-out instructions.</li>
      </ul>

      <h2>Channel-specific caution</h2>
      <ul>
        <li>Email/SMS marketing may require additional PECR compliance checks.</li>
        <li>Cold messaging to personal addresses/numbers carries higher risk.</li>
        <li>Prefer targeted B2B, minimal-data, relevance-based outreach.</li>
      </ul>

      <h2>Data governance</h2>
      <ul>
        <li>Keep suppression list of opted-out contacts.</li>
        <li>Minimise retention of non-responsive contacts.</li>
        <li>Provide privacy notice and rights pathway.</li>
      </ul>

      <h2>Escalation</h2>
      <p>
        For regulated sectors or uncertain campaigns, obtain legal review before launch. This checklist is practical
        guidance, not legal advice.
      </p>
    </article>
  )
}
