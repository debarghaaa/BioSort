export function MetricCard({
  label,
  value,
  sublabel,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: 'neutral' | 'emerald' | 'amber' | 'red' | 'sky';
}) {
  const valueToneClass: Record<typeof tone, string> = {
    neutral: 'text-[#171717]',
    emerald: 'text-[#238B68]',
    amber: 'text-[#B45309]',
    red: 'text-[#D9534F]',
    sky: 'text-[#4338CA]',
  };

  return (
    <div className="oi-card oi-card-interactive p-5 h-full flex flex-col justify-between gap-2 min-w-0">
      <p className="oi-component-subtitle font-medium text-[#525252] truncate" title={label}>
        {label}
      </p>
      <p
        className={`oi-numerical truncate ${valueToneClass[tone]}`}
        title={String(value)}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="oi-metadata truncate" title={sublabel}>
          {sublabel}
        </p>
      ) : (
        <span aria-hidden="true" className="h-[18px]" />
      )}
    </div>
  );
}
