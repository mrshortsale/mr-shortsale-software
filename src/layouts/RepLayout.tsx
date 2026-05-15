import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import TopNav from '@/components/TopNav';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import ActiveCall from '@/components/rep/ActiveCall';
import { repNavItems, getRepPageTitle } from '@/config/repNav';

export default function RepLayout() {
  const { user, loading } = useAuth();
  const { activeCallLeadId } = useApp();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={36} className="animate-spin text-primary/40" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== 'rep') {
    return <Navigate to="/ceo/briefing" replace />;
  }

  if (activeCallLeadId) {
    return <ActiveCall />;
  }

  const pageTitle = getRepPageTitle(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        navItems={repNavItems}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        appName="Mr. Short Sale"
        appSubLabel="Sales Workspace"
        versionLabel="Workspace"
        versionSubLabel="v1.0.0 · Sales Rep"
      />

      <TopNav
        onOpenSidebar={() => setSidebarOpen(true)}
        pageTitle={pageTitle}
        pageMeta="Rep Console"
      />

      <main className="mt-16 min-h-[calc(100vh-4rem)] p-4 lg:ml-64 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
