import { useTranslation } from 'react-i18next';
import { Globe, Moon, Sun } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme } from '@/contexts/ThemeContext';

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-soft sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function CEOSettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('settings.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <SettingsSection
        icon={Globe}
        title={t('settings.language')}
        description={t('settings.languageDescription')}
      >
        <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t('settings.languageEn')}</SelectItem>
            <SelectItem value="es">{t('settings.languageEs')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSection>

      <SettingsSection
        icon={theme === 'dark' ? Moon : Sun}
        title={t('settings.theme')}
        description={t('settings.themeDescription')}
      >
        <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark')}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">{t('settings.themeLight')}</SelectItem>
            <SelectItem value="dark">{t('settings.themeDark')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSection>
    </div>
  );
}
