import { LogOut, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformConfig } from '../../hooks/usePlatformConfig';
import { isSupabaseConfigured } from '../../services/supabase/client';
import { UserRole } from '../../types/platform';
import { StatusBadge } from './StatusBadge';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/classify': 'Classify Waste',
  '/history': 'Classification History',
  '/review': 'Manual Review',
  '/analytics': 'Analytics',
  '/models': 'Dataset & Model',
  '/settings': 'Settings',
};

export function TopNavigation({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { auth, enterFoundationSession, logout } = useAuth();
  const { readiness } = usePlatformConfig();
  const location = useLocation();
  const navigate = useNavigate();

  const currentTitle = ROUTE_TITLES[location.pathname] || 'Workspace';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="px-4 sm:px-6 lg:px-8 pt-3.5 shrink-0 max-w-[1440px] w-full mx-auto">
      <div className="bg-[#FFFFFF]/95 backdrop-blur-[6px] border border-[#E5E5E5] rounded-2xl shadow-[0_6px_20px_-10px_rgba(23,23,23,0.06)] min-h-[64px] px-4 sm:px-5 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="oi-btn-secondary min-h-[44px] min-w-[44px] flex items-center justify-center lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5 text-[#171717]" />
          </button>

          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-[#737373] whitespace-nowrap hidden sm:inline">Workspace</span>
            <span className="text-[#D4D4D4] hidden sm:inline" aria-hidden="true">
              /
            </span>
            <span className="font-sans font-medium text-sm text-[#171717] truncate">
              {currentTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!isSupabaseConfigured && auth.authMode === 'foundation' && (
            <select
              aria-label="Switch Foundation Role"
              value={auth.role}
              onChange={(e) => enterFoundationSession(e.target.value as UserRole)}
              className="oi-input px-3 py-1.5 text-xs font-medium text-[#171717]"
            >
              <option value={UserRole.OPERATOR}>Operator</option>
              <option value={UserRole.REVIEWER}>Reviewer</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          )}

          <span className="hidden md:inline text-xs text-[#737373] font-mono whitespace-nowrap">
            {auth.authMode === 'guest' ? 'Guest (Full Access)' : `${auth.email} (${auth.role})`}
          </span>

          <div className="hidden xl:flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-[#737373]">API:</span>
            <StatusBadge status={readiness.readiness} />
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="oi-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
            <span>{auth.authMode === 'guest' ? 'Exit Guest' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
