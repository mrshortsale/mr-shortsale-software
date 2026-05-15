import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import TopNav from '@/components/TopNav';
import { useAuth } from '@/contexts/AuthContext';
import { ceoNavItems, getCeoPageTitle } from '@/config/ceoNav';

export default function CEOLayout() {
  const { user, loading } = useAuth();
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

  if (user.role !== 'ceo') {
    return <Navigate to="/rep/queue" replace />;
  }

  const pageTitle = getCeoPageTitle(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        navItems={ceoNavItems}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        appName="Mr. Short Sale"
        appSubLabel="AI Operations"
        versionLabel="Platform"
        versionSubLabel="v1.0.0 · Production"
      />

      <TopNav
        onOpenSidebar={() => setSidebarOpen(true)}
        pageTitle={pageTitle}
        pageMeta="CEO Console"
      />

      <main className="mt-16 min-h-[calc(100vh-4rem)] p-4 lg:ml-64 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
