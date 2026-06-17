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
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
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

// fetch mock: GET returns the queue; POST action endpoints return { ok, status }.
function installFetch() {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, status: "ok" }),
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

describe("QueueClient actions", () => {
  const originalFetch = global.fetch;
  const originalConfirm = global.confirm;
  const originalPrompt = global.prompt;

  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    window.prompt = jest.fn(() => "typed@acme.co.uk");
  });

  afterEach(() => {
    (global as unknown as { fetch: typeof originalFetch }).fetch = originalFetch;
    window.confirm = originalConfirm;
    window.prompt = originalPrompt;
  });

  it("has no Send button anywhere", async () => {
    installFetch();
    render(<QueueClient />);
    await screen.findByText("Bright Plumbing Ltd");

    expect(
      screen.queryByRole("button", { name: /send/i }),
    ).not.toBeInTheDocument();
  });

  it("clicking Skip calls the skip endpoint and removes the row", async () => {
    const fetchMock = installFetch();
    render(<QueueClient />);
    await screen.findByText("Bright Plumbing Ltd");

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/outreach/queue/skip",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Bright Plumbing Ltd")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Lead skipped.");
  });

  it("clicking Mark Called calls the mark-called endpoint", async () => {
    const fetchMock = installFetch();
    render(<QueueClient />);
    await screen.findByText("Bright Plumbing Ltd");

    fireEvent.click(screen.getByRole("button", { name: "Mark Called" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/outreach/queue/mark-called",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("clicking Do Not Contact calls the do-not-contact endpoint with the email", async () => {
    const fetchMock = installFetch();
    render(<QueueClient />);
    await screen.findByText("Bright Plumbing Ltd");

    fireEvent.click(screen.getByRole("button", { name: "Do Not Contact" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/outreach/queue/do-not-contact",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const dncCall = fetchMock.mock.calls.find(
      ([url]) => url === "/api/admin/outreach/queue/do-not-contact",
    );
    const sentBody = JSON.parse((dncCall?.[1] as RequestInit).body as string);
    expect(sentBody).toEqual({
      lead_id: "lead_a",
      email: "owner@brightplumbing.co.uk",
    });
  });

  it("does not call the endpoint if the confirmation is cancelled", async () => {
    const fetchMock = installFetch();
    window.confirm = jest.fn(() => false);
    render(<QueueClient />);
    await screen.findByText("Bright Plumbing Ltd");

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/outreach/queue/skip",
      expect.anything(),
    );
    expect(screen.getByText("Bright Plumbing Ltd")).toBeInTheDocument();
  });
});
