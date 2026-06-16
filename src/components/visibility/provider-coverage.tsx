// Phase 3 — AI Visibility (Foundation)
// "AI engines we track" grid. Driven entirely by the metadata registry in
// src/lib/visibility/providers.ts — no provider is live yet, so each card shows
// a "Coming soon" badge. When a real provider ships, flip its status and the
// card updates with no change here.

import { VISIBILITY_PROVIDERS, type ProviderStatus } from "@/lib/visibility/providers";

const STATUS_BADGE: Record<ProviderStatus, { label: string; classes: string }> = {
  coming_soon: { label: "Coming soon", classes: "border-border bg-surface-2 text-muted" },
  beta: { label: "Beta", classes: "border-amber-200 bg-amber-50 text-amber-700" },
  live: { label: "Live", classes: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

export default function ProviderCoverage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {VISIBILITY_PROVIDERS.map((p) => {
        const badge = STATUS_BADGE[p.status];
        return (
          <div
            key={p.id}
            className="flex flex-col rounded-2xl border border-border bg-white px-4 py-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground">{p.label}</p>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.classes}`}>
                {badge.label}
              </span>
            </div>
            <p className="mt-2 text-sm leading-7 text-muted">{p.description}</p>
          </div>
        );
      })}
    </div>
  );
}
