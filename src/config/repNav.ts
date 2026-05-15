import { Activity, BarChart3, Briefcase, Building2, Clock, List } from 'lucide-react';
import type { SidebarNavItem } from '@/components/AppSidebar';

export const REP_BASE = '/rep';

export const repNavItems: SidebarNavItem[] = [
  {
    kind: 'section',
    id: 'sec-my-day',
    label: 'My Day',
    icon: Briefcase,
    defaultOpen: true,
    children: [
      { kind: 'item', id: 'queue', label: 'Foreclosure Queue', icon: List, path: `${REP_BASE}/queue` },
      { kind: 'item', id: 'realtor', label: 'Realtor Queue', icon: Building2, path: `${REP_BASE}/realtor` },
    ],
  },
  {
    kind: 'section',
    id: 'sec-activity',
    label: 'Activity',
    icon: Activity,
    defaultOpen: true,
    children: [
      { kind: 'item', id: 'history', label: 'Call History', icon: Clock, path: `${REP_BASE}/history` },
      { kind: 'item', id: 'stats', label: 'My Stats', icon: BarChart3, path: `${REP_BASE}/stats` },
    ],
  },
];

export function findNavItemByPath(items: SidebarNavItem[], pathname: string): SidebarNavItem | null {
  for (const item of items) {
    if (item.kind === 'item' && item.path === pathname) return item;
    if (item.kind === 'section') {
      const nested = findNavItemByPath(item.children, pathname);
      if (nested) return nested;
    }
  }
  return null;
}

export function getRepPageTitle(pathname: string): string {
  const match = findNavItemByPath(repNavItems, pathname);
  if (match && match.kind === 'item') return match.label;
  return 'Dashboard';
}
