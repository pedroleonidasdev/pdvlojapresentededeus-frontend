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
    <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6 border-b border-border bg-surface overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-secondary" />
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
