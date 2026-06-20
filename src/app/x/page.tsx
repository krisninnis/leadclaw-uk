import { redirect } from "next/navigation";

// Short campaign alias: /x -> /social. Forwards any UTM query params.
export default async function XAliasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      qs.set(key, value);
    } else if (Array.isArray(value) && value.length > 0) {
      qs.set(key, value[value.length - 1]);
    }
  }

  const query = qs.toString();
  redirect(query ? `/social?${query}` : "/social");
}
