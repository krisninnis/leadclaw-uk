import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { upsertStripeSubscription } from "@/lib/subscriptions";
import { logSystemEvent } from "@/lib/ops";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";
import { createAdminClient } from "@/lib/supabase/admin";

function planFromPriceId(priceId?: string | null) {
  if (!priceId) return null;

  const growth = process.env.STRIPE_PRICE_GROWTH;
  const pro = process.env.STRIPE_PRICE_PRO;

  if (priceId === growth) return "growth";
  if (priceId === pro) return "pro";

  return null;
}

async function syncApplicationPlan(email: string, plan: "growth" | "pro") {
  const admin = createAdminClient();
  if (!admin) return;

  const normalizedEmail = email.trim().toLowerCase();

  const { data: existingRow } = await admin
    .from("applications")
    .select("id")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRow?.id) {
    await admin.from("applications").update({ plan }).eq("id", existingRow.id);
  }
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json(
      { ok: false, error: "webhook_not_configured" },
      { status: 400 },
    );
  }

  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { ok: false, error: "missing_signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "invalid_signature";

    await logSystemEvent({
      level: "error",
      category: "stripe_webhook",
      message,
    });

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (subscriptionId) {
          const subResp = await stripe.subscriptions.retrieve(subscriptionId);
          const sub = subResp as Stripe.Subscription;
          const priceId = sub.items.data[0]?.price?.id || null;
          const userId = (session.metadata?.userId ||
            sub.metadata?.userId ||
            null) as string | null;
          const email =
            session.customer_details?.email || session.customer_email || null;

          await upsertStripeSubscription({
            userId,
            email,
            customerId:
              typeof session.customer === "string"
                ? session.customer
                : session.customer?.id,
            subscriptionId: sub.id,
            priceId,
            plan: planFromPriceId(priceId),
            status: sub.status,
            trialEnd: sub.trial_end,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });

          if (email) {
            try {
              const resolvedPlan = planFromPriceId(priceId);

              if (resolvedPlan === "growth" || resolvedPlan === "pro") {
                await provisionClinicWorkspace({
                  email,
                  plan: resolvedPlan,
                  subscriptionStatus:
                    sub.status === "active" ? "active" : "trialing",
                });
                await syncApplicationPlan(email, resolvedPlan);
              }
            } catch (err) {
              await logSystemEvent({
                level: "warn",
                category: "onboarding",
                message: "Stripe checkout completed but provisioning failed",
                meta: {
                  email,
                  subscriptionId: sub.id,
                  priceId,
                  plan: planFromPriceId(priceId),
                  error: err instanceof Error ? err.message : "unknown",
                },
              });
            }
          }
        }

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price?.id || null;

        await upsertStripeSubscription({
          userId: (sub.metadata?.userId || null) as string | null,
          customerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          subscriptionId: sub.id,
          priceId,
          plan: planFromPriceId(priceId),
          status: sub.status,
          trialEnd: sub.trial_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        await logSystemEvent({
          level: "warn",
          category: "billing",
          message: "Invoice payment failed",
          meta: {
            customerId:
              typeof invoice.customer === "string"
                ? invoice.customer
                : invoice.customer?.id,
            invoiceId: invoice.id,
          },
        });

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "webhook_processing_failed";

    await logSystemEvent({
      level: "error",
      category: "stripe_webhook",
      message,
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
