/**
 * @jest-environment jsdom
 */

const React = require("react");
const { render, screen } = require("@testing-library/react");
const userEvent = require("@testing-library/user-event").default;

jest.mock("@/lib/ga", () => ({
  queueGaEvent: jest.fn(),
  trackGaEvent: jest.fn(),
}));

jest.mock("@/components/auth/google-icon", () => function GoogleIcon() {
  return require("react").createElement("span", {
    "data-testid": "google-icon",
  });
});

const SignupForm = require("@/app/free-trial/_components/signup-form").default;

function renderSignupForm(overrides = {}) {
  const props = {
    onSuccess: jest.fn(),
    selectedPlan: "growth",
    buildIntake: jest.fn((input) => ({
      ...input,
      email: input.email.trim().toLowerCase(),
      plan: "growth",
    })),
    saveTrialIntake: jest.fn(),
    saveIntakeToBackend: jest.fn().mockResolvedValue(undefined),
    buildNextUrl: jest.fn(
      () => "/portal?startTrial=1&trial=started&setup=ready&plan=growth",
    ),
    supabase: {
      auth: {
        signInWithOAuth: jest.fn().mockResolvedValue({ error: null }),
      },
    },
    ...overrides,
  };

  render(React.createElement(SignupForm, props));

  return props;
}

describe("free trial Google sign-in", () => {
  it("launches Supabase Google OAuth without posting an empty intake first", async () => {
    const props = renderSignupForm();

    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(props.saveIntakeToBackend).not.toHaveBeenCalled();
    expect(props.supabase.auth.signInWithOAuth).toHaveBeenCalledTimes(1);

    const oauthRequest =
      props.supabase.auth.signInWithOAuth.mock.calls[0][0];

    expect(oauthRequest.provider).toBe("google");
    expect(decodeURIComponent(oauthRequest.options.redirectTo)).toContain(
      "/api/auth/callback?next=/portal?startTrial=1&trial=started&setup=ready&plan=growth",
    );
  });

  it("keeps the Google button out of the password form submit path", () => {
    renderSignupForm();

    expect(
      screen
        .getByRole("button", { name: /continue with google/i })
        .getAttribute("type"),
    ).toBe("button");
  });

  it("preserves a Pro trial plan through the Google OAuth redirect", async () => {
    const props = renderSignupForm({
      selectedPlan: "pro",
      buildNextUrl: jest.fn(
        () => "/portal?startTrial=1&trial=started&setup=ready&plan=pro",
      ),
    });

    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    const oauthRequest =
      props.supabase.auth.signInWithOAuth.mock.calls[0][0];

    expect(decodeURIComponent(oauthRequest.options.redirectTo)).toContain(
      "/api/auth/callback?next=/portal?startTrial=1&trial=started&setup=ready&plan=pro",
    );
  });
});
