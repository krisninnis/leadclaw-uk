import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const forwardUrl = new URL("/api/auth/callback", origin);

  requestUrl.searchParams.forEach((value, key) => {
    forwardUrl.searchParams.set(key, value);
  });

  return NextResponse.redirect(forwardUrl);
}
