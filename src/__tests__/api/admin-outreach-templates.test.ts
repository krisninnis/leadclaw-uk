import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/outreach-templates", () => ({
  listOutreachTemplates: jest.fn(),
  createOutreachTemplate: jest.fn(),
  updateOutreachTemplate: jest.fn(),
}));

import { requireAdmin } from "@/lib/api-auth";
import * as templatesLib from "@/lib/outreach-templates";
import { GET, POST } from "@/app/api/admin/outreach/templates/route";

const mockedRequireAdmin = jest.mocked(requireAdmin);
const mockedTemplatesLib = jest.mocked(templatesLib);

function adminOk() {
  mockedRequireAdmin.mockResolvedValue({
    ok: true,
    user: { id: "admin-1", email: "admin@leadclaw.uk" },
  });
}

function adminForbidden() {
  mockedRequireAdmin.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
  });
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("admin outreach templates API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("authentication gates", () => {
    it("GET: blocks non-admins with 403", async () => {
      adminForbidden();
      const res = await GET();
      expect(res.status).toBe(403);
      expect(mockedTemplatesLib.listOutreachTemplates).not.toHaveBeenCalled();
    });

    it("POST: blocks non-admins with 403", async () => {
      adminForbidden();
      const res = await POST(
        jsonRequest("http://localhost/api/admin/outreach/templates", "POST", {
          name: "My Pitch",
          subject_template: "Hello",
          body_template: "World",
        }),
      );
      expect(res.status).toBe(403);
      expect(mockedTemplatesLib.createOutreachTemplate).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/outreach/templates", () => {
    it("returns list of templates for admins", async () => {
      adminOk();
      const mockTemplates = [
        {
          id: "tpl-1",
          name: "Template A",
          subject_template: "Subject A",
          body_template: "Body A",
        },
      ];
      mockedTemplatesLib.listOutreachTemplates.mockResolvedValue(mockTemplates);

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.templates).toEqual(mockTemplates);
      expect(mockedTemplatesLib.listOutreachTemplates).toHaveBeenCalled();
    });

    it("returns 500 when list query fails", async () => {
      adminOk();
      mockedTemplatesLib.listOutreachTemplates.mockRejectedValue(new Error("DB error"));

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.ok).toBe(false);
      expect(body.error).toBe("DB error");
    });
  });

  describe("POST /api/admin/outreach/templates (create/update)", () => {
    it("creates a template when no id is provided", async () => {
      adminOk();
      const newTemplate = {
        id: "tpl-new",
        name: "Default Pitch",
        subject_template: "Check {{company_name}}",
        body_template: "Hi there.",
      };
      mockedTemplatesLib.createOutreachTemplate.mockResolvedValue(newTemplate);

      const res = await POST(
        jsonRequest("http://localhost/api/admin/outreach/templates", "POST", {
          name: "Default Pitch",
          subject_template: "Check {{company_name}}",
          body_template: "Hi there.",
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.ok).toBe(true);
      expect(body.template).toEqual(newTemplate);
      expect(mockedTemplatesLib.createOutreachTemplate).toHaveBeenCalledWith({
        name: "Default Pitch",
        subject_template: "Check {{company_name}}",
        body_template: "Hi there.",
      });
    });

    it("updates a template when id is provided", async () => {
      adminOk();
      const uuid = "11111111-1111-4111-a111-111111111111";
      const updatedTemplate = {
        id: uuid,
        name: "Updated Pitch",
        subject_template: "Hey {{company_name}}",
        body_template: "Changed body.",
      };
      mockedTemplatesLib.updateOutreachTemplate.mockResolvedValue(updatedTemplate);

      const res = await POST(
        jsonRequest("http://localhost/api/admin/outreach/templates", "POST", {
          id: uuid,
          name: "Updated Pitch",
          subject_template: "Hey {{company_name}}",
          body_template: "Changed body.",
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.template).toEqual(updatedTemplate);
      expect(mockedTemplatesLib.updateOutreachTemplate).toHaveBeenCalledWith(uuid, {
        name: "Updated Pitch",
        subject_template: "Hey {{company_name}}",
        body_template: "Changed body.",
      });
    });

    it("returns 400 validation error for thin payloads", async () => {
      adminOk();
      const res = await POST(
        jsonRequest("http://localhost/api/admin/outreach/templates", "POST", {
          name: "A", // too short
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.error).toBe("validation_failed");
    });

    it("returns 409 when the template name already exists", async () => {
      adminOk();
      mockedTemplatesLib.createOutreachTemplate.mockRejectedValue(
        new Error("duplicate key value violates unique constraint")
      );

      const res = await POST(
        jsonRequest("http://localhost/api/admin/outreach/templates", "POST", {
          name: "Duplicate Pitch",
          subject_template: "Hi",
          body_template: "Hello",
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.ok).toBe(false);
      expect(body.error).toBe("name_already_exists");
    });
  });
});
