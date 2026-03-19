"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GoodbyePage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/login"); // or "/"
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">
          We're sorry to see you go 👋
        </h1>
        <p className="text-gray-600">
          Your account has been deleted successfully.
          <br />
          Redirecting you shortly...
        </p>
      </div>
    </div>
  );
}
