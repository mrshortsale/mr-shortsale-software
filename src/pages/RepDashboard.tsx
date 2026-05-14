import { useState } from 'react';
import { Activity, BarChart3, Briefcase, Building2, Clock, List } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import AppSidebar, { type SidebarNavItem } from '@/components/AppSidebar';
import TopNav from '@/components/TopNav';

import LeadQueue from '@/components/rep/LeadQueue';
import CallHistory from '@/components/rep/CallHistory';
import RepStats from '@/components/rep/RepStats';
import ActiveCall from '@/components/rep/ActiveCall';
import SpeedToLeadFeed from '@/components/shared/SpeedToLeadFeed';
import RealtorQueue from '@/components/rep/RealtorQueue';

const navItems: SidebarNavItem[] = [
  {
    kind: 'section',
    id: 'sec-my-day',
    label: 'My Day',
    icon: Briefcase,
    defaultOpen: true,
    children: [
      { kind: 'item', id: 'queue', label: 'Foreclosure Queue', icon: List },
      { kind: 'item', id: 'realtor', label: 'Realtor Queue', icon: Building2 },
    ],
  },
  {
    kind: 'section',
    id: 'sec-activity',
    label: 'Activity',
    icon: Activity,
    defaultOpen: true,
    children: [
      { kind: 'item', id: 'history', label: 'Call History', icon: Clock },
      { kind: 'item', id: 'stats', label: 'My Stats', icon: BarChart3 },
    ],
  },
];

function findItemLabel(items: SidebarNavItem[], id: string): string | null {
  for (const item of items) {
    if (item.kind === 'item' && item.id === id) return item.label;
    if (item.kind === 'section') {
      const nested = findItemLabel(item.children, id);
      if (nested) return nested;
    }
  }
  return null;
}

function getLabel(id: string): string {
  return findItemLabel(navItems, id) ?? 'Dashboard';
}

export default function RepDashboard() {
  const { activeCallLeadId } = useApp();
  const [activeTab, setActiveTab] = useState('queue');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (activeCallLeadId) {
    return <ActiveCall />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'queue':
        return (
          <div className="space-y-4">
            <SpeedToLeadFeed compact />
            <LeadQueue />
          </div>
        );
      case 'realtor': return <RealtorQueue />;
      case 'history': return <CallHistory />;
      case 'stats': return <RepStats />;
      default: return <LeadQueue />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        navItems={navItems}
        activeId={activeTab}
        onSelect={setActiveTab}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        appName="Mr. Short Sale"
        appSubLabel="Sales Workspace"
        versionLabel="Workspace"
        versionSubLabel="v1.0.0 · Sales Rep"
      />

      <TopNav
        onOpenSidebar={() => setSidebarOpen(true)}
        pageTitle={getLabel(activeTab)}
        pageMeta="Rep Console"
      />

      <main className="mt-16 min-h-[calc(100vh-4rem)] p-4 lg:ml-64 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
}
