import { createAdminClient } from "@/lib/supabase/admin";

export interface OutreachTemplateLead {
  company_name?: string | null;
  city?: string | null;
  website?: string | null;
  niche?: string | null;
  contact_email?: string | null;
  lead_quality_score?: number | null;
  pecr_classification?: string | null;
}

export type OutreachTemplateStatus = "active" | "archived";

export interface OutreachTemplate {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  status: OutreachTemplateStatus;
  created_at?: string;
  updated_at?: string;
}

type SupabaseError = {
  message: string;
};

type SupabaseSingleResult<T> = Promise<{
  data: T | null;
  error: SupabaseError | null;
}>;

type SupabaseListResult<T> = Promise<{
  data: T[] | null;
  error: SupabaseError | null;
}>;

type OutreachTemplateQuery<T> = {
  select(columns: string): OutreachTemplateQuery<T>;
  order(column: string, options?: { ascending?: boolean }): SupabaseListResult<T>;
  eq(column: string, value: string): OutreachTemplateQuery<T>;
  single(): SupabaseSingleResult<T>;
  maybeSingle(): SupabaseSingleResult<T>;
};

type OutreachTemplateDeleteQuery = {
  eq(column: string, value: string): Promise<{ error: SupabaseError | null }>;
};

type OutreachTemplatesTable = {
  select(columns: string): OutreachTemplateQuery<OutreachTemplate>;
  insert(values: Record<string, unknown>): OutreachTemplateQuery<OutreachTemplate>;
  update(values: Record<string, unknown>): OutreachTemplateQuery<OutreachTemplate>;
  delete(): OutreachTemplateDeleteQuery;
};

type OutreachTemplatesAdminClient = {
  from(table: "outreach_templates"): OutreachTemplatesTable;
};

function createOutreachTemplatesAdminClient(): OutreachTemplatesAdminClient {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("supabase_not_configured");
  }

  return admin as unknown as OutreachTemplatesAdminClient;
}

/**
 * Render template variables safely using lead details.
 * Supports: {{company_name}}, {{city}}, {{website}}, {{niche}}, {{contact_email}}, {{lead_quality_score}}, {{pecr_classification}}
 */
export function renderOutreachTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
  lead: OutreachTemplateLead,
): { subject: string; body: string } {
  const vars: Record<string, string> = {
    company_name: lead.company_name || "",
    city: lead.city || "",
    website: lead.website || "",
    niche: lead.niche || "",
    contact_email: lead.contact_email || "",
    lead_quality_score: lead.lead_quality_score != null ? String(lead.lead_quality_score) : "",
    pecr_classification: lead.pecr_classification || "",
  };

  const replaceVars = (text: string) => {
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return key in vars ? vars[key] : match;
    });
  };

  return {
    subject: replaceVars(subjectTemplate),
    body: replaceVars(bodyTemplate),
  };
}

export async function listOutreachTemplates(): Promise<OutreachTemplate[]> {
  const admin = createOutreachTemplatesAdminClient();

  const { data, error } = await admin
    .from("outreach_templates")
    .select("id, name, subject_template, body_template, status, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("[outreach-templates] list failed", error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function createOutreachTemplate(input: {
  name: string;
  subject_template: string;
  body_template: string;
  status?: OutreachTemplateStatus;
}): Promise<OutreachTemplate> {
  const admin = createOutreachTemplatesAdminClient();

  const { data, error } = await admin
    .from("outreach_templates")
    .insert({
      name: input.name,
      subject_template: input.subject_template,
      body_template: input.body_template,
      status: input.status ?? "active",
    })
    .select("id, name, subject_template, body_template, status, created_at, updated_at")
    .single();

  if (error) {
    console.error("[outreach-templates] create failed", error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("template_create_returned_no_data");
  }

  return data;
}

export async function getOutreachTemplateById(id: string): Promise<OutreachTemplate | null> {
  const admin = createOutreachTemplatesAdminClient();

  const { data, error } = await admin
    .from("outreach_templates")
    .select("id, name, subject_template, body_template, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[outreach-templates] get failed", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateOutreachTemplate(
  id: string,
  input: {
    name?: string;
    subject_template?: string;
    body_template?: string;
    status?: OutreachTemplateStatus;
  },
): Promise<OutreachTemplate> {
  const admin = createOutreachTemplatesAdminClient();

  const { data, error } = await admin
    .from("outreach_templates")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name, subject_template, body_template, status, created_at, updated_at")
    .single();

  if (error) {
    console.error("[outreach-templates] update failed", error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("template_update_returned_no_data");
  }

  return data;
}

export async function deleteOutreachTemplate(id: string): Promise<void> {
  const admin = createOutreachTemplatesAdminClient();

  const { error } = await admin
    .from("outreach_templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[outreach-templates] delete failed", error);
    throw new Error(error.message);
  }
}
