export type StripeKeyMode = "live" | "test" | "missing" | "unknown";
export type DeploymentEnv = "production" | "preview" | "development";

export function getStripeKeyMode(key?: string | null): StripeKeyMode {
  const trimmed = (key || "").trim();
  if (!trimmed) return "missing";
  if (/^(sk|rk|pk)_live_/.test(trimmed)) return "live";
  if (/^(sk|rk|pk)_test_/.test(trimmed)) return "test";
  return "unknown";
}

export function getDeploymentEnv(
  env: NodeJS.ProcessEnv = process.env,
): DeploymentEnv {
  const vercelEnv = (env.VERCEL_ENV || "").trim().toLowerCase();

  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";

  return "development";
}

export function getExpectedStripeMode(
  deploymentEnv: DeploymentEnv = getDeploymentEnv(),
): "live" | "test" {
  return deploymentEnv === "production" ? "live" : "test";
}

export type StripeEnvironmentEvaluation = {
  deploymentEnv: DeploymentEnv;
  keyMode: StripeKeyMode;
  expectedMode: "live" | "test";
  consistent: boolean;
  blocked: boolean;
  reason: string;
};

export function evaluateStripeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): StripeEnvironmentEvaluation {
  const deploymentEnv = getDeploymentEnv(env);
  const keyMode = getStripeKeyMode(env.STRIPE_SECRET_KEY);
  const expectedMode = getExpectedStripeMode(deploymentEnv);

  const allowMismatch =
    (env.STRIPE_ALLOW_MODE_MISMATCH || "").trim().toLowerCase() === "true";

  if (keyMode === "missing") {
    return {
      deploymentEnv,
      keyMode,
      expectedMode,
      consistent: false,
      blocked: false,
      reason: "STRIPE_SECRET_KEY is not set",
    };
  }

  if (keyMode === "unknown") {
    return {
      deploymentEnv,
      keyMode,
      expectedMode,
      consistent: false,
      blocked: false,
      reason: "Unknown Stripe key format",
    };
  }

  const consistent = keyMode === expectedMode;
  const blocked = !consistent && !allowMismatch;

  return {
    deploymentEnv,
    keyMode,
    expectedMode,
    consistent,
    blocked,
    reason: consistent
      ? `OK: ${keyMode} key in ${deploymentEnv}`
      : `MISMATCH: ${keyMode} key in ${deploymentEnv}`,
  };
}
