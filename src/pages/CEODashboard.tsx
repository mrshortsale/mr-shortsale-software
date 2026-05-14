import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';
import { Home, Kanban, BarChart3, Phone, Database, Map, Settings, LogOut, Menu, X, Sparkles, Bot, Zap, PhoneCall, FileText, ExternalLink, Building2, Users, MessageSquare, TrendingUp, List } from 'lucide-react';

// CEO Screens
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

const navItems = [
  { id: 'briefing', label: 'Morning Briefing', icon: Home },
  { id: 'divider-leads', label: 'Leads', divider: true as const },
  { id: 'inventory', label: 'Lead Inventory', icon: List },
  { id: 'realtor-queue', label: 'Realtor Lead Queue', icon: Users },
  { id: 'realtor-pipeline', label: 'Realtor Pipeline', icon: Building2 },
  { id: 'realtor-scripts', label: 'Realtor Scripts', icon: MessageSquare },
  { id: 'realtor-reports', label: 'Realtor Reports', icon: TrendingUp },
  { id: 'divider-ops', label: 'Operations', divider: true as const },
  { id: 'pipeline', label: 'Active Pipeline', icon: Kanban },
  { id: 'speed', label: 'Speed-to-Lead', icon: Zap },
  { id: 'dialer', label: 'Mojo Dialer', icon: PhoneCall },
  { id: 'team', label: 'Team Performance', icon: BarChart3 },
  { id: 'divider-other', label: 'Other', divider: true as const },
  { id: 'roadmap', label: 'Roadmap & Previews', icon: Map },
  { id: 'presentation', label: 'Presentation', icon: Sparkles },
  { id: 'proposal', label: 'View Proposal', icon: FileText, external: '/proposal' as const },
  { id: 'costs', label: 'Cost Transparency', icon: FileText, external: '/costs' as const },
  { id: 'divider-admin', label: 'Admin', divider: true as const },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'data', label: 'Data Sources', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Phase 2 preview screens — accessible only via Roadmap
const previewLabels: Record<string, string> = {
  'ai-calls': 'AI Inbound Calls (Preview)',
  'ai-agents': 'AI Agents (Preview)',
};

export default function CEODashboard() {
  const { user, logout } = useAuth();
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
      case 'settings': return <div className="p-8"><h2 className="text-2xl font-bold text-foreground">Settings</h2><p className="text-muted-foreground mt-2">Account and platform settings coming soon.</p></div>;
      default: return <MorningBriefing />;
    }
  };

  const headerLabel = navItems.find(n => n.id === activeTab)?.label ?? previewLabels[activeTab] ?? '';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-primary flex flex-col transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border">
          <img src={logo} alt="Mr. Short Sale" className="h-10 rounded-md bg-card p-1" />
          <div>
            <h2 className="text-sm font-bold text-primary-foreground">Mr. Short Sale</h2>
            <p className="text-xs text-sidebar-foreground opacity-70">AI Operations</p>
          </div>
          <button className="ml-auto lg:hidden text-primary-foreground" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          {navItems.map(item => {
            if ('divider' in item && item.divider) {
              return (
                <div key={item.id} className="pt-3 pb-1 px-3 text-[10px] uppercase tracking-wider text-sidebar-foreground opacity-50 font-bold">
                  {item.label}
                </div>
              );
            }
            if ('external' in item && item.external) {
              return (
                <a
                  key={item.id}
                  href={item.external}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                >
                  <item.icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  <ExternalLink size={12} className="opacity-60" />
                </a>
              );
            }
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'}`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground" style={{ backgroundColor: user?.avatarColor }}>
              {user?.name?.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-primary-foreground">{user?.name}</p>
              <p className="text-xs text-sidebar-foreground opacity-70">CEO</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 bg-card border-b px-4 lg:px-6 py-3 flex items-center gap-3">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={24} /></button>
          <h1 className="text-lg font-bold text-foreground">{headerLabel}</h1>
          <span className="ml-auto text-xs text-muted-foreground">April 9, 2026 · 8:15 AM</span>
        </header>
        <div className="p-4 lg:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
