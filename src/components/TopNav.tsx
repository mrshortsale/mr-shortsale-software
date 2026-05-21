import { Bell, LogOut, Menu, Moon, Search, Settings, Sun, User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface TopNavProps {
  onOpenSidebar: () => void;
  pageTitle?: string;
  pageMeta?: string;
}

export default function TopNav({ onOpenSidebar, pageTitle, pageMeta }: TopNavProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const roleLabel =
    user?.role === 'ceo'
      ? t('topNav.roleLabels.ceo')
      : t('topNav.roleLabels.rep');

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm lg:left-64 lg:px-6',
        'left-0',
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 lg:hidden"
        onClick={onOpenSidebar}
        aria-label={t('topNav.openMenu')}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Title + search */}
      <div className="flex flex-1 items-center gap-4">
        {pageTitle ? (
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-semibold text-foreground">{pageTitle}</span>
            {pageMeta ? (
              <span className="text-xs text-muted-foreground">{pageMeta}</span>
            ) : null}
          </div>
        ) : null}

        <div className="relative ml-auto w-full max-w-sm sm:ml-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('topNav.searchPlaceholder')}
            className="h-9 w-full border-transparent bg-muted/60 pl-9 text-sm placeholder:text-muted-foreground/70 focus-visible:border-border focus-visible:bg-background"
          />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9"
          aria-label={theme === 'light' ? t('topNav.switchToDark') : t('topNav.switchToLight')}
        >
          {theme === 'light' ? (
            <Moon className="h-[18px] w-[18px]" />
          ) : (
            <Sun className="h-[18px] w-[18px]" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={t('topNav.notifications')}
        >
          <Bell className="h-[18px] w-[18px]" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground sm:inline">
                {user?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium leading-none">{user?.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
              <span className="mt-1 text-[11px] font-medium text-primary">{roleLabel}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <UserIcon className="h-4 w-4" />
              <span>{t('topNav.profile')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" />
              <span>{t('topNav.settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>{t('topNav.signOut')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
