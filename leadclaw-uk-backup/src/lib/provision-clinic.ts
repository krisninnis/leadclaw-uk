import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTONOMOUS_TASK_ORDER, normalizeDomain } from "@/lib/onboarding";

type ProvisionClinicWorkspaceInput = {
  email: string;
  fallbackClinicName?: string | null;
  fallbackDomain?: string | null;
};

type ProvisionClinicWorkspaceResult = {
  ok: boolean;
  clientId: string | null;
  clinicId: string | null;
  siteId: string | null;
  widgetToken: string | null;
  domain: string | null;
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

  const { data: latestApp } = await admin
    .from("applications")
    .select("clinic_name,website,services,city")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const clinicName = String(
    latestApp?.clinic_name || input.fallbackClinicName || "Clinic Client",
  ).trim();

  const rawWebsite = String(
    latestApp?.website || input.fallbackDomain || "",
  ).trim();

  const domain = rawWebsite ? normalizeDomain(rawWebsite) : "test.leadclaw.uk";

  // 1) onboarding client
  const { data: existingClient } = await admin
    .from("onboarding_clients")
    .select("id")
    .eq("contact_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let clientId = existingClient?.id || null;

  if (!clientId) {
    const { data: insertedClient, error } = await admin
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
    clientId = insertedClient.id;
  }

  // 2) clinic
  // Live schema does not have clinics.onboarding_client_id,
  // so we resolve clinic ownership via owner_user_id when possible,
  // otherwise by latest matching clinic name.
  let ownerUserId: string | null = null;

  const { data: authUser } = await admin.auth.admin.listUsers();
  const matchedUser = authUser.users.find(
    (user) => (user.email || "").trim().toLowerCase() === email,
  );
  ownerUserId = matchedUser?.id || null;

  let clinicId: string | null = null;

  if (ownerUserId) {
    const { data: existingClinicByOwner } = await admin
      .from("clinics")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    clinicId = existingClinicByOwner?.id || null;
  }

  if (!clinicId) {
    const { data: existingClinicByName } = await admin
      .from("clinics")
      .select("id")
      .eq("name", clinicName)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    clinicId = existingClinicByName?.id || null;
  }

  if (!clinicId) {
    const { data: insertedClinic, error } = await admin
      .from("clinics")
      .insert({
        name: clinicName,
        owner_user_id: ownerUserId,
        subscription_status: "trialing",
        plan: "growth",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    clinicId = insertedClinic.id;
  } else {
    const clinicUpdate: Record<string, unknown> = {
      subscription_status: "trialing",
      plan: "growth",
    };

    if (ownerUserId) {
      clinicUpdate.owner_user_id = ownerUserId;
    }

    const { error: clinicUpdateError } = await admin
      .from("clinics")
      .update(clinicUpdate)
      .eq("id", clinicId);

    if (clinicUpdateError) throw new Error(clinicUpdateError.message);
  }

  // 3) site
  let siteId: string | null = null;

  const { data: existingSite } = await admin
    .from("onboarding_sites")
    .select("id,clinic_id")
    .eq("onboarding_client_id", clientId)
    .eq("domain", domain)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSite?.id) {
    siteId = existingSite.id;

    if (!existingSite.clinic_id && clinicId) {
      const { error: siteUpdateError } = await admin
        .from("onboarding_sites")
        .update({ clinic_id: clinicId })
        .eq("id", siteId);

      if (siteUpdateError) throw new Error(siteUpdateError.message);
    }
  } else {
    const { data: insertedSite, error } = await admin
      .from("onboarding_sites")
      .insert({
        onboarding_client_id: clientId,
        clinic_id: clinicId,
        domain,
        platform: "custom",
        settings: {
          services: latestApp?.services
            ? String(latestApp.services)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          city: latestApp?.city || null,
          signup_mode: "autonomous_provision",
        },
        status: "pending_install",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    siteId = insertedSite.id;
  }

  // 4) widget token
  let widgetToken: string | null = null;

  if (siteId) {
    const { data: existingToken } = await admin
      .from("widget_tokens")
      .select("token")
      .eq("onboarding_site_id", siteId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingToken?.token) {
      widgetToken = existingToken.token;
    } else {
      widgetToken = randomBytes(24).toString("hex");

      const { error } = await admin.from("widget_tokens").insert({
        onboarding_site_id: siteId,
        token: widgetToken,
        status: "active",
      });

      if (error) throw new Error(error.message);
    }

    // 5) onboarding tasks
    const { data: existingTasks } = await admin
      .from("onboarding_tasks")
      .select("id")
      .eq("onboarding_site_id", siteId)
      .limit(1);

    if (!existingTasks || existingTasks.length === 0) {
      const { error } = await admin.from("onboarding_tasks").insert(
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
