/**
 * @jest-environment jsdom
 */
// ClawLabsLocal — Landing Page Builder (UX improvement)
// Editor UX: country/region/city dropdowns, custom city fallback, Generate
// draft, and per-section "Use template defaults" buttons. No network is needed
// for any of these interactions (draft generation is pure/local).
import "@testing-library/jest-dom";
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
} from "@jest/globals";
import { render, screen, fireEvent, within } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

import LandingPageEditor from "@/components/landing/landing-page-editor";
import { CUSTOM_OPTION } from "@/lib/landing/locations";

const TEMPLATES = [{ id: "t1", key: "dentist", name: "Dentist (local)" }];

function renderEditor() {
  return render(
    <LandingPageEditor mode="create" initialPage={null} templates={TEMPLATES} />,
  );
}

// Select the template (first combobox) + a city so generation is enabled.
function selectTemplateAndCity(city = "Nottingham") {
  const combos = screen.getAllByRole("combobox");
  fireEvent.change(combos[0], { target: { value: "t1" } });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: city } });
}

describe("location dropdowns", () => {
  beforeEach(() => {
    window.confirm = jest.fn(() => true) as unknown as typeof window.confirm;
  });

  it("defaults the country to GB", () => {
    renderEditor();
    expect((screen.getByLabelText("Country") as HTMLSelectElement).value).toBe(
      "GB",
    );
  });

  it("changing country changes the city options", () => {
    renderEditor();
    const city = screen.getByLabelText("City");
    expect(within(city).getByRole("option", { name: "London" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Country"), {
      target: { value: "US" },
    });

    expect(
      within(city).queryByRole("option", { name: "London" }),
    ).not.toBeInTheDocument();
    expect(
      within(city).getByRole("option", { name: "Chicago" }),
    ).toBeInTheDocument();
  });

  it("changing country changes the region options", () => {
    renderEditor();
    const region = screen.getByLabelText("Region");
    expect(
      within(region).getByRole("option", { name: "East Midlands" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Country"), {
      target: { value: "AU" },
    });

    expect(
      within(region).queryByRole("option", { name: "East Midlands" }),
    ).not.toBeInTheDocument();
    expect(
      within(region).getByRole("option", { name: "Queensland" }),
    ).toBeInTheDocument();
  });

  it("supports a custom city via the manual fallback", () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: CUSTOM_OPTION },
    });
    const custom = screen.getByLabelText("Custom city") as HTMLInputElement;
    fireEvent.change(custom, { target: { value: "Smalltown" } });
    expect(custom.value).toBe("Smalltown");
    expect(
      screen.getByText("Use custom city when the location is not listed."),
    ).toBeInTheDocument();
  });
});

describe("Generate draft", () => {
  beforeEach(() => {
    window.confirm = jest.fn(() => true) as unknown as typeof window.confirm;
  });

  it("fills SEO, H1, FAQs and services without fabricating business fields", () => {
    renderEditor();
    selectTemplateAndCity("Nottingham");
    fireEvent.click(screen.getByText("Generate draft"));

    // H1 + SEO title localised.
    expect(screen.getByDisplayValue("Dentist in Nottingham")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Dentist in Nottingham | LeadClaw"),
    ).toBeInTheDocument();

    // At least the minimum FAQ pairs.
    expect(
      screen.getAllByPlaceholderText("Question").length,
    ).toBeGreaterThanOrEqual(3);

    // A service was filled.
    expect(
      screen.getByDisplayValue("New patient enquiries"),
    ).toBeInTheDocument();

    // Never fabricated: business name, phone, rating all remain empty.
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe(
      "",
    );
    expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("4.8") as HTMLInputElement).value).toBe(
      "",
    );
    expect((screen.getByPlaceholderText("126") as HTMLInputElement).value).toBe(
      "",
    );
  });
});

describe("section-level Use template defaults", () => {
  beforeEach(() => {
    window.confirm = jest.fn(() => true) as unknown as typeof window.confirm;
  });

  it("fills only the chosen section, leaving others untouched", () => {
    renderEditor();
    selectTemplateAndCity("Nottingham");

    // Buttons are in section order: pains, benefits, features, useCases, faq,
    // services. Click the Benefits one (index 1).
    const buttons = screen.getAllByText("Use template defaults");
    fireEvent.click(buttons[1]);

    // Benefits is now filled with the localised default…
    expect(
      screen.getByDisplayValue(
        "Respond to Nottingham enquiries quickly with a consistent, structured intake.",
      ),
    ).toBeInTheDocument();

    // …but the Pain points section was NOT touched (its first default is absent).
    expect(
      screen.queryByDisplayValue(
        "Enquiries arrive by phone, web form, and social at all hours, and busy dentists in Nottingham can miss them during appointments.",
      ),
    ).not.toBeInTheDocument();
  });

  it("does nothing when the user cancels the confirmation", () => {
    window.confirm = jest.fn(() => false) as unknown as typeof window.confirm;
    renderEditor();
    selectTemplateAndCity("Nottingham");

    fireEvent.click(screen.getAllByText("Use template defaults")[1]);
    expect(
      screen.queryByDisplayValue(
        "Respond to Nottingham enquiries quickly with a consistent, structured intake.",
      ),
    ).not.toBeInTheDocument();
  });
});
