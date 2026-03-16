type TestimonialCardProps = {
  quote: string;
  name: string;
  role?: string;
};

export default function TestimonialCard({
  quote,
  name,
  role,
}: TestimonialCardProps) {
  return (
    <div className="card-premium card-premium-hover p-6">
      <p className="text-base leading-8 text-foreground">“{quote}”</p>

      <div className="mt-5 border-t border-border pt-4">
        <p className="font-semibold text-foreground">{name}</p>
        {role ? <p className="text-sm text-muted">{role}</p> : null}
      </div>
    </div>
  );
}
