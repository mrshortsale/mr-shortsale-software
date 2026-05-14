import { useEffect, useMemo, useState } from 'react';
import { Brain, ChevronDown, ChevronRight, ExternalLink, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SidebarNavItem =
  | {
      kind: 'item';
      id: string;
      label: string;
      icon: LucideIcon;
      badge?: string;
      children?: SidebarNavItem[];
    }
  | {
      kind: 'external';
      id: string;
      label: string;
      icon: LucideIcon;
      href: string;
    }
  | {
      kind: 'section';
      id: string;
      label: string;
      icon?: LucideIcon;
      defaultOpen?: boolean;
      children: SidebarNavItem[];
    };

export interface AppSidebarProps {
  navItems: SidebarNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
  appName?: string;
  appSubLabel?: string;
  versionLabel?: string;
  versionSubLabel?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectAncestorIds(
  items: SidebarNavItem[],
  targetId: string,
  trail: string[] = [],
): string[] | null {
  for (const item of items) {
    if (item.kind === 'external') continue;
    if (item.kind === 'item' && item.id === targetId) return trail;
    if ('children' in item && item.children?.length) {
      const found = collectAncestorIds(item.children, targetId, [...trail, item.id]);
      if (found) return found;
    }
  }
  return null;
}

function collectDefaultOpen(items: SidebarNavItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.kind === 'section') {
      if (item.defaultOpen !== false) ids.push(item.id);
      ids.push(...collectDefaultOpen(item.children));
    } else if (item.kind === 'item' && item.children?.length) {
      ids.push(...collectDefaultOpen(item.children));
    }
  }
  return ids;
}

// ─── Section (collapsible group) ─────────────────────────────────────────────

interface SectionNodeProps {
  item: Extract<SidebarNavItem, { kind: 'section' }>;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  depth: number;
}

function SectionNode({
  item,
  expanded,
  toggleExpanded,
  activeId,
  onSelect,
  onClose,
  depth,
}: SectionNodeProps) {
  const isOpen = expanded.has(item.id);
  const Icon = item.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => toggleExpanded(item.id)}
        aria-expanded={isOpen}
        className={cn(
          'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors',
          'text-muted-foreground hover:text-sidebar-foreground',
        )}
      >
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
        <span className="flex-1 truncate text-left">{item.label}</span>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 opacity-70 transition-transform" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 opacity-70 transition-transform" />
        )}
      </button>

      {isOpen && (
        <ul className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <NavNode
              key={child.id}
              item={child}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              activeId={activeId}
              onSelect={onSelect}
              onClose={onClose}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Generic recursive nav node ─────────────────────────────────────────────

interface NavNodeProps {
  item: SidebarNavItem;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  depth: number;
}

function NavNode({
  item,
  expanded,
  toggleExpanded,
  activeId,
  onSelect,
  onClose,
  depth,
}: NavNodeProps) {
  if (item.kind === 'section') {
    return (
      <SectionNode
        item={item}
        expanded={expanded}
        toggleExpanded={toggleExpanded}
        activeId={activeId}
        onSelect={onSelect}
        onClose={onClose}
        depth={depth}
      />
    );
  }

  if (item.kind === 'external') {
    const Icon = item.icon;
    return (
      <li>
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'group flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/10 hover:text-sidebar-accent',
            depth === 0 ? 'px-3' : 'px-3 ml-2',
          )}
        >
          <Icon
            className={cn(
              'shrink-0',
              depth === 0 ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5',
            )}
          />
          <span className="flex-1 truncate">{item.label}</span>
          <ExternalLink className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
        </a>
      </li>
    );
  }

  // kind === 'item'
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const isOpen = expanded.has(item.id);
  const isActive = activeId === item.id;

  const handleClick = () => {
    if (hasChildren) {
      toggleExpanded(item.id);
    } else {
      onSelect(item.id);
      onClose();
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={hasChildren ? isOpen : undefined}
        className={cn(
          'group flex w-full items-center gap-3 rounded-lg text-sm font-medium transition-colors',
          depth === 0 ? 'px-3 py-2.5' : 'py-1.5 pr-3',
          depth === 0
            ? ''
            : depth === 1
              ? 'pl-7'
              : 'pl-11',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent',
        )}
      >
        <Icon
          className={cn(
            'shrink-0',
            depth === 0 ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5',
          )}
        />
        <span className="flex-1 truncate text-left">{item.label}</span>
        {item.badge ? (
          <span
            className={cn(
              'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
              isActive
                ? 'bg-sidebar-accent-foreground/15 text-sidebar-accent-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {item.badge}
          </span>
        ) : null}
        {hasChildren ? (
          isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 opacity-70" />
          )
        ) : null}
      </button>

      {hasChildren && isOpen && item.children ? (
        <ul className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <NavNode
              key={child.id}
              item={child}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              activeId={activeId}
              onSelect={onSelect}
              onClose={onClose}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// ─── Main sidebar ────────────────────────────────────────────────────────────

export default function AppSidebar({
  navItems,
  activeId,
  onSelect,
  open,
  onClose,
  appName = 'Mr. Short Sale',
  appSubLabel = 'AI Operations',
  versionLabel = 'Platform',
  versionSubLabel = 'v1.0.0 · Production',
}: AppSidebarProps) {
  const defaultOpenIds = useMemo(() => collectDefaultOpen(navItems), [navItems]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultOpenIds));

  // Ensure ancestors of the active item are auto-expanded when activeId changes
  useEffect(() => {
    const ancestors = collectAncestorIds(navItems, activeId);
    if (!ancestors || ancestors.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeId, navItems]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar-background transition-transform duration-200 ease-in-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo block */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Brain className="h-5 w-5" />
          </div>
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-sm font-semibold text-sidebar-foreground">{appName}</span>
            <span className="text-xs text-muted-foreground">{appSubLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav tree */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <NavNode
                key={item.id}
                item={item}
                expanded={expanded}
                toggleExpanded={toggleExpanded}
                activeId={activeId}
                onSelect={onSelect}
                onClose={onClose}
                depth={0}
              />
            ))}
          </ul>
        </nav>

        {/* Footer / version */}
        <div className="px-3 pb-4 pt-2">
          <div className="rounded-lg bg-sidebar-accent/10 px-4 py-3">
            <p className="text-xs font-semibold text-sidebar-foreground">{versionLabel}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{versionSubLabel}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
