import React from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="oi-inset p-8 sm:p-10 text-center space-y-3">
      <p className="oi-card-title">{title}</p>
      <p className="oi-body-sm max-w-[52ch] mx-auto">{description}</p>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
