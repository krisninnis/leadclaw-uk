import { getDeploymentEnv } from "@/lib/stripe-environment";

export function getAppBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = (env.NEXT_PUBLIC_APP_URL || env.APP_URL || "")
    .trim()
    .replace(/\/+$/, "");

  const vercelUrl = (env.VERCEL_URL || "")
    .trim()
    .replace(/\/+$/, "");

  const deploymentEnv = getDeploymentEnv(env);

  if (deploymentEnv === "production") {
    if (configured) return configured;
    if (vercelUrl) return `https://${vercelUrl}`;
  } else if (deploymentEnv === "preview") {
    if (vercelUrl) return `https://${vercelUrl}`;
    if (configured) return configured;
  } else if (configured) {
    return configured;
  }

  return "http://localhost:3000";
}
