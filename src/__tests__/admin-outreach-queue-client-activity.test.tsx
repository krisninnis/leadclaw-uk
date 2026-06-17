/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import QueueClient from "@/app/admin/outreach/queue/queue-client";

const leadA = {
  id: "lead_a",
  company_name: "Bright Plumbing Ltd",
  contact_email: "owner@brightplumbing.co.uk",
  contact_phone: "0123456789",
  website: "https://brightplumbing.co.uk",
  city: "London",
  niche: "plumber",
  lead_quality_score: 95,
  pecr_classification: "likely_corporate",
  email_quality: "medium",
  draft_subject: "Quick idea for Bright Plumbing Ltd",
  draft_body: "Hi Bright Plumbing Ltd team in London.",
};

const globalActivity = {
  id: "act_global",
  lead_id: "lead_a",
  action: "skipped",
  user_id: "admin-1",
  notes: null,
  metadata: {},
  created_at: "2026-06-17T09:00:00.000Z",
};

const leadActivity = {
  id: "act_lead",
  lead_id: "lead_a",
  action: "called",
  user_id: "admin-1",
  notes: null,
  metadata: {},
  created_at: "2026-06-17T10:00:00.000Z",
};

function installFetch() {
  const fetchMock = jest.fn(async (url: string) => {
    if (url.includes("/api/admin/outreach/activity")) {
      const activities = url.includes("lead_id=")
        ? [leadActivity]
        : [globalActivity];
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, activities }),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        leads: [leadA],
        totalChecked: 1,
        totalEligible: 1,
        templateMissing: false,
      }),
    } as unknown as Response;
  });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  return fetchMock;
}

describe("QueueClient activity display", () => {
  const originalFetch = global.fetch;
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    (global as unknown as { fetch: typeof originalFetch }).fetch = originalFetch;
  });

  it("shows the global Recent activity section", async () => {
    installFetch();
    render(<QueueClient />);

    // Activities load asynchronously after mount.
    const skipped = await screen.findByText("Skipped");
    const heading = screen.getByText("Recent activity");
    const section = heading.closest("div") as HTMLElement;
    expect(section.contains(skipped)).toBe(true);
  });

  it("loads per-lead activity when the draft panel is expanded", async () => {
    installFetch();
    render(<QueueClient />);
    await screen.findByText("Bright Plumbing Ltd");

    fireEvent.click(screen.getByRole("button", { name: "Preview draft" }));

    expect(
      await screen.findByText("Activity for this lead"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Marked called")).toBeInTheDocument();
  });
});
