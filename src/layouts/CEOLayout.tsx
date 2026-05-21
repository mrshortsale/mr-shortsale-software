import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppSidebar from '@/components/AppSidebar';
import TopNav from '@/components/TopNav';
import { useAuth } from '@/contexts/AuthContext';
import { ceoNavItems, getCeoNavItemId } from '@/config/ceoNav';

export default function CEOLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation();

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

  const navItemId = getCeoNavItemId(location.pathname);
  const pageTitle = t(`nav.${navItemId}`);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        navItems={ceoNavItems}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        appName={t('app.name')}
        appSubLabel={t('app.ceoSubLabel')}
        versionLabel={t('app.versionLabel')}
        versionSubLabel={t('app.ceoVersionSub')}
      />

      <TopNav
        onOpenSidebar={() => setSidebarOpen(true)}
        pageTitle={pageTitle}
        pageMeta={t('app.ceoPlatform')}
      />

      <main className="mt-16 min-h-[calc(100vh-4rem)] p-4 lg:ml-64 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
