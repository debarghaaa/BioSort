import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured } from '../../services/supabase/client';
import { GlobalFooter } from './GlobalFooter';
import { SidebarNavigation } from './SidebarNavigation';
import { TopNavigation } from './TopNavigation';

export function ApplicationLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { auth } = useAuth();

  const authLabel =
    auth.authMode === 'guest'
      ? 'Guest Mode (Full Access)'
      : isSupabaseConfigured
        ? 'Supabase Auth'
        : 'Foundation Mode (Local)';

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#171717] flex">
      <SidebarNavigation
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopNavigation onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <div className="px-4 sm:px-6 lg:px-8 pt-3 max-w-[1440px] w-full mx-auto">
          <div className="oi-inset-sm px-4 py-2 text-xs text-[#737373] flex flex-wrap items-center justify-between gap-2">
            <span>
              Assistive software classification only · No patient identifiers collected · Uncertain
              predictions route to manual review
            </span>
            <span className="font-mono text-[11px] text-[#171717] whitespace-nowrap">
              Session: {authLabel}
            </span>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>

        <GlobalFooter variant="workspace" />
      </div>
    </div>
  );
}
