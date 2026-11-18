import React from 'react';
import { cn } from '../../lib/utils';

export function PanelHeader({
  title,
  subtitle,
  icon,
  meta,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('oi-panel-header', className)}>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="shrink-0 flex items-center text-[#4338CA]">{icon}</span>}
          <h3 className="oi-card-title truncate">{title}</h3>
        </div>
        {subtitle && <p className="oi-component-subtitle">{subtitle}</p>}
      </div>
      {meta && <div className="shrink-0 flex items-center gap-2">{meta}</div>}
    </div>
  );
}
