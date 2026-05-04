import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import logo from '@/assets/logo.png';
import { List, Clock, BarChart3, LogOut, Menu, X } from 'lucide-react';

import LeadQueue from '@/components/rep/LeadQueue';
import CallHistory from '@/components/rep/CallHistory';
import RepStats from '@/components/rep/RepStats';
import ActiveCall from '@/components/rep/ActiveCall';
import SpeedToLeadFeed from '@/components/shared/SpeedToLeadFeed';

const navItems = [
  { id: 'queue', label: 'Foreclosure Queue', icon: List },
  { id: 'history', label: 'Call History', icon: Clock },
  { id: 'stats', label: 'My Stats', icon: BarChart3 },
];

export default function RepDashboard() {
  const { user, logout } = useAuth();
  const { activeCallLeadId } = useApp();
  const [activeTab, setActiveTab] = useState('queue');
  const [menuOpen, setMenuOpen] = useState(false);

  if (activeCallLeadId) {
    return <ActiveCall />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'queue': return <LeadQueue />;
      case 'history': return <CallHistory />;
      case 'stats': return <RepStats />;
      default: return <LeadQueue />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <img src={logo} alt="Mr. Short Sale" className="h-8 rounded bg-card p-0.5" />
            <span className="font-bold text-sm hidden sm:block">Mr. Short Sale</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: user?.avatarColor }}>
                {user?.name?.charAt(0)}
              </div>
              <span className="text-sm hidden sm:block">{user?.name}</span>
            </div>
            <button onClick={logout} className="p-1.5 rounded hover:bg-sidebar-accent/30"><LogOut size={16} /></button>
          </div>
        </div>
        
        {/* Tab navigation */}
        <div className={`flex border-t border-sidebar-border ${menuOpen ? '' : ''}`}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setMenuOpen(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/30'}`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 lg:p-6 space-y-4">
        {activeTab === 'queue' && <SpeedToLeadFeed compact />}
        {renderContent()}
      </main>
    </div>
  );
}
