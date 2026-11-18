import type { SVGProps } from 'react';

export function BioSortLogo({ className = 'h-5 w-5', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Clinical bio-chamber frame */}
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Precision medical cross */}
      <path
        d="M9 6.25V10.75M6.75 8.5H11.25"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* Dual segregation sorting streams */}
      <path
        d="M14.5 7.5H17.75M17.75 7.5L16.25 6M17.75 7.5L16.25 9"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.75 15.75H17.25M17.25 15.75L15.25 13.75M17.25 15.75L15.25 17.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
