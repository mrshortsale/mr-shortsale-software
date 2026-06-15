import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Plug, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { listIntegrations, type Integration, type IntegrationStatus } from '@/services/integrations';
import AddIntegrationModal from './AddIntegrationModal';
import IntegrationConfigPanel from './IntegrationConfigPanel';
import ApiUsageDashboard from './ApiUsageDashboard';
import CountySourcesSection from './CountySourcesSection';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; className: string }> = {
  connected: { label: 'Connected', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  disabled: { label: 'Disabled', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  error: { label: 'Error', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const CATEGORY_ICONS: Record<string, string> = {
  data: '📊',
  marketing: '📢',
  communications: '📞',
  auth: '🔐',
  custom: '🔧',
  ai: '🤖',
};

function StatusBadge({ status }: { status: IntegrationStatus | null }) {
  const { t } = useTranslation();
  if (!status) {
    return <Badge variant="outline" className="text-xs">{t('integrations.notConfigured')}</Badge>;
  }
  const config = {
    connected: { label: t('integrations.statusConnected'), className: STATUS_CONFIG.connected.className },
    disabled: { label: t('integrations.statusDisabled'), className: STATUS_CONFIG.disabled.className },
    error: { label: t('integrations.statusError'), className: STATUS_CONFIG.error.className },
  }[status];
  return <Badge className={`text-xs border-0 ${config.className}`}>{config.label}</Badge>;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showUsage, setShowUsage] = useState(false);
  const { t } = useTranslation();

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    const { integrations: data, error } = await listIntegrations();
    if (error) {
      toast.error(error);
    } else {
      setIntegrations(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const filtered = integrations.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.slug.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const connectedCount = integrations.filter((i) => i.credential_status === 'connected').length;

  if (selectedIntegration) {
    return (
      <IntegrationConfigPanel
        integration={selectedIntegration}
        onBack={() => {
          setSelectedIntegration(null);
          fetchIntegrations();
        }}
      />
    );
  }

  if (showUsage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowUsage(false)}>
            {t('integrations.backToIntegrations')}
          </Button>
        </div>
        <ApiUsageDashboard integrations={integrations} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('integrations.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('integrations.subtitle')}{' '}
              <span className="font-medium text-primary">{t('integrations.connectedCount', { count: connectedCount })}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowUsage(true)}>
            {t('integrations.apiUsage')}
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('integrations.add')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('integrations.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="mt-3 h-3 w-full rounded bg-muted" />
                <div className="mt-2 h-3 w-3/4 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((integration) => (
            <Card
              key={integration.id}
              className="group relative cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedIntegration(integration)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{CATEGORY_ICONS[integration.category] || '🔌'}</span>
                    <h3 className="font-semibold text-sm">{integration.name}</h3>
                  </div>
                  <StatusBadge status={integration.credential_status} />
                </div>

                <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
                  {integration.description || t('integrations.noDescription')}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIntegration(integration);
                    }}
                  >
                    {t('integrations.configure')}
                  </Button>
                  {integration.is_builtin && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('integrations.builtIn')}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Plug className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search ? t('integrations.noSearchResults') : t('integrations.empty')}
          </p>
        </div>
      )}

      <CountySourcesSection />

      {/* Refresh button */}
      <div className="flex justify-center pt-2">
        <Button variant="ghost" size="sm" onClick={fetchIntegrations} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('integrations.refresh')}
        </Button>
      </div>

      {/* Add Integration Modal */}
      <AddIntegrationModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => {
          setShowAddModal(false);
          fetchIntegrations();
        }}
      />
    </div>
  );
}
