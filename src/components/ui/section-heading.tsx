type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  maxWidth?: "md" | "lg" | "xl";
};

const widthMap = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
};

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  maxWidth = "lg",
}: SectionHeadingProps) {
  const alignClass = align === "center" ? "text-center mx-auto" : "";
  const widthClass = widthMap[maxWidth];

  return (
    <div className={`${widthClass} ${alignClass}`}>
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>

      {description ? (
        <p className="mt-4 text-lg leading-8 text-muted">{description}</p>
      ) : null}
    </div>
  );
}
