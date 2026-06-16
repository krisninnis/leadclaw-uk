// Phase 3D — Future-ready provider interfaces.
//
// This file defines the *shape* of AI-visibility providers so that real
// integrations (ChatGPT, Perplexity, Google AI Overviews, Claude) can be added
// later without changing the engine, the database schema, or the UI.
//
// INTENTIONALLY NOT IMPLEMENTED. There is no provider logic here and nothing in
// this phase calls any external AI system, scrapes ChatGPT, or uses an
// unofficial API. We only declare the contracts a provider must satisfy and a
// metadata registry the dashboard uses to show "Coming soon".

import type { VisibilityProviderId } from "./types-providers-ids";

// Re-export so callers can `import { VisibilityProviderId } from "./providers"`.
export type { VisibilityProviderId };

// The query a provider would run on the user's behalf, e.g.
// "best aesthetic clinic in Leeds". Built from the business profile later.
export type ProviderQuery = {
  text: string;
  // Optional locale / market hint for region-aware engines.
  locale?: string;
};

// A single provider's answer about whether (and how) the business surfaced.
export type ProviderResult = {
  providerId: VisibilityProviderId;
  query: string;
  // Did the AI system mention/recommend this business for the query?
  mentioned: boolean;
  // 1-based position among recommendations, when the engine exposes ordering.
  rank: number | null;
  // The URL the engine cited for the business, if any.
  citationUrl: string | null;
  // Short verbatim snippet of how the business was described.
  snippet: string | null;
  // Provider-specific raw payload, retained for debugging / future scoring.
  raw?: unknown;
  checkedAt: string;
};

// The contract every concrete provider will implement in a later phase.
export interface VisibilityProvider {
  readonly id: VisibilityProviderId;
  readonly label: string;
  readonly description: string;
  // Whether the provider is wired up and credentialed in the current env.
  isAvailable(): boolean;
  // Run a single query and report how the business surfaced.
  query(input: ProviderQuery): Promise<ProviderResult>;
}

// Lifecycle of a provider integration, surfaced in the UI.
export type ProviderStatus = "coming_soon" | "beta" | "live";

export type ProviderMeta = {
  id: VisibilityProviderId;
  label: string;
  description: string;
  status: ProviderStatus;
};

// Metadata-only registry. Drives the "AI engines we track" section of the
// dashboard. No provider is live yet, so every entry is "coming_soon".
export const VISIBILITY_PROVIDERS: ProviderMeta[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    description:
      "How often ChatGPT recommends you when users ask for businesses like yours.",
    status: "coming_soon",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    description:
      "Whether Perplexity cites your site as a source in its answers.",
    status: "coming_soon",
  },
  {
    id: "google_ai_overviews",
    label: "Google AI Overviews",
    description:
      "Whether you appear in Google's AI-generated overview for relevant searches.",
    status: "coming_soon",
  },
  {
    id: "claude",
    label: "Claude",
    description:
      "How Claude describes and recommends your business when asked.",
    status: "coming_soon",
  },
];

// Provider registry placeholder. Concrete providers will be registered here as
// they ship; the engine and UI already iterate over this without code changes.
export const REGISTERED_PROVIDERS: Record<
  VisibilityProviderId,
  VisibilityProvider | null
> = {
  chatgpt: null,
  perplexity: null,
  google_ai_overviews: null,
  claude: null,
};

export function getAvailableProviders(): VisibilityProvider[] {
  return Object.values(REGISTERED_PROVIDERS).filter(
    (p): p is VisibilityProvider => p !== null && p.isAvailable(),
  );
}
