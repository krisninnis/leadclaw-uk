"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function UnsubscribedContent() {
  const searchParams = useSearchParams();
  const email = searchParams?.get("email");
  const error = searchParams?.get("error");

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-semibold text-red-600 mb-3">
            Something went wrong
          </h1>
          <p className="text-gray-600">
            We couldn't process your request. Please email{" "}
            <a
              href="mailto:privacy@leadclaw.uk"
              className="text-blue-600 underline"
            >
              privacy@leadclaw.uk
            </a>{" "}
            and we'll remove you manually.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          You've been unsubscribed
        </h1>
        {email && (
          <p className="text-gray-600 mb-2">
            <span className="font-medium">{decodeURIComponent(email)}</span> has
            been removed from our mailing list.
          </p>
        )}
        <p className="text-gray-500 text-sm">
          Questions? Contact us at{" "}
          <a
            href="mailto:privacy@leadclaw.uk"
            className="text-blue-600 underline"
          >
            privacy@leadclaw.uk
          </a>
        </p>
      </div>
    </main>
  );
}

export default function UnsubscribedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <UnsubscribedContent />
    </Suspense>
  );
}
