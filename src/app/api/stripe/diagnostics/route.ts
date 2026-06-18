import { NextResponse } from "next/server";
import {
  evaluateStripeEnvironment,
  getStripeKeyMode,
} from "@/lib/stripe-environment";

export const runtime = "nodejs";

function maskTail(value?: string | null, keep = 4) {
  const s = (value || "").trim();

  if (!s) return null;
  if (s.length <= keep) return "*".repeat(s.length);

  const head = s.slice(0, Math.min(8, s.length - keep));

  return `${head}...${s.slice(-keep)}`;
}

export async function GET() {
  const env = process.env;

  const stripeEnv = evaluateStripeEnvironment(env);

  return NextResponse.json({
    ok: true,
    deployment: {
      vercelEnv: env.VERCEL_ENV || null,
      vercelUrl: env.VERCEL_URL || null,
      nodeEnv: env.NODE_ENV || null,
    },
    stripe: {
      deploymentEnv: stripeEnv.deploymentEnv,
      secretKeyMode: stripeEnv.keyMode,
      expectedMode: stripeEnv.expectedMode,
      consistent: stripeEnv.consistent,
      blocked: stripeEnv.blocked,
      publishableKeyMode: getStripeKeyMode(
        env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      ),
      growthPriceId: maskTail(env.STRIPE_PRICE_GROWTH),
      proPriceId: maskTail(env.STRIPE_PRICE_PRO),
    },
  });
}
