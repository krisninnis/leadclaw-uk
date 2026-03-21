"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="card-premium max-w-md p-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mx-auto">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          We hit an unexpected error. Our team has been notified and will look
          into it.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={reset} className="button-primary">
            Try again
          </button>
          <Link href="/" className="button-secondary">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
