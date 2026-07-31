import {
  Activity,
  BarChart3,
  Bot,
  Briefcase,
  Cpu,
  FileText,
  Home,
  Kanban,
  History,
  List,
  Map,
  MessageSquare,
  PhoneCall,
  ScrollText,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  RefreshCw,
  Gavel,
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
      { kind: 'item', id: 'auction-listings', label: 'Auction Listings', icon: Gavel, path: `${CEO_BASE}/auction-listings` },
      { kind: 'item', id: 'zillow-realtor-queue', label: 'Zillow Realtor Queue', icon: Users, path: `${CEO_BASE}/zillow-realtor-queue` },
      { kind: 'item', id: 'realtor-pipeline', label: 'Zillow Realtor Pipeline', icon: Kanban, path: `${CEO_BASE}/realtor-pipeline` },
      { kind: 'item', id: 'realtor-scripts', label: 'Realtor Scripts', icon: MessageSquare, path: `${CEO_BASE}/realtor-scripts` },
      { kind: 'item', id: 'realtor-reports', label: 'Realtor Reports', icon: TrendingUp, path: `${CEO_BASE}/realtor-reports` },
    ],
  },

  {
    kind: 'section',
    id: 'sec-sync',
    label: 'Data Sync',
    icon: RefreshCw,
    defaultOpen: true,
    children: [
      // { kind: 'item', id: 'sync-runs', label: 'Sync History', icon: History, path: `${CEO_BASE}/sync-runs` },
      { kind: 'item', id: 'zillow-apify-sync', label: 'Zillow Apify Sync', icon: RefreshCw, path: `${CEO_BASE}/zillow-apify-sync` },
      { kind: 'item', id: 'auction-apify-sync', label: 'Auction.com Sync', icon: RefreshCw, path: `${CEO_BASE}/auction-apify-sync` },
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
    id: 'sec-ai',
    label: 'AI & Automations',
    icon: Bot,
    children: [
      { kind: 'item', id: 'ai-agents', label: 'Agents', icon: Cpu, path: `${CEO_BASE}/ai/agents` },
      { kind: 'item', id: 'ai-logs', label: 'Logs & Monitor', icon: ScrollText, path: `${CEO_BASE}/ai/logs` },
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

  { kind: 'external', id: 'admin-console', label: 'Admin Console', icon: Settings, href: '/admin/integrations' },
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
  if (pathname === `${CEO_BASE}/ai/agents`) return 'Agents';
  if (pathname === `${CEO_BASE}/ai/logs`) return 'Logs & Monitor';

  return 'Dashboard';
}

export function getCeoNavItemId(pathname: string): string {
  const match = findNavItemByPath(ceoNavItems, pathname);
  if (match && match.kind === 'item') return match.id;

  if (pathname === `${CEO_BASE}/preview/ai-calls`) return 'ai-calls';
  if (pathname === `${CEO_BASE}/preview/ai-agents`) return 'ai-agents';
  if (pathname === `${CEO_BASE}/ai/agents`) return 'ai-agents';
  if (pathname === `${CEO_BASE}/ai/logs`) return 'ai-logs';
  if (pathname === `${CEO_BASE}/realtor-queue`) return 'realtor-queue';
  if (pathname === `${CEO_BASE}/realtor-pipeline`) return 'realtor-pipeline';

  return 'dashboard';
}
