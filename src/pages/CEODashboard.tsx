import { useState } from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  Database,
  FileText,
  Home,
  Kanban,
  List,
  Map,
  MessageSquare,
  PhoneCall,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import AppSidebar, { type SidebarNavItem } from '@/components/AppSidebar';
import TopNav from '@/components/TopNav';

import MorningBriefing from '@/components/ceo/MorningBriefing';
import PipelineBoard from '@/components/ceo/PipelineBoard';
import TeamPerformance from '@/components/ceo/TeamPerformance';
import AIInboundCalls from '@/components/ceo/AIInboundCalls';
import AIAgentsRoster from '@/components/ceo/AIAgentsRoster';
import DataSources from '@/components/ceo/DataSources';
import SpeedToLeadScreen from '@/components/ceo/SpeedToLeadScreen';
import MojoDialerScreen from '@/components/ceo/MojoDialerScreen';
import RoadmapView from '@/components/ceo/RoadmapView';
import Presentation from '@/components/ceo/Presentation';
import RealtorPipeline from '@/components/ceo/RealtorPipeline';
import RealtorLeadQueue from '@/components/ceo/RealtorLeadQueue';
import RealtorScripts from '@/components/ceo/RealtorScripts';
import RealtorReports from '@/components/ceo/RealtorReports';
import LeadInventory from '@/components/ceo/LeadInventory';
import UserManagement from '@/components/ceo/UserManagement';

const navItems: SidebarNavItem[] = [
  { kind: 'item', id: 'briefing', label: 'Morning Briefing', icon: Home },

  {
    kind: 'section',
    id: 'sec-sales',
    label: 'Sales Hub',
    icon: Briefcase,
    defaultOpen: true,
    children: [
      { kind: 'item', id: 'inventory', label: 'Lead Inventory', icon: List },
      { kind: 'item', id: 'realtor-queue', label: 'Realtor Lead Queue', icon: Users },
      { kind: 'item', id: 'realtor-pipeline', label: 'Realtor Pipeline', icon: Building2 },
      { kind: 'item', id: 'realtor-scripts', label: 'Realtor Scripts', icon: MessageSquare },
      { kind: 'item', id: 'realtor-reports', label: 'Realtor Reports', icon: TrendingUp },
    ],
  },

  {
    kind: 'section',
    id: 'sec-ops',
    label: 'Operations',
    icon: Activity,
    children: [
      { kind: 'item', id: 'pipeline', label: 'Active Pipeline', icon: Kanban },
      { kind: 'item', id: 'speed', label: 'Speed-to-Lead', icon: Zap },
      { kind: 'item', id: 'dialer', label: 'Mojo Dialer', icon: PhoneCall },
      { kind: 'item', id: 'team', label: 'Team Performance', icon: BarChart3 },
    ],
  },

  {
    kind: 'section',
    id: 'sec-strategy',
    label: 'Strategy',
    icon: Sparkles,
    children: [
      { kind: 'item', id: 'roadmap', label: 'Roadmap & Previews', icon: Map },
      { kind: 'item', id: 'presentation', label: 'Presentation', icon: Sparkles },
      { kind: 'external', id: 'proposal', label: 'View Proposal', icon: FileText, href: '/proposal' },
      { kind: 'external', id: 'costs', label: 'Cost Transparency', icon: FileText, href: '/costs' },
    ],
  },

  {
    kind: 'section',
    id: 'sec-admin',
    label: 'Admin',
    icon: Settings,
    children: [
      { kind: 'item', id: 'users', label: 'User Management', icon: Users },
      { kind: 'item', id: 'data', label: 'Data Sources', icon: Database },
      { kind: 'item', id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

const previewLabels: Record<string, string> = {
  'ai-calls': 'AI Inbound Calls (Preview)',
  'ai-agents': 'AI Agents (Preview)',
};

function findItemLabel(items: SidebarNavItem[], id: string): string | null {
  for (const item of items) {
    if (item.kind === 'item' && item.id === id) return item.label;
    if (item.kind === 'section') {
      const nested = findItemLabel(item.children, id);
      if (nested) return nested;
    }
    if (item.kind === 'item' && item.children?.length) {
      const nested = findItemLabel(item.children, id);
      if (nested) return nested;
    }
  }
  return null;
}

function getLabel(id: string): string {
  return findItemLabel(navItems, id) ?? previewLabels[id] ?? '';
}

export default function CEODashboard() {
  const [activeTab, setActiveTab] = useState('briefing');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'briefing': return <MorningBriefing />;
      case 'inventory': return <LeadInventory />;
      case 'pipeline': return <PipelineBoard />;
      case 'team': return <TeamPerformance />;
      case 'ai-calls': return <AIInboundCalls />;
      case 'ai-agents': return <AIAgentsRoster />;
      case 'data': return <DataSources />;
      case 'speed': return <SpeedToLeadScreen />;
      case 'dialer': return <MojoDialerScreen />;
      case 'roadmap': return <RoadmapView onOpenPreview={(id) => setActiveTab(id)} />;
      case 'presentation': return <Presentation />;
      case 'realtor-pipeline': return <RealtorPipeline />;
      case 'realtor-queue': return <RealtorLeadQueue />;
      case 'realtor-scripts': return <RealtorScripts />;
      case 'realtor-reports': return <RealtorReports />;
      case 'users': return <UserManagement />;
      case 'settings':
        return (
          <div className="rounded-xl border bg-card p-8 shadow-soft">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Account and platform settings coming soon.
            </p>
          </div>
        );
      default:
        return <MorningBriefing />;
    }
  };

  const pageTitle = getLabel(activeTab) || 'Dashboard';

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        navItems={navItems}
        activeId={activeTab}
        onSelect={setActiveTab}
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
        {renderContent()}
      </main>
    </div>
  );
}
