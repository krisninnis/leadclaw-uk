import LoginForm from "./login-form";
import { normalizeAuthRedirectPath } from "@/lib/auth-redirect";

function normalizeNext(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;
  return normalizeAuthRedirectPath(next, "/portal");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const next = normalizeNext(params.next);

  return <LoginForm next={next} />;
}
