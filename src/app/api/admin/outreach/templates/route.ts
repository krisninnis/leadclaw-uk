import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import {
  listOutreachTemplates,
  createOutreachTemplate,
  updateOutreachTemplate,
} from "@/lib/outreach-templates";

export const runtime = "nodejs";

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  subject_template: z.string().min(1, "Subject template is required").max(255),
  body_template: z.string().min(1, "Body template is required"),
});

export async function GET() {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  try {
    const templates = await listOutreachTemplates();
    return NextResponse.json({ ok: true, templates });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "failed_to_list_templates";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = templateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "validation_failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { id, name, subject_template, body_template } = parsed.data;

    if (id) {
      const template = await updateOutreachTemplate(id, {
        name,
        subject_template,
        body_template,
      });
      return NextResponse.json({ ok: true, template });
    } else {
      const template = await createOutreachTemplate({
        name,
        subject_template,
        body_template,
      });
      return NextResponse.json({ ok: true, template }, { status: 201 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "failed_to_save_template";

    // Handle postgres unique name constraint violation
    if (msg.toLowerCase().includes("unique constraint") || msg.toLowerCase().includes("duplicate key")) {
      return NextResponse.json({ ok: false, error: "name_already_exists" }, { status: 409 });
    }

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
