import { ArrowLeft, Database, Plug, Settings, Users } from 'lucide-react';
import type { SidebarNavItem } from '@/components/AppSidebar';

export const ADMIN_BASE = '/admin';

export const adminNavItems: SidebarNavItem[] = [
  { kind: 'item', id: 'users', label: 'User Management', icon: Users, path: `${ADMIN_BASE}/users` },
  { kind: 'item', id: 'integrations', label: 'Integrations', icon: Plug, path: `${ADMIN_BASE}/integrations` },
  { kind: 'item', id: 'data', label: 'Data Sources', icon: Database, path: `${ADMIN_BASE}/data` },
  { kind: 'item', id: 'settings', label: 'Settings', icon: Settings, path: `${ADMIN_BASE}/settings` },
  { kind: 'external', id: 'back-ceo', label: 'Back to CEO Console', icon: ArrowLeft, href: '/ceo/briefing' },
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

export function getAdminNavItemId(pathname: string): string {
  const match = findNavItemByPath(adminNavItems, pathname);
  if (match && match.kind === 'item') return match.id;
  return 'dashboard';
}
