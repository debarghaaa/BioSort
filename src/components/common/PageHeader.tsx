import React from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E5E5] pb-6">
      <div className="space-y-2 max-w-[65ch]">
        <h1 className="oi-page-title">{title}</h1>
        <p className="oi-body-sm">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
