import Link from "next/link";

type NoticeConfig = {
  title: string;
  body: string;
  actions: Array<{
    href: string;
    label: string;
    primary?: boolean;
  }>;
};

function getNotice(error: string | null | undefined): NoticeConfig | null {
  const code = String(error || "")
    .trim()
    .toLowerCase();

  if (!code) return null;

  if (
    code === "already_subscribed" ||
    code === "active_subscription_exists" ||
    code === "paid_or_trial_subscription_exists"
  ) {
    return {
      title: "You already have an active LeadClaw account",
      body: "Continue to your workspace or manage billing if you want to change plan.",
      actions: [
        { href: "/portal", label: "Go to portal", primary: true },
        { href: "/portal/billing", label: "Manage billing" },
      ],
    };
  }

  if (code === "trial_already_active") {
    return {
      title: "Your free trial is already active",
      body: "You can continue setup from your portal. Billing is available if you want to change plan.",
      actions: [
        { href: "/portal", label: "Go to portal", primary: true },
        { href: "/portal/billing", label: "Manage billing" },
      ],
    };
  }

  if (code === "trial_already_used") {
    return {
      title: "Your previous trial has ended",
      body: "Choose a plan to continue with full automation, or contact support if this looks wrong.",
      actions: [
        { href: "/portal/billing?expired=1", label: "Choose plan", primary: true },
        { href: "/contact", label: "Contact support" },
      ],
    };
  }

  if (code === "billing_setup_required") {
    return {
      title: "Your account needs billing setup",
      body: "Your account exists, but billing needs to be completed before full access can continue.",
      actions: [
        { href: "/portal/billing", label: "Set up billing", primary: true },
        { href: "/contact", label: "Contact support" },
      ],
    };
  }

  return {
    title: "We could not complete signup automatically",
    body: "Please try again, continue to your portal, or contact support if the issue repeats.",
    actions: [
      { href: "/portal", label: "Go to portal", primary: true },
      { href: "/contact", label: "Contact support" },
    ],
  };
}

export default function AccountFlowNotice({
  error,
}: {
  error?: string | null;
}) {
  const notice = getNotice(error);
  if (!notice) return null;

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <h2 className="text-base font-semibold">{notice.title}</h2>
      <p className="mt-2 text-sm leading-6">{notice.body}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {notice.actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={action.primary ? "button-primary" : "button-secondary"}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
