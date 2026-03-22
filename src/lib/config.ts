export function getAppUrl() {
  // Vercel preview deployments (VERY useful)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Your main configured URL
  if (process.env.APP_URL) {
    return process.env.APP_URL.trim();
  }

  // Fallback (local dev)
  return "http://localhost:3000";
}
