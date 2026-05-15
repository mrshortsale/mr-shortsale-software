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
  Plug,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { SidebarNavItem } from '@/components/AppSidebar';

export const CEO_BASE = '/ceo';

export const ceoNavItems: SidebarNavItem[] = [
  { kind: 'item', id: 'briefing', label: 'Morning Briefing', icon: Home, path: `${CEO_BASE}/briefing` },

  {
    kind: 'section',
    id: 'sec-sales',
    label: 'Sales Hub',
    icon: Briefcase,
    defaultOpen: true,
    children: [
      { kind: 'item', id: 'inventory', label: 'Lead Inventory', icon: List, path: `${CEO_BASE}/inventory` },
      { kind: 'item', id: 'realtor-queue', label: 'Realtor Lead Queue', icon: Users, path: `${CEO_BASE}/realtor-queue` },
      { kind: 'item', id: 'realtor-pipeline', label: 'Realtor Pipeline', icon: Building2, path: `${CEO_BASE}/realtor-pipeline` },
      { kind: 'item', id: 'realtor-scripts', label: 'Realtor Scripts', icon: MessageSquare, path: `${CEO_BASE}/realtor-scripts` },
      { kind: 'item', id: 'realtor-reports', label: 'Realtor Reports', icon: TrendingUp, path: `${CEO_BASE}/realtor-reports` },
    ],
  },

  {
    kind: 'section',
    id: 'sec-ops',
    label: 'Operations',
    icon: Activity,
    children: [
      { kind: 'item', id: 'pipeline', label: 'Active Pipeline', icon: Kanban, path: `${CEO_BASE}/pipeline` },
      { kind: 'item', id: 'speed', label: 'Speed-to-Lead', icon: Zap, path: `${CEO_BASE}/speed` },
      { kind: 'item', id: 'dialer', label: 'Mojo Dialer', icon: PhoneCall, path: `${CEO_BASE}/dialer` },
      { kind: 'item', id: 'team', label: 'Team Performance', icon: BarChart3, path: `${CEO_BASE}/team` },
    ],
  },

  {
    kind: 'section',
    id: 'sec-strategy',
    label: 'Strategy',
    icon: Sparkles,
    children: [
      { kind: 'item', id: 'roadmap', label: 'Roadmap & Previews', icon: Map, path: `${CEO_BASE}/roadmap` },
      { kind: 'item', id: 'presentation', label: 'Presentation', icon: Sparkles, path: `${CEO_BASE}/presentation` },
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
      { kind: 'item', id: 'users', label: 'User Management', icon: Users, path: `${CEO_BASE}/users` },
      { kind: 'item', id: 'integrations', label: 'Integrations', icon: Plug, path: `${CEO_BASE}/integrations` },
      { kind: 'item', id: 'data', label: 'Data Sources', icon: Database, path: `${CEO_BASE}/data` },
      { kind: 'item', id: 'settings', label: 'Settings', icon: Settings, path: `${CEO_BASE}/settings` },
    ],
  },
];

const previewLabels: Record<string, string> = {
  'ai-calls': 'AI Inbound Calls (Preview)',
  'ai-agents': 'AI Agents (Preview)',
};

export function findNavItemByPath(items: SidebarNavItem[], pathname: string): SidebarNavItem | null {
  for (const item of items) {
    if (item.kind === 'item' && item.path === pathname) return item;
    if (item.kind === 'section') {
      const nested = findNavItemByPath(item.children, pathname);
      if (nested) return nested;
    }
    if (item.kind === 'item' && item.children?.length) {
      const nested = findNavItemByPath(item.children, pathname);
      if (nested) return nested;
    }
  }
  return null;
}

export function getCeoPageTitle(pathname: string): string {
  const match = findNavItemByPath(ceoNavItems, pathname);
  if (match && match.kind === 'item') return match.label;

  if (pathname === `${CEO_BASE}/preview/ai-calls`) return previewLabels['ai-calls'];
  if (pathname === `${CEO_BASE}/preview/ai-agents`) return previewLabels['ai-agents'];

  return 'Dashboard';
}
