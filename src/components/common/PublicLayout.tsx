import { Outlet } from 'react-router-dom';
import { GlobalFooter } from './GlobalFooter';
import { GlobalHeader } from './GlobalHeader';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#171717] flex flex-col">
      <GlobalHeader variant="public" />
      <main className="flex-1">
        <Outlet />
      </main>
      <GlobalFooter variant="public" />
    </div>
  );
}
