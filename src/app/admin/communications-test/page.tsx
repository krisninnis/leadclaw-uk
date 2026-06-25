import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SmsTestForm from "./sms-test-form";

async function requireAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const isAdminEmail =
    !!user.email && adminEmails.includes(user.email.toLowerCase());
  const isAdmin = profile?.role === "admin" || isAdminEmail;

  if (!isAdmin) redirect("/portal");

  return user;
}

export default async function CommunicationsTestPage() {
  const user = await requireAdminPage();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="page-hero">
        <div className="card-premium p-6 md:p-8">
          <div className="badge-soft">
            <span className="h-2 w-2 rounded-full bg-brand" />
            Admin-only communications test
          </div>

          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            Send one safe SMS test
          </h1>

          <p className="mt-4 text-lg leading-8 text-muted">
            Proves the full outbound path: admin trigger,{" "}
            <span className="font-mono">sendSms()</span>, active SMS provider,
            and the existing communication event log.
          </p>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted">
            <span>
              Signed in as{" "}
              <span className="font-medium text-foreground">{user.email}</span>
            </span>
            <span>•</span>
            <Link href="/admin" className="underline underline-offset-4">
              Back to admin
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-950">
            Test message
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use <span className="font-mono">COMMUNICATIONS_SMS_PROVIDER=mock</span>{" "}
            for dry-run verification, or{" "}
            <span className="font-mono">twilio</span> with Twilio env vars for a
            controlled real send.
          </p>
        </div>

        <SmsTestForm />
      </section>
    </div>
  );
}
