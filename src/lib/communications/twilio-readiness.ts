export type TwilioReadinessKey =
  | "COMMUNICATIONS_SMS_PROVIDER"
  | "TWILIO_ACCOUNT_SID"
  | "TWILIO_AUTH_TOKEN"
  | "TWILIO_FROM_NUMBER"
  | "TWILIO_MESSAGING_SERVICE_SID"
  | "COMMUNICATIONS_DEFAULT_FROM_SMS";

export type TwilioReadinessCheck = {
  key: TwilioReadinessKey;
  required: boolean;
  present: boolean;
  valid: boolean;
  message: string;
};

export type TwilioSenderMode =
  | "messaging_service"
  | "from_number"
  | "missing";

export type TwilioSmsReadiness = {
  ready: boolean;
  senderMode: TwilioSenderMode;
  checks: TwilioReadinessCheck[];
  missing: TwilioReadinessKey[];
  warnings: string[];
};

type Env = Record<string, string | undefined>;

const E164_RE = /^\+[1-9]\d{7,14}$/;
const TWILIO_ACCOUNT_SID_RE = /^AC[0-9a-fA-F]{32}$/;
const TWILIO_MESSAGING_SERVICE_SID_RE = /^MG[0-9a-fA-F]{32}$/;

function value(env: Env, key: TwilioReadinessKey): string {
  return env[key]?.trim() ?? "";
}

function present(env: Env, key: TwilioReadinessKey): boolean {
  return value(env, key).length > 0;
}

function providerIsTwilio(env: Env): boolean {
  return value(env, "COMMUNICATIONS_SMS_PROVIDER").toLowerCase() === "twilio";
}

function check(
  key: TwilioReadinessKey,
  required: boolean,
  isValid: boolean,
  message: string,
  env: Env,
): TwilioReadinessCheck {
  return {
    key,
    required,
    present: present(env, key),
    valid: isValid,
    message,
  };
}

export function getTwilioSmsReadiness(
  env: Env = process.env,
): TwilioSmsReadiness {
  const providerReady = providerIsTwilio(env);
  const accountSid = value(env, "TWILIO_ACCOUNT_SID");
  const authToken = value(env, "TWILIO_AUTH_TOKEN");
  const fromNumber = value(env, "TWILIO_FROM_NUMBER");
  const messagingServiceSid = value(env, "TWILIO_MESSAGING_SERVICE_SID");
  const defaultFromSms = value(env, "COMMUNICATIONS_DEFAULT_FROM_SMS");

  const hasFromNumber = fromNumber.length > 0;
  const hasMessagingService = messagingServiceSid.length > 0;
  const hasSender = hasFromNumber || hasMessagingService;
  const senderMode: TwilioSenderMode = hasMessagingService
    ? "messaging_service"
    : hasFromNumber
      ? "from_number"
      : "missing";

  const warnings: string[] = [];

  if (accountSid && !TWILIO_ACCOUNT_SID_RE.test(accountSid)) {
    warnings.push("TWILIO_ACCOUNT_SID is present but does not look like an AC... SID.");
  }

  if (messagingServiceSid && !TWILIO_MESSAGING_SERVICE_SID_RE.test(messagingServiceSid)) {
    warnings.push(
      "TWILIO_MESSAGING_SERVICE_SID is present but does not look like an MG... SID.",
    );
  }

  if (fromNumber && !E164_RE.test(fromNumber)) {
    warnings.push("TWILIO_FROM_NUMBER is present but is not in E.164 format.");
  }

  if (hasMessagingService && hasFromNumber) {
    warnings.push(
      "Both TWILIO_MESSAGING_SERVICE_SID and TWILIO_FROM_NUMBER are set; the Twilio provider will use the Messaging Service SID.",
    );
  }

  if (defaultFromSms) {
    warnings.push(
      "COMMUNICATIONS_DEFAULT_FROM_SMS is set and will be passed to sendSms(); leave it unset unless you intentionally want to override the sender.",
    );
  }

  const checks: TwilioReadinessCheck[] = [
    check(
      "COMMUNICATIONS_SMS_PROVIDER",
      true,
      providerReady,
      providerReady
        ? "SMS provider is set to twilio."
        : "Set COMMUNICATIONS_SMS_PROVIDER=twilio.",
      env,
    ),
    check(
      "TWILIO_ACCOUNT_SID",
      true,
      accountSid.length > 0,
      accountSid ? "Account SID is present." : "Set TWILIO_ACCOUNT_SID.",
      env,
    ),
    check(
      "TWILIO_AUTH_TOKEN",
      true,
      authToken.length > 0,
      authToken ? "Auth token is present." : "Set TWILIO_AUTH_TOKEN.",
      env,
    ),
    check(
      "TWILIO_FROM_NUMBER",
      false,
      hasSender,
      hasFromNumber
        ? "From number is present."
        : "Set TWILIO_FROM_NUMBER unless using TWILIO_MESSAGING_SERVICE_SID.",
      env,
    ),
    check(
      "TWILIO_MESSAGING_SERVICE_SID",
      false,
      hasSender,
      hasMessagingService
        ? "Messaging Service SID is present."
        : "Set TWILIO_MESSAGING_SERVICE_SID unless using TWILIO_FROM_NUMBER.",
      env,
    ),
    check(
      "COMMUNICATIONS_DEFAULT_FROM_SMS",
      false,
      true,
      defaultFromSms
        ? "Optional sender override is present."
        : "Optional sender override is not set.",
      env,
    ),
  ];

  const missing: TwilioReadinessKey[] = [];
  if (!providerReady) missing.push("COMMUNICATIONS_SMS_PROVIDER");
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!hasSender) {
    missing.push("TWILIO_FROM_NUMBER", "TWILIO_MESSAGING_SERVICE_SID");
  }

  return {
    ready: missing.length === 0,
    senderMode,
    checks,
    missing,
    warnings,
  };
}
