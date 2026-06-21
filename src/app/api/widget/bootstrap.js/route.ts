import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseLeadClawProduct } from "@/lib/subscription-access";
import { WIDGET_CONSENT_NOTICE } from "@/lib/legal-consent";

type WidgetSiteRow = {
  id: string | null;
  domain: string | null;
  clinic_id: string | null;
  status: string | null;
  onboarding_client_id: string | null;
};

type WidgetTokenRow = {
  token: string | null;
  status: string | null;
  onboarding_site_id: string | null;
  onboarding_sites: WidgetSiteRow | WidgetSiteRow[] | null;
};

type OnboardingClientContactRow = {
  contact_email: string | null;
};

type SubscriptionStatusRow = {
  status: string | null;
};

function escapeForScript(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

function javascriptResponse(body: string) {
  return new NextResponse(body.trim(), {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;

  if (!token) {
    const safeAppUrl = escapeForScript(appUrl);

    return javascriptResponse(`
(() => {
  const currentScript = document.currentScript;
  const scriptWithToken =
    currentScript ||
    document.querySelector('script[data-claw-token][src*="/api/widget/bootstrap.js"]');

  const token =
    scriptWithToken?.getAttribute("data-claw-token") ||
    window.clawWidgetToken ||
    "";

  if (!token) {
    console.warn("[LeadClaw widget] Missing widget token.");
    return;
  }

  const reloadKey = "__leadclawBootstrapReloaded:" + token;
  if (window[reloadKey]) return;
  window[reloadKey] = true;

  const script = document.createElement("script");
  const src = new URL("${safeAppUrl}/api/widget/bootstrap.js");
  src.searchParams.set("token", token);
  script.src = src.toString();
  script.defer = true;
  script.crossOrigin = "anonymous";
  script.setAttribute("data-claw-token", token);
  document.head.appendChild(script);
})();
    `);
  }

  const admin = createAdminClient();

  if (!admin) {
    return javascriptResponse(
      `console.warn("[LeadClaw widget] Admin client unavailable.");`,
    );
  }

  const { data: tokenRow } = await (admin as unknown as SupabaseUntypedClient)
    .from("widget_tokens")
    .select(
      `
        token,
        status,
        onboarding_site_id,
        onboarding_sites (
          id,
          domain,
          clinic_id,
          status,
          onboarding_client_id
        )
      `,
    )
    .eq("token", token)
    .eq("status", "active")
    .maybeSingle();

  const widgetToken = tokenRow as WidgetTokenRow | null;

  if (!widgetToken || !widgetToken.onboarding_site_id) {
    return javascriptResponse(
      `console.warn("[LeadClaw widget] Invalid or inactive widget token.");`,
    );
  }

  const site = Array.isArray(widgetToken.onboarding_sites)
    ? widgetToken.onboarding_sites[0]
    : widgetToken.onboarding_sites;

  const clinicId = site?.clinic_id ? String(site.clinic_id) : "";
  const siteId = site?.id ? String(site.id) : "";
  const clinicDomain = site?.domain ? String(site.domain) : "";
  const siteStatus = site?.status ? String(site.status) : "pending_install";
  const onboardingClientId = site?.onboarding_client_id
    ? String(site.onboarding_client_id)
    : "";

  let contactEmail = "";

  if (onboardingClientId) {
    const { data: clientRow } = await (admin as unknown as SupabaseUntypedClient)
      .from("onboarding_clients")
      .select("contact_email")
      .eq("id", onboardingClientId)
      .maybeSingle();

    const onboardingClient = clientRow as OnboardingClientContactRow | null;

    contactEmail = String(onboardingClient?.contact_email || "")
      .trim()
      .toLowerCase();
  }

  let subscriptionStatus: string | null = null;

  if (contactEmail) {
    const { data: subscriptionRow } = await (admin as unknown as SupabaseUntypedClient)
      .from("subscriptions")
      .select("status")
      .eq("email", contactEmail)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subscription = subscriptionRow as SubscriptionStatusRow | null;

    subscriptionStatus = subscription?.status || null;
  }

  const demoToken = process.env.NEXT_PUBLIC_DEMO_WIDGET_TOKEN?.trim() || "";
  const isDemoMode = Boolean(demoToken && token === demoToken);
  const allowed = isDemoMode || canUseLeadClawProduct(subscriptionStatus);

  if (!allowed) {
    return javascriptResponse(
      `console.warn("[LeadClaw widget] Subscription inactive. Widget blocked.");`,
    );
  }

  const safeAppUrl = escapeForScript(appUrl);
  const safeToken = escapeForScript(token);
  const safeClinicId = escapeForScript(clinicId);
  const safeSiteId = escapeForScript(siteId);
  const safeClinicDomain = escapeForScript(clinicDomain);
  const safeSiteStatus = escapeForScript(siteStatus);
  const safeConsentNotice = escapeForScript(WIDGET_CONSENT_NOTICE);

  const script = `
(() => {
  if (window.__leadclawWidgetLoaded) return;
  window.__leadclawWidgetLoaded = true;

  const APP_URL = \`${safeAppUrl}\`;
  const TOKEN = \`${safeToken}\`;
  const CLINIC_ID = \`${safeClinicId}\`;
  const SITE_ID = \`${safeSiteId}\`;
  const CLINIC_DOMAIN = \`${safeClinicDomain}\`;
  const SITE_STATUS = \`${safeSiteStatus}\`;
  const CONSENT_NOTICE = \`${safeConsentNotice}\`;
  const DEMO_MODE = ${isDemoMode ? "true" : "false"};

  // Best-effort installation ping so the portal can confirm the widget is
  // live. Fire-and-forget: never blocks rendering, only runs once per load,
  // sends no PII, and stays silent for normal visitors.
  if (!DEMO_MODE && !window.__leadclawPinged) {
    window.__leadclawPinged = true;
    try {
      const pingDomain =
        (window.location && window.location.hostname) || CLINIC_DOMAIN || "";
      if (pingDomain) {
        fetch(APP_URL + "/api/widget/ping", {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ token: TOKEN, domain: pingDomain }),
        }).catch(() => {});
      }
    } catch (_pingError) {
      /* ignore: ping is best-effort only */
    }
  }

  const state = {
    open: false,
    submitted: false,
    loading: false,
    selectedIntent: "",
    demoStep: 0,
  };

  const root = document.createElement("div");
  root.id = "leadclaw-widget-root";
  document.body.appendChild(root);

  const style = document.createElement("style");
  style.textContent = \`
    #leadclaw-widget-root { all: initial; }
    .lcw-shell, .lcw-shell * {
      box-sizing: border-box;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .lcw-shell {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483000;
      color: #0f172a;
    }
    .lcw-launcher {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #06b6d4, #0891b2);
      color: white;
      padding: 14px 18px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0;
      box-shadow: 0 18px 40px rgba(6, 182, 212, 0.28);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }
    .lcw-launcher:hover {
      transform: translateY(-1px);
      box-shadow: 0 24px 48px rgba(6, 182, 212, 0.34);
    }
    .lcw-launcher-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.92);
      box-shadow: 0 0 0 6px rgba(255,255,255,0.12);
      flex: 0 0 auto;
    }
    .lcw-panel {
      width: min(380px, calc(100vw - 24px));
      margin-top: 14px;
      overflow: hidden;
      border: 1px solid rgba(219, 231, 238, 0.95);
      border-radius: 26px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(14px);
      box-shadow:
        0 20px 60px rgba(15, 23, 42, 0.18),
        0 8px 24px rgba(15, 23, 42, 0.08);
    }
    .lcw-header {
      padding: 18px 18px 16px;
      background: linear-gradient(180deg, #f8fdff, #f4f8fc);
      border-bottom: 1px solid #e6edf5;
    }
    .lcw-header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .lcw-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .lcw-avatar {
      width: 42px;
      height: 42px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #cffafe, #e0f2fe);
      color: #0f172a;
      font-weight: 800;
      font-size: 14px;
      border: 1px solid rgba(6, 182, 212, 0.14);
      flex: 0 0 auto;
    }
    .lcw-brand-copy { min-width: 0; }
    .lcw-title {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .lcw-subtitle {
      margin: 3px 0 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }
    .lcw-close {
      appearance: none;
      border: 1px solid #dbe7ee;
      background: rgba(255,255,255,0.9);
      color: #334155;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      transition: background-color 0.2s ease, transform 0.2s ease;
      flex: 0 0 auto;
    }
    .lcw-close:hover {
      background: white;
      transform: translateY(-1px);
    }
    .lcw-message {
      border-radius: 20px;
      border-top-left-radius: 8px;
      background: #ffffff;
      border: 1px solid #e6edf5;
      padding: 14px;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
      font-size: 14px;
      line-height: 1.6;
      color: #0f172a;
    }
    .lcw-body {
      padding: 16px 18px 18px;
      background: linear-gradient(180deg, #fbfdff, #f8fbfe);
    }
    .lcw-intents {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 14px 0 16px;
    }
    .lcw-chip {
      appearance: none;
      border: 1px solid #dbe7ee;
      background: white;
      color: #334155;
      border-radius: 999px;
      padding: 9px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
    }
    .lcw-chip:hover {
      transform: translateY(-1px);
      border-color: #bcd8e6;
      background: #f8fcff;
    }
    .lcw-chip.is-active {
      background: #e6fbff;
      border-color: rgba(6, 182, 212, 0.22);
      color: #0b7ea4;
    }
    .lcw-form {
      display: grid;
      gap: 10px;
    }
    .lcw-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }
    .lcw-input, .lcw-textarea {
      width: 100%;
      border: 1px solid #dbe7ee;
      background: rgba(255,255,255,0.96);
      color: #0f172a;
      border-radius: 16px;
      padding: 12px 13px;
      outline: none;
      font-size: 14px;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
    }
    .lcw-input::placeholder, .lcw-textarea::placeholder { color: #94a3b8; }
    .lcw-input:focus, .lcw-textarea:focus {
      border-color: rgba(6, 182, 212, 0.5);
      box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.12);
      background: white;
    }
    .lcw-textarea {
      min-height: 92px;
      resize: vertical;
    }
    .lcw-help {
      font-size: 12px;
      line-height: 1.5;
      color: #64748b;
    }
    .lcw-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 4px;
    }
    .lcw-submit {
      appearance: none;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #06b6d4, #0891b2);
      color: white;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 14px 26px rgba(6, 182, 212, 0.22);
      text-decoration: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }
    .lcw-submit:hover {
      transform: translateY(-1px);
      box-shadow: 0 20px 34px rgba(6, 182, 212, 0.28);
    }
    .lcw-submit:disabled {
      opacity: 0.68;
      cursor: wait;
      transform: none;
      box-shadow: 0 10px 20px rgba(6, 182, 212, 0.15);
    }
    .lcw-mini {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .lcw-consent {
      margin: 8px 0 0;
      font-size: 11px;
      line-height: 1.5;
      color: #94a3b8;
      text-align: center;
    }
    .lcw-success {
      display: grid;
      gap: 12px;
      padding: 2px 0 4px;
    }
    .lcw-success-badge {
      width: 48px;
      height: 48px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ecfdf5;
      color: #15803d;
      font-size: 14px;
      font-weight: 800;
      border: 1px solid #bbf7d0;
    }
    .lcw-success-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .lcw-success-copy {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0;
    }
    .lcw-footer {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #e6edf5;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    @media (max-width: 640px) {
      .lcw-shell {
        left: 12px;
        right: 12px;
        bottom: 12px;
      }
      .lcw-launcher {
        width: 100%;
      }
      .lcw-panel {
        width: 100%;
      }
    }
  \`;
  document.head.appendChild(style);

  function renderHeader() {
    if (DEMO_MODE) {
      return [
        '<div class="lcw-header-top">',
        '  <div class="lcw-brand">',
        '    <div class="lcw-avatar">LC</div>',
        '    <div class="lcw-brand-copy">',
        '      <p class="lcw-title">LeadClaw Demo</p>',
        '      <p class="lcw-subtitle">See how your workspace captures requests</p>',
        '    </div>',
        '  </div>',
        '  <button class="lcw-close" type="button" aria-label="Close widget">x</button>',
        '</div>',
        '<div class="lcw-message">',
        "  Hi! I am LeadClaw's demo assistant. I will show you what a visitor sees when they send a website request, and what lands in your portal.",
        '</div>',
      ].join("");
    }

    return [
      '<div class="lcw-header-top">',
      '  <div class="lcw-brand">',
      '    <div class="lcw-avatar">LC</div>',
      '    <div class="lcw-brand-copy">',
      '      <p class="lcw-title">LeadClaw AI Receptionist</p>',
      '      <p class="lcw-subtitle">Friendly website intake assistant</p>',
      '    </div>',
      '  </div>',
      '  <button class="lcw-close" type="button" aria-label="Close widget">x</button>',
      '</div>',
      '<div class="lcw-message">',
      '  Hi! Welcome' + (CLINIC_DOMAIN ? ' to ' + CLINIC_DOMAIN : '') + '. I can help with requests, pricing, documents, or general questions. Leave your details and the team can follow up with the right information.',
      '</div>',
    ].join("");
  }

  function renderDemoBody() {
    if (state.demoStep === 0) {
      return [
        '<div style="display:grid;gap:12px;padding:2px 0">',
        '  <p style="font-size:13px;color:#475569;line-height:1.6;">Below is what a visitor types when they need help after hours. Click <strong>Send as request</strong> to see the full flow.</p>',
        '  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:14px;font-size:14px;color:#334155;line-height:1.6;"><em>"Hi, I need help with a customer request and a weekly report."</em></div>',
        '  <div style="display:grid;gap:8px;">',
        '    <input class="lcw-input" type="text" value="Sarah Jones" readonly style="background:#f8fafc;color:#64748b;" />',
        '    <input class="lcw-input" type="email" value="sarah@example.com" readonly style="background:#f8fafc;color:#64748b;" />',
        '    <input class="lcw-input" type="tel" value="07123 456789" readonly style="background:#f8fafc;color:#64748b;" />',
        '  </div>',
        '  <button class="lcw-submit" id="lcw-demo-send" type="button">Send as request</button>',
        '  <p class="lcw-mini">This simulates a real website request arriving on your site.</p>',
        '</div>',
        '<div class="lcw-footer">LeadClaw Demo Mode</div>',
      ].join("");
    }

    return [
      '<div style="display:grid;gap:12px;padding:2px 0">',
      '  <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:16px;padding:14px;">',
      '    <p style="font-size:13px;font-weight:700;color:#15803d;margin:0 0 6px;">Request captured instantly</p>',
      '    <p style="font-size:13px;color:#166534;margin:0;line-height:1.6;">Sarah Jones just asked for help. That request is now in your LeadClaw portal with name, email, phone, and request details ready for follow-up.</p>',
      '  </div>',
      '  <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:16px;padding:14px;">',
      '    <p style="font-size:13px;font-weight:700;color:#0369a1;margin:0 0 6px;">Auto follow-up scheduled</p>',
      '    <p style="font-size:13px;color:#075985;margin:0;line-height:1.6;">On Growth, LeadClaw can schedule a follow-up if your team has not responded, so no request sits unattended.</p>',
      '  </div>',
      '  <a href="/free-trial?plan=growth" class="lcw-submit" style="text-align:center;display:block;">Start free - see your portal</a>',
      '  <p class="lcw-mini" style="text-align:center;">No card required - 7-day free trial</p>',
      '</div>',
      '<div class="lcw-footer">LeadClaw Demo Mode</div>',
    ].join("");
  }

  function renderSuccessBody() {
    return [
      '<div class="lcw-success">',
      '  <div class="lcw-success-badge">OK</div>',
      '  <h3 class="lcw-success-title">Thanks - your request has been sent</h3>',
      '  <p class="lcw-success-copy">The team now has your details and can follow up with the right information.</p>',
      '  <p class="lcw-mini">You can close this window whenever you are ready.</p>',
      '</div>',
      '<div class="lcw-footer">Powered by LeadClaw</div>',
    ].join("");
  }

  function renderFormBody() {
    return [
      '<div class="lcw-intents">',
      '  <button type="button" class="lcw-chip" data-intent="New request">New request</button>',
      '  <button type="button" class="lcw-chip" data-intent="Pricing question">Pricing question</button>',
      '  <button type="button" class="lcw-chip" data-intent="Document help">Document help</button>',
      '  <button type="button" class="lcw-chip" data-intent="General question">General question</button>',
      '</div>',
      '<form class="lcw-form" novalidate>',
      '  <div>',
      '    <label class="lcw-label" for="lcw-name">Name</label>',
      '    <input id="lcw-name" name="name" class="lcw-input" type="text" placeholder="Your name" required />',
      '  </div>',
      '  <div>',
      '    <label class="lcw-label" for="lcw-email">Email</label>',
      '    <input id="lcw-email" name="email" class="lcw-input" type="email" placeholder="you@example.com" required />',
      '  </div>',
      '  <div>',
      '    <label class="lcw-label" for="lcw-phone">Phone</label>',
      '    <input id="lcw-phone" name="phone" class="lcw-input" type="tel" placeholder="Optional" />',
      '  </div>',
      '  <div>',
      '    <label class="lcw-label" for="lcw-message">How can the team help?</label>',
      '    <textarea id="lcw-message" name="message" class="lcw-textarea" placeholder="Tell us what request or question you have..." required></textarea>',
      '  </div>',
      '  <p class="lcw-help">Leave your details and the team can respond with the most relevant information.</p>',
      '  <div class="lcw-actions">',
      '    <button class="lcw-submit" type="submit">Send request</button>',
      '    <span class="lcw-mini">Usually takes less than a minute</span>',
      '  </div>',
      '  <p class="lcw-consent">' + CONSENT_NOTICE + '</p>',
      '</form>',
      '<div class="lcw-footer">Powered by LeadClaw</div>',
    ].join("");
  }

  function attachFormHandlers(body) {
    const chips = Array.from(body.querySelectorAll(".lcw-chip"));
    const form = body.querySelector(".lcw-form");
    const nameInput = body.querySelector("#lcw-name");
    const emailInput = body.querySelector("#lcw-email");
    const phoneInput = body.querySelector("#lcw-phone");
    const messageInput = body.querySelector("#lcw-message");
    const submitButton = body.querySelector(".lcw-submit");

    function syncChipState() {
      chips.forEach((chip) => {
        const intent = chip.getAttribute("data-intent") || "";
        chip.classList.toggle("is-active", intent === state.selectedIntent);
      });
    }

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        state.selectedIntent = chip.getAttribute("data-intent") || "";
        syncChipState();

        if (messageInput && !messageInput.value.trim()) {
          messageInput.value = state.selectedIntent
            ? "I am interested in: " + state.selectedIntent + ". "
            : "";
        }
      });
    });

    syncChipState();

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.loading) return;

      const name = nameInput?.value?.trim() || "";
      const email = emailInput?.value?.trim() || "";
      const phone = phoneInput?.value?.trim() || "";
      const message = messageInput?.value?.trim() || "";

      if (!name || !email || !message) {
        window.alert("Please complete name, email, and request details.");
        return;
      }

      state.loading = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      try {
        const response = await fetch(APP_URL + "/api/widget/submit", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            token: TOKEN,
            clinicId: CLINIC_ID,
            siteId: SITE_ID,
            intent: state.selectedIntent,
            name,
            email,
            phone,
            message,
            pageUrl: window.location.href,
            pageTitle: document.title || "",
            domain: window.location.hostname || CLINIC_DOMAIN || "",
            siteStatus: SITE_STATUS,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to submit request");
        }

        state.submitted = true;
        render();
      } catch (error) {
        console.error("[LeadClaw widget] submit failed", error);
        window.alert("Sorry, something went wrong while sending your request. Please try again.");
      } finally {
        state.loading = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Send request";
        }
      }
    });
  }

  function render() {
    root.innerHTML = "";

    const shell = document.createElement("div");
    shell.className = "lcw-shell";

    const launcher = document.createElement("button");
    launcher.className = "lcw-launcher";
    launcher.type = "button";
    launcher.innerHTML =
      '<span class="lcw-launcher-dot"></span><span>' +
      (DEMO_MODE ? "See LeadClaw in action" : "Send a request or question") +
      '</span>';
    launcher.addEventListener("click", () => {
      state.open = !state.open;
      render();
    });
    shell.appendChild(launcher);

    if (state.open) {
      const panel = document.createElement("div");
      panel.className = "lcw-panel";

      const header = document.createElement("div");
      header.className = "lcw-header";
      header.innerHTML = renderHeader();
      header.querySelector(".lcw-close")?.addEventListener("click", () => {
        state.open = false;
        render();
      });

      const body = document.createElement("div");
      body.className = "lcw-body";

      if (DEMO_MODE) {
        body.innerHTML = renderDemoBody();
        body.querySelector("#lcw-demo-send")?.addEventListener("click", () => {
          state.demoStep = 1;
          render();
        });
      } else if (state.submitted) {
        body.innerHTML = renderSuccessBody();
      } else {
        body.innerHTML = renderFormBody();
        attachFormHandlers(body);
      }

      panel.appendChild(header);
      panel.appendChild(body);
      shell.appendChild(panel);
    }

    root.appendChild(shell);
  }

  render();
})();
  `.trim();

  return javascriptResponse(script);
}
