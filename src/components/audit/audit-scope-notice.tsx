// Shared scope disclaimer shown wherever audit / AI-readiness results are
// displayed. The audit (and the readiness report derived from it) only looks at
// a single page's static HTML — it is not a full-site crawl and does not run a
// browser (no Lighthouse / PageSpeed rendering). Being explicit about this
// keeps the product honest and avoids overclaiming.

export default function AuditScopeNotice({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border border-border bg-surface-2 px-4 py-3 text-xs leading-6 text-muted ${className}`}
    >
      <span className="font-semibold text-foreground">How this is measured: </span>
      We analyse a single page (your homepage) from its static HTML. This is not a
      full-site crawl, and we don&apos;t run a browser or Lighthouse/PageSpeed
      rendering — so JavaScript-rendered content and other pages aren&apos;t
      included.
    </div>
  );
}
