/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SmsTestForm from "@/app/admin/communications-test/sms-test-form";

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

describe("SmsTestForm", () => {
  it("shows a visible sent result from the admin SMS test endpoint", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        channel: "sms",
        provider: "mock",
        providerMessageId: "mock-sms-1",
        eventId: "evt_1",
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SmsTestForm />);

    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "07700 900123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send test SMS" }));

    await waitFor(() => {
      expect(screen.getByText("Result: sent")).toBeTruthy();
    });

    expect(screen.getByText("evt_1")).toBeTruthy();
    const calls = fetchMock.mock.calls as unknown as Array<
      [string, RequestInit]
    >;
    expect(calls[0][0]).toBe("/api/admin/communications/test-sms");
    expect(calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        to: "07700 900123",
        message: "LeadClaw SMS test: your communications layer is working.",
      }),
    });
  });

  it("shows provider_not_configured without exposing provider detail", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: false,
        channel: "sms",
        provider: "mock",
        error: "provider_not_configured",
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SmsTestForm />);

    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "+447700900123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send test SMS" }));

    await waitFor(() => {
      expect(
        screen.getByText("Result: provider_not_configured"),
      ).toBeTruthy();
    });

    expect(
      screen.getByText("No SMS provider is configured, so no message was sent."),
    ).toBeTruthy();
    expect(screen.queryByText(/TWILIO_AUTH_TOKEN/i)).toBeNull();
  });
});
