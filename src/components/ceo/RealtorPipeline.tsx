import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { realtorLeads, realtorPipelineStages, RealtorLead, RealtorLeadStatus } from '@/data/realtorLeads';
import { Building2, Phone, Calendar, Home, ExternalLink } from 'lucide-react';
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
  const [selected, setSelected] = useState<RealtorLead | null>(null);
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <SourceProvenance chips={[{ source: 'Zillow', count: t('realtorQueue.listingsCount', { count: realtorLeads.length }), lastSync: '12m ago', status: 'pending' }]} />
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
          const items = realtorLeads.filter(l => l.status === stage);
          return (
            <div key={stage} className="bg-muted/40 rounded-xl p-3 min-h-[400px]">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-2 py-1 rounded ${stageBadge[stage]}`}>{t(`realtorQueue.status.${stage === 'Closed Won' ? 'closedWon' : stage.toLowerCase()}`)}</span>
                <span className="text-xs font-bold text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => setSelected(lead)}
                    className={`w-full text-left bg-card border-l-4 ${stageColor[stage]} rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <p className="text-sm font-bold text-foreground truncate">{lead.agentName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{lead.brokerage}</p>
                    <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
                      <Home size={10} />
                      <span className="truncate">{lead.propertyAddress}, {lead.city}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px]">
                      <span className="text-foreground font-medium">${(lead.listPrice / 1000).toFixed(0)}k</span>
                      <span className="text-muted-foreground flex items-center gap-1"><Calendar size={10} /> {lead.daysOnMarket}d</span>
                    </div>
                    {lead.priceDrops.length > 0 && (
                      <span className="inline-block mt-1 text-[10px] text-speed">{t('realtorPipeline.priceDrops', { count: lead.priceDrops.length })}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && <RealtorLeadDetailDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
