import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logSystemEvent } from "@/lib/ops";

type SubscriptionRow = {
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: string | null;
};

const CANCELABLE_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "incomplete",
]);

function shouldCancel(status?: string | null) {
  return !!status && CANCELABLE_STATUSES.has(status);
}

function isRealStripeSubscriptionId(value?: string | null) {
  return typeof value === "string" && value.startsWith("sub_");
}

function isRealStripeCustomerId(value?: string | null) {
  return typeof value === "string" && value.startsWith("cus_");
}

export async function POST() {
  const authed = await requireUser();
  if (!authed.ok) return authed.response;

  const admin = createAdminClient();
  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured" },
      { status: 500 },
    );
  }

  try {
    const subscriptionIds = new Set<string>();
    const customerIds = new Set<string>();
    const normalizedEmail = authed.user.email?.trim().toLowerCase() ?? "";

    const ingest = (row: SubscriptionRow | null) => {
      if (!row) return;

      if (
        row.stripe_customer_id &&
        isRealStripeCustomerId(row.stripe_customer_id)
      ) {
        customerIds.add(row.stripe_customer_id);
      }

      if (
        row.stripe_subscription_id &&
        isRealStripeSubscriptionId(row.stripe_subscription_id) &&
        shouldCancel(row.status)
      ) {
        subscriptionIds.add(row.stripe_subscription_id);
      }
    };

    const { data: byUser, error: byUserError } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id, status")
      .eq("user_id", authed.user.id);

    if (byUserError) {
      return NextResponse.json(
        { ok: false, error: byUserError.message },
        { status: 500 },
      );
    }

    (byUser ?? []).forEach((row) => ingest(row as SubscriptionRow));

    if (normalizedEmail) {
      const { data: byEmail, error: byEmailError } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id, stripe_customer_id, status")
        .eq("email", normalizedEmail);

      if (byEmailError) {
        return NextResponse.json(
          { ok: false, error: byEmailError.message },
          { status: 500 },
        );
      }

      (byEmail ?? []).forEach((row) => ingest(row as SubscriptionRow));
    }

    for (const customerId of customerIds) {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });

      for (const sub of list.data) {
        if (shouldCancel(sub.status)) {
          subscriptionIds.add(sub.id);
        }
      }
    }

    const canceledSubscriptions: string[] = [];

    for (const subscriptionId of subscriptionIds) {
      const sub = await stripe.subscriptions.cancel(subscriptionId, {
        prorate: false,
      });

      canceledSubscriptions.push(sub.id);
    }

    const { error: deleteSubsByUserError } = await admin
      .from("subscriptions")
      .delete()
      .eq("user_id", authed.user.id);

    if (deleteSubsByUserError) {
      return NextResponse.json(
        { ok: false, error: deleteSubsByUserError.message },
        { status: 500 },
      );
    }

    if (normalizedEmail) {
      const { error: deleteSubsByEmailError } = await admin
        .from("subscriptions")
        .delete()
        .eq("email", normalizedEmail);

      if (deleteSubsByEmailError) {
        return NextResponse.json(
          { ok: false, error: deleteSubsByEmailError.message },
          { status: 500 },
        );
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(
      authed.user.id,
    );

    if (deleteError) {
      await logSystemEvent({
        level: "error",
        category: "account_delete",
        message: "Billing canceled but auth user deletion failed",
        meta: {
          userId: authed.user.id,
          email: normalizedEmail || null,
          canceledSubscriptions,
          error: deleteError.message,
        },
      });

      return NextResponse.json(
        { ok: false, error: "user_delete_failed_after_billing_cancel" },
        { status: 500 },
      );
    }

    await logSystemEvent({
      level: "info",
      category: "account_delete",
      message: "User deleted account via self-serve profile flow",
      meta: {
        userId: authed.user.id,
        email: normalizedEmail || null,
        canceledSubscriptions,
      },
    });

    return NextResponse.json({
      ok: true,
      canceledSubscriptions,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "account_delete_failed";

    await logSystemEvent({
      level: "error",
      category: "account_delete",
      message,
      meta: {
        userId: authed.user.id,
        email: authed.user.email ?? null,
      },
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
