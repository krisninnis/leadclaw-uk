import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="card-premium max-w-md p-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft mx-auto">
          <span className="text-2xl font-bold text-brand-strong">404</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Page not found
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          The page you are looking for does not exist or may have moved.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="button-primary">
            Go home
          </Link>
          <Link href="/pricing" className="button-secondary">
            View pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
