import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { cn } from '../../lib/utils';

export function AlertBanner({
  tone = 'info',
  title,
  message,
  action,
  className,
}: {
  tone?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  message: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const styles: Record<typeof tone, string> = {
    info: 'border-[#E5E5E5] bg-[#FFFFFF] text-[#171717]',
    warning: 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]',
    error: 'border-[#D9534F]/40 bg-[#FDF3F2] text-[#9F2D2A]',
    success: 'border-[#238B68]/35 bg-[#F2FAF7] text-[#17644A]',
  };

  const Icon =
    tone === 'error' ? FiAlertCircle : tone === 'success' ? FiCheckCircle : FiInfo;

  const iconColor: Record<typeof tone, string> = {
    info: 'text-[#4338CA]',
    warning: 'text-[#B45309]',
    error: 'text-[#D9534F]',
    success: 'text-[#238B68]',
  };

  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border px-4 py-3 text-[13px] flex flex-wrap items-start justify-between gap-3',
        styles[tone],
        className
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', iconColor[tone])} aria-hidden="true" />
        <div className="space-y-0.5 min-w-0">
          {title && <p className="font-semibold leading-snug">{title}</p>}
          <div className="leading-relaxed">{message}</div>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
