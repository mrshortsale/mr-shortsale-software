import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { realtorPipelineStages, RealtorLeadStatus, realtorLeads as mockLeads } from '@/data/realtorLeads';
import { fetchRealtorLeads, type RealtorAgent } from '@/services/realtor';
import { Building2, Calendar, Home } from 'lucide-react';
import RealtorLeadDetailDrawer from '@/components/shared/RealtorLeadDetailDrawer';
import SourceProvenance from '@/components/shared/SourceProvenance';

const stageColor: Record<RealtorLeadStatus, string> = {
  'New':         'border-l-secondary',
  'Contacted':   'border-l-speed',
  'Partnered':   'border-l-accent',
  'Closed Won':  'border-l-accent',
  'Declined':    'border-l-muted-foreground',
};

const stageBadge: Record<RealtorLeadStatus, string> = {
  'New':         'bg-secondary/10 text-secondary',
  'Contacted':   'bg-speed/15 text-speed',
  'Partnered':   'bg-accent/15 text-accent',
  'Closed Won':  'bg-accent text-accent-foreground',
  'Declined':    'bg-muted text-muted-foreground',
};

export default function RealtorPipeline() {
  const [agents, setAgents] = useState<RealtorAgent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [drawerAgent, setDrawerAgent] = useState<RealtorAgent | null>(null);
  const { t } = useTranslation();

  const load = useCallback(async () => {
    const { leads, total, error } = await fetchRealtorLeads({ limit: 200 });
    if (error || leads.length === 0) {
      // Map mock leads to minimal RealtorAgent shape for pipeline display
      const mapped = mockLeads.map(l => ({
        id: l.id, profileId: '', datasetId: 'mock', externalId: l.id,
        listAgentKey: null, agentName: l.agentName, brokerage: l.brokerage,
        agentPhone: l.agentPhone, agentEmail: l.agentEmail,
        language: l.language as 'EN' | 'ES', listingCount: l.priceDrops.length + 1,
        latestListingId: l.mlsNumber, latestPropertyAddress: l.propertyAddress,
        latestCity: l.city, latestState: l.state, latestListPrice: l.listPrice,
        latestDaysOnMarket: l.daysOnMarket, latestPublicRemarks: '',
        status: l.status as RealtorLeadStatus, lastContactAt: l.lastContactAt,
        notes: l.notes ?? null, createdAt: '', updatedAt: '',
      }) as RealtorAgent);
      setAgents(mapped);
      setTotalCount(mockLeads.length);
    } else {
      setAgents(leads);
      setTotalCount(total);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <SourceProvenance chips={[{ source: 'Bridge MLS', count: t('realtorQueue.listingsCount', { count: totalCount }), lastSync: 'live', status: totalCount > 0 ? 'connected' : 'pending' }]} />
      <div className="rounded-xl bg-gradient-to-r from-secondary/10 to-accent/10 border border-secondary/20 p-4">
        <div className="flex items-start gap-3">
          <Building2 className="text-secondary mt-0.5" size={20} />
          <div>
            <h3 className="font-bold text-foreground">{t('realtorPipeline.chainTitle')}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('realtorPipeline.chainDescription')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {realtorPipelineStages.map(stage => {
          const items = agents.filter(a => a.status === stage);
          return (
            <div key={stage} className="bg-muted/40 rounded-xl p-3 min-h-[400px]">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-2 py-1 rounded ${stageBadge[stage]}`}>{t(`realtorQueue.status.${stage === 'Closed Won' ? 'closedWon' : stage.toLowerCase()}`)}</span>
                <span className="text-xs font-bold text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setDrawerAgent(agent)}
                    className={`w-full text-left bg-card border-l-4 ${stageColor[stage]} rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <p className="text-sm font-bold text-foreground truncate">{agent.agentName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{agent.brokerage}</p>
                    <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
                      <Home size={10} />
                      <span className="truncate">{agent.latestPropertyAddress}, {agent.latestCity}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px]">
                      <span className="text-foreground font-medium">${(agent.latestListPrice / 1000).toFixed(0)}k</span>
                      <span className="text-muted-foreground flex items-center gap-1"><Calendar size={10} /> {agent.latestDaysOnMarket}d</span>
                    </div>
                    {agent.listingCount > 1 && (
                      <span className="inline-block mt-1 text-[10px] text-speed">{t('realtorPipeline.priceDrops', { count: agent.listingCount - 1 })}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <RealtorLeadDetailDrawer
        agent={drawerAgent ?? ({} as RealtorAgent)}
        open={!!drawerAgent}
        onOpenChange={(open) => { if (!open) setDrawerAgent(null); }}
      />
    </div>
  );
}
