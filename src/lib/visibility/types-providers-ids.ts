// Phase 3D — Provider id union.
// Kept in its own module so both types.ts and providers.ts can reference it
// without a circular import.

export type VisibilityProviderId =
  | "chatgpt"
  | "perplexity"
  | "google_ai_overviews"
  | "claude";
