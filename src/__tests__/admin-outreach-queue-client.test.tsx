/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import QueueClient, { type QueueResponse } from "@/app/admin/outreach/queue/queue-client";

function mockFetch(body: QueueResponse, ok = true, status = 200) {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(
    async () =>
      ({
        ok,
        status,
        json: async () => body,
      }) as unknown as Response,
  );
}

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

const leadB = {
  id: "lead_b",
  company_name: "Sparks Electrical",
  contact_email: "hello@sparks.co.uk",
  contact_phone: null,
  website: null,
  city: "Leeds",
  niche: "electrician",
  lead_quality_score: 60,
  pecr_classification: "likely_corporate",
  email_quality: "high",
  draft_subject: "Quick idea for Sparks Electrical",
  draft_body: "Hi Sparks Electrical team in Leeds.",
};

describe("QueueClient", () => {
  const original = global.fetch;
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    (global as unknown as { fetch: typeof original }).fetch = original;
  });

  it("renders a lead returned from the API", async () => {
    mockFetch({
      ok: true,
      leads: [leadA],
      totalChecked: 1,
      totalEligible: 1,
      templateMissing: false,
    });

    render(<QueueClient />);

    expect(await screen.findByText("Bright Plumbing Ltd")).toBeInTheDocument();
    expect(screen.getByText("owner@brightplumbing.co.uk")).toBeInTheDocument();
    expect(screen.getByText(/Preview only/i)).toBeInTheDocument();
  });

  it("filters by email quality", async () => {
    mockFetch({
      ok: true,
      leads: [leadA, leadB],
      totalChecked: 2,
      totalEligible: 2,
      templateMissing: false,
    });

    render(<QueueClient />);
    expect(await screen.findByText("Bright Plumbing Ltd")).toBeInTheDocument();
    expect(screen.getByText("Sparks Electrical")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email quality"), {
      target: { value: "high" },
    });

    expect(screen.queryByText("Bright Plumbing Ltd")).not.toBeInTheDocument();
    expect(screen.getByText("Sparks Electrical")).toBeInTheDocument();
  });

  it("filters by minimum score", async () => {
    mockFetch({
      ok: true,
      leads: [leadA, leadB],
      totalChecked: 2,
      totalEligible: 2,
    });

    render(<QueueClient />);
    await screen.findByText("Bright Plumbing Ltd");

    fireEvent.change(screen.getByLabelText("Minimum score"), {
      target: { value: "80" },
    });

    expect(screen.getByText("Bright Plumbing Ltd")).toBeInTheDocument();
    expect(screen.queryByText("Sparks Electrical")).not.toBeInTheDocument();
  });

  it("expands and previews the draft body", async () => {
    mockFetch({
      ok: true,
      leads: [leadA],
      totalChecked: 1,
      totalEligible: 1,
    });

    render(<QueueClient />);
    await screen.findByText("Bright Plumbing Ltd");

    expect(
      screen.queryByText("Hi Bright Plumbing Ltd team in London."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview draft" }));

    expect(
      screen.getByText("Hi Bright Plumbing Ltd team in London."),
    ).toBeInTheDocument();
  });

  it("shows the empty state when no eligible leads are returned", async () => {
    mockFetch({
      ok: true,
      leads: [],
      totalChecked: 0,
      totalEligible: 0,
    });

    render(<QueueClient />);

    expect(
      await screen.findByText(/No eligible outreach leads right now/i),
    ).toBeInTheDocument();
  });

  it("shows the template-missing warning while still listing leads", async () => {
    mockFetch({
      ok: true,
      leads: [leadA],
      totalChecked: 1,
      totalEligible: 1,
      templateMissing: true,
    });

    render(<QueueClient />);

    expect(
      await screen.findByText(/No active outreach template found/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Bright Plumbing Ltd")).toBeInTheDocument();
  });

  it("shows an error state when the API fails", async () => {
    mockFetch({ ok: false, error: "forbidden" }, false, 403);

    render(<QueueClient />);

    expect(
      await screen.findByText(/Could not load the outreach queue/i),
    ).toBeInTheDocument();
  });
});
