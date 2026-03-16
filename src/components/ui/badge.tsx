import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  tone?: "brand" | "amber" | "violet" | "cyan" | "neutral";
};

const toneMap = {
  brand: "border-brand/20 bg-brand-soft text-brand-strong",
  amber: "border-amber-200 bg-amber-100 text-amber-800",
  violet: "border-violet-200 bg-violet-100 text-violet-800",
  cyan: "border-cyan-200 bg-cyan-100 text-cyan-800",
  neutral: "border-border bg-white text-foreground",
};

export default function Badge({ children, tone = "brand" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        toneMap[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
