import type { ReactNode } from "react";

type FeatureCardProps = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export default function FeatureCard({
  title,
  description,
  icon,
}: FeatureCardProps) {
  return (
    <div className="card-premium card-premium-hover p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-lg font-bold text-brand-strong">
        {icon ?? "+"}
      </div>

      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
    </div>
  );
}
