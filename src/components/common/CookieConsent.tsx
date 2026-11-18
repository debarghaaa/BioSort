import { useEffect, useState } from 'react';
import { CheckCircle2, Info, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BROWSER_STORAGE_INVENTORY,
  LOCAL_STORAGE_NOTICE_ACK_KEY,
  SITE_CONFIG,
} from '../../config/siteConfig';

const WORKSPACE_DRAFT_CONFIG_KEY = 'medwaste_platform_config_v2';

export function readStorageNoticeAcknowledged(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return true;
  }
  try {
    return Boolean(window.localStorage.getItem(LOCAL_STORAGE_NOTICE_ACK_KEY));
  } catch {
    return false;
  }
}

export function writeStorageNoticeAcknowledged(acknowledged: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (acknowledged) {
      window.localStorage.setItem(
        LOCAL_STORAGE_NOTICE_ACK_KEY,
        JSON.stringify({ acknowledgedAt: new Date().toISOString() })
      );
    } else {
      window.localStorage.removeItem(LOCAL_STORAGE_NOTICE_ACK_KEY);
    }
  } catch {
    // Ignore storage write errors in restricted browsing contexts
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readStorageNoticeAcknowledged());
  }, []);

  if (!visible) {
    return null;
  }

  const handleAcknowledge = () => {
    writeStorageNoticeAcknowledged(true);
    setVisible(false);
  };

  return (
    <aside
      aria-label="Browser storage transparency notice"
      className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl shadow-[0_14px_36px_-14px_rgba(23,23,23,0.16)] p-4 sm:p-5 text-[#171717]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-[#4338CA]/10 border border-[#4338CA]/20 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
          </div>
          <div className="space-y-1 min-w-0">
            <p className="font-sans text-sm font-semibold text-[#171717]">
              Essential Browser Storage
            </p>
            <p className="text-xs leading-relaxed text-[#525252]">
              {SITE_CONFIG.platformName} uses only strictly necessary browser{' '}
              <code className="font-mono text-[11px] text-[#171717]">localStorage</code> for
              authentication and workspace settings. No analytics or advertising cookies are active.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAcknowledge}
          aria-label="Dismiss storage notice"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#737373] hover:text-[#171717] hover:bg-[#FCFBF9] shrink-0 focus-visible:outline-2 focus-visible:outline-[#6366F1]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#E5E5E5]">
        <Link
          to="/cookie-policy"
          className="text-xs font-medium text-[#4338CA] hover:text-[#3730A3] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[#6366F1] rounded py-1"
        >
          Cookie &amp; Storage Policy
        </Link>
        <button
          type="button"
          onClick={handleAcknowledge}
          className="min-h-[38px] inline-flex items-center justify-center rounded-xl bg-[#4338CA] px-3.5 py-1.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#3730A3] transition-colors focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2"
        >
          Acknowledge
        </button>
      </div>
    </aside>
  );
}

export function StoragePreferencesPanel() {
  const [noticeAcknowledged, setNoticeAcknowledged] = useState<boolean>(true);
  const [draftCleared, setDraftCleared] = useState<string | null>(null);

  useEffect(() => {
    setNoticeAcknowledged(readStorageNoticeAcknowledged());
  }, []);

  const handleToggleNotice = () => {
    const next = !noticeAcknowledged;
    writeStorageNoticeAcknowledged(next);
    setNoticeAcknowledged(next);
  };

  const handleClearWorkspaceDrafts = () => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(WORKSPACE_DRAFT_CONFIG_KEY);
    setDraftCleared(
      'Local workspace draft configuration (medwaste_platform_config_v2) has been cleared from this browser. Active authentication sessions were preserved.'
    );
  };

  return (
    <div className="oi-panel space-y-5">
      <div className="oi-panel-header">
        <div>
          <h3 className="oi-card-title">Browser Storage &amp; Technology Controls</h3>
          <p className="oi-component-subtitle mt-0.5">
            Transparent summary matching actual client-side behavior—no non-essential trackers exist to toggle.
          </p>
        </div>
        <span className="oi-metadata uppercase tracking-wider text-[#4338CA]">
          Zero Tracking Cookies
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <div className="oi-tile h-full flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="oi-subpanel-title">Strictly Necessary Storage</span>
              <span className="oi-metadata text-[#238B68]">Always Active</span>
            </div>
            <p className="oi-component-subtitle">
              Authentication state, Foundation/Guest preview role, and workspace configuration drafts
              stored in browser <code className="font-mono text-[#171717]">localStorage</code>.
            </p>
          </div>
          <p className="oi-metadata">
            {BROWSER_STORAGE_INVENTORY.filter((item) => item.category === 'strictly_necessary').length}{' '}
            key scopes documented below
          </p>
        </div>

        <div className="oi-tile h-full flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="oi-subpanel-title">Analytics &amp; Marketing Cookies</span>
              <span className="oi-metadata text-[#525252]">None Implemented</span>
            </div>
            <p className="oi-component-subtitle">
              BioSort does not load Google Analytics, Mixpanel, PostHog, advertising pixels, or
              behavioral profiling scripts.
            </p>
          </div>
          <p className="oi-metadata">0 optional scripts loaded</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E5E5]">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleToggleNotice}
            className="oi-btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-[#4338CA]" aria-hidden="true" />
            <span>
              {noticeAcknowledged
                ? 'Show Informational Notice Again'
                : 'Mark Informational Notice Acknowledged'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleClearWorkspaceDrafts}
            className="oi-btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold"
          >
            <Trash2 className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
            <span>Clear Local Config Drafts</span>
          </button>
        </div>

        <span className="oi-metadata">
          Notice state: {noticeAcknowledged ? 'Acknowledged' : 'Visible'}
        </span>
      </div>

      {draftCleared && (
        <div
          role="status"
          className="rounded-xl border border-[#238B68]/35 bg-[#F2FAF7] px-4 py-3 text-xs text-[#17644A]"
        >
          {draftCleared}
        </div>
      )}
    </div>
  );
}
