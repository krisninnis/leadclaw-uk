import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTONOMOUS_TASK_ORDER, normalizeDomain } from "@/lib/onboarding";

type ProvisionPlan = "basic" | "growth" | "pro";
type ProvisionSubscriptionStatus = "active" | "trialing";

type ProvisionClinicWorkspaceInput = {
  email: string;
  fallbackClinicName?: string | null;
  fallbackDomain?: string | null;
  plan?: ProvisionPlan;
  subscriptionStatus?: ProvisionSubscriptionStatus;
};

type ProvisionClinicWorkspaceResult = {
  ok: boolean;
  clientId: string | null;
  clinicId: string | null;
  siteId: string | null;
  widgetToken: string | null;
  domain: string | null;
};

type ApplicationProvisionRow = {
  clinic_name: string | null;
  website: string | null;
  services: string | null;
  city: string | null;
  contact_name: string | null;
};

type IdRow = {
  id: string;
};

type ExistingSiteRow = {
  id: string;
  clinic_id: string | null;
};

type WidgetTokenRow = {
  token: string | null;
};

export async function provisionClinicWorkspace(
  input: ProvisionClinicWorkspaceInput,
): Promise<ProvisionClinicWorkspaceResult> {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("supabase_not_configured");
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error("missing_email");
  }

  const resolvedPlan: ProvisionPlan = input.plan ?? "growth";
  const resolvedSubscriptionStatus: ProvisionSubscriptionStatus =
    input.subscriptionStatus ??
    (resolvedPlan === "basic" ? "active" : "trialing");

  const { data: latestApp } = await (admin as any)
    .from("applications")
    .select("clinic_name,website,services,city,contact_name")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestApplication = latestApp as ApplicationProvisionRow | null;

  const clinicName = String(
    latestApplication?.clinic_name ||
      input.fallbackClinicName ||
      "Workspace Client",
  ).trim();

  const rawWebsite = String(
    latestApplication?.website || input.fallbackDomain || "",
  ).trim();

  const domain = rawWebsite ? normalizeDomain(rawWebsite) : "test.leadclaw.uk";

  // 0) keep profiles table in sync
  let ownerUserId: string | null = null;
  let matchedUserEmail: string | null = null;
  let matchedUserName: string | null = null;

  const { data: authUsersPage, error: listUsersError } =
    await admin.auth.admin.listUsers();

  if (listUsersError) {
    throw new Error(listUsersError.message);
  }

  const matchedUser = authUsersPage.users.find(
    (user) => (user.email || "").trim().toLowerCase() === email,
  );

  ownerUserId = matchedUser?.id || null;
  matchedUserEmail = (matchedUser?.email || "").trim().toLowerCase() || null;
  matchedUserName =
    String(matchedUser?.user_metadata?.name || "").trim() ||
    String(matchedUser?.user_metadata?.full_name || "").trim() ||
    String(latestApplication?.contact_name || "").trim() ||
    null;

  if (ownerUserId) {
    const { error: profileUpsertError } = await (admin as any).from("profiles").upsert(
      {
        id: ownerUserId,
        role: "client",
        name: matchedUserName,
        phone: null,
        clinic_name: clinicName || null,
        email: matchedUserEmail,
        city: latestApplication?.city || null,
        services: latestApplication?.services || null,
      },
      { onConflict: "id" },
    );

    if (profileUpsertError) {
      throw new Error(profileUpsertError.message);
    }
  }

  // 1) onboarding client
  const { data: existingClient } = await (admin as any)
    .from("onboarding_clients")
    .select("id")
    .eq("contact_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let clientId = (existingClient as IdRow | null)?.id || null;

  if (!clientId) {
    const { data: insertedClient, error } = await (admin as any)
      .from("onboarding_clients")
      .insert({
        client_name: clinicName,
        business_name: clinicName,
        contact_email: email,
        status: "intake_received",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    clientId = (insertedClient as IdRow).id;
  }

  // 2) clinic
  let clinicId: string | null = null;

  if (ownerUserId) {
    const { data: existingClinicByOwner } = await (admin as any)
      .from("clinics")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    clinicId = (existingClinicByOwner as IdRow | null)?.id || null;
  }

  if (!clinicId) {
    const { data: existingClinicByName } = await (admin as any)
      .from("clinics")
      .select("id")
      .eq("name", clinicName)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    clinicId = (existingClinicByName as IdRow | null)?.id || null;
  }

  if (!clinicId) {
    const { data: insertedClinic, error } = await (admin as any)
      .from("clinics")
      .insert({
        name: clinicName,
        owner_user_id: ownerUserId,
        subscription_status: resolvedSubscriptionStatus,
        plan: resolvedPlan,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    clinicId = (insertedClinic as IdRow).id;
  } else {
    const clinicUpdate: Record<string, unknown> = {
      subscription_status: resolvedSubscriptionStatus,
      plan: resolvedPlan,
    };

    if (ownerUserId) {
      clinicUpdate.owner_user_id = ownerUserId;
    }

    const { error: clinicUpdateError } = await (admin as any)
      .from("clinics")
      .update(clinicUpdate)
      .eq("id", clinicId);

    if (clinicUpdateError) throw new Error(clinicUpdateError.message);
  }

  // 3) site
  let siteId: string | null = null;

  const { data: existingSite } = await (admin as any)
    .from("onboarding_sites")
    .select("id,clinic_id")
    .eq("onboarding_client_id", clientId)
    .eq("domain", domain)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingSiteRow = existingSite as ExistingSiteRow | null;

  if (existingSiteRow?.id) {
    siteId = existingSiteRow.id;

    if (!existingSiteRow.clinic_id && clinicId) {
      const { error: siteUpdateError } = await (admin as any)
        .from("onboarding_sites")
        .update({ clinic_id: clinicId })
        .eq("id", siteId);

      if (siteUpdateError) throw new Error(siteUpdateError.message);
    }
  } else {
    const { data: insertedSite, error } = await (admin as any)
      .from("onboarding_sites")
      .insert({
        onboarding_client_id: clientId,
        clinic_id: clinicId,
        domain,
        platform: "custom",
        settings: {
          services: latestApplication?.services
            ? String(latestApplication.services)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          city: latestApplication?.city || null,
          signup_mode: "autonomous_provision",
          plan: resolvedPlan,
        },
        status: "pending_install",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    siteId = (insertedSite as IdRow).id;
  }

  // 4) widget token
  let widgetToken: string | null = null;

  if (siteId) {
    const { data: existingToken } = await (admin as any)
      .from("widget_tokens")
      .select("token")
      .eq("onboarding_site_id", siteId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingWidgetToken = existingToken as WidgetTokenRow | null;

    if (existingWidgetToken?.token) {
      widgetToken = existingWidgetToken.token;
    } else {
      widgetToken = randomBytes(24).toString("hex");

      const { error } = await (admin as any).from("widget_tokens").insert({
        onboarding_site_id: siteId,
        token: widgetToken,
        status: "active",
      });

      if (error) throw new Error(error.message);
    }

    // 5) onboarding tasks
    const { data: existingTasks } = await (admin as any)
      .from("onboarding_tasks")
      .select("id")
      .eq("onboarding_site_id", siteId)
      .limit(1);

    if (!existingTasks || existingTasks.length === 0) {
      const { error } = await (admin as any).from("onboarding_tasks").insert(
        AUTONOMOUS_TASK_ORDER.map((taskType, idx) => ({
          onboarding_site_id: siteId,
          task_type: taskType,
          status: "queued",
          sequence: idx + 1,
        })),
      );

      if (error) throw new Error(error.message);
    }
  }

  return {
    ok: true,
    clientId,
    clinicId,
    siteId,
    widgetToken,
    domain,
  };
}
