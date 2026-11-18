import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  ClipboardCheck,
  Database,
  History,
  LayoutDashboard,
  ScanLine,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/platform';
import { BioSortLogo } from './BioSortLogo';

interface NavEntry {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
}

const NAV_ENTRIES: NavEntry[] = [
  {
    to: '/',
    label: 'Overview',
    icon: LayoutDashboard,
    allowedRoles: [UserRole.OPERATOR, UserRole.REVIEWER, UserRole.ADMIN],
  },
  {
    to: '/classify',
    label: 'Classify Waste',
    icon: ScanLine,
    allowedRoles: [UserRole.OPERATOR, UserRole.REVIEWER, UserRole.ADMIN],
  },
  {
    to: '/history',
    label: 'Classification History',
    icon: History,
    allowedRoles: [UserRole.OPERATOR, UserRole.REVIEWER, UserRole.ADMIN],
  },
  {
    to: '/review',
    label: 'Manual Review',
    icon: ClipboardCheck,
    allowedRoles: [UserRole.REVIEWER, UserRole.ADMIN],
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    allowedRoles: [UserRole.OPERATOR, UserRole.REVIEWER, UserRole.ADMIN],
  },
  {
    to: '/models',
    label: 'Dataset & Model',
    icon: Database,
    allowedRoles: [UserRole.OPERATOR, UserRole.REVIEWER, UserRole.ADMIN],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: Settings,
    allowedRoles: [UserRole.OPERATOR, UserRole.REVIEWER, UserRole.ADMIN],
  },
];

export function SidebarNavigation({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { auth } = useAuth();
  const visibleItems = NAV_ENTRIES.filter((entry) => entry.allowedRoles.includes(auth.role));

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#171717]/25 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[264px] shrink-0 p-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full oi-card-elevated flex flex-col overflow-hidden">
          <div className="min-h-[68px] px-4 border-b border-[#E5E5E5] flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-[#4338CA]/10 border border-[#4338CA]/20 flex items-center justify-center shrink-0">
                <BioSortLogo className="h-5 w-5 text-[#4338CA]" />
              </div>
              <div className="min-w-0">
                <span className="font-display block text-[17px] font-semibold tracking-tight text-[#171717] truncate">
                  BioSort
                </span>
                <span className="block text-[11px] text-[#737373] truncate">
                  Biomedical Waste Segregation
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#737373] hover:text-[#171717] hover:bg-[#FCFBF9] lg:hidden focus-visible:outline-2 focus-visible:outline-[#6366F1]"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav
            className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
            aria-label="Primary Navigation"
          >
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-medium tracking-[-0.01em] rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366F1] ${
                      isActive
                        ? 'bg-[#4338CA] text-[#FFFFFF] shadow-[0_6px_16px_-6px_rgba(67,56,202,0.38)]'
                        : 'text-[#525252] hover:text-[#171717] hover:bg-[#FCFBF9]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#FFFFFF]' : 'text-[#737373]'}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-3.5 border-t border-[#E5E5E5] bg-[#FCFBF9]">
            <div className="rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] p-3 text-xs text-[#737373] space-y-1">
              <p className="font-semibold text-[#171717]">Assistive Scope</p>
              <p className="leading-relaxed text-[11px]">
                Verification and recordkeeping aid only. Never replaces physical handling protocols.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
