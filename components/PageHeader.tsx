export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-8 py-6 border-b border-border bg-surface">
      <div>
        <h1 className="font-serif text-[1.6rem] leading-none font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted mt-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
