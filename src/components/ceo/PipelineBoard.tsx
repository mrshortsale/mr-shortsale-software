import { pipelineCases, PipelineStage } from '@/data/pipeline';
import { useState } from 'react';
import { Calendar, User, ArrowRightCircle } from 'lucide-react';
import CaseDetailDrawer from './CaseDetailDrawer';
import { getCaseDetails } from '@/data/caseDetails';
import SourceProvenance from '@/components/shared/SourceProvenance';

const stages: PipelineStage[] = ['Initial Contact', 'Docs Collected', 'Bank Submitted', 'Pending Approval'];
const stageColors: Record<PipelineStage, string> = {
  'Initial Contact': 'border-t-secondary',
  'Docs Collected': 'border-t-accent',
  'Bank Submitted': 'border-t-warning',
  'Pending Approval': 'border-t-primary',
};

export default function PipelineBoard() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pipelineCases.find(c => c.id === selectedId) || null;

  return (
    <div className="space-y-4">
      <SourceProvenance
        chips={[
          { source: 'Batch', count: '34,812', lastSync: '2h ago', status: 'pending' },
          { source: 'Zillow', count: '1,420', lastSync: '12m ago', status: 'pending' },
        ]}
      />
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold text-foreground">Active Pipeline</span>
        <span className="text-muted-foreground">12 active cases · 0 denials · avg close 67d</span>
        <span className="ml-auto inline-flex items-center gap-1 text-accent font-bold">
          <ArrowRightCircle size={12} /> 3 promoted from Inventory today
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stages.map(stage => (
          <div key={stage}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">{stage}</h3>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {pipelineCases.filter(c => c.stage === stage).length}
              </span>
            </div>
            <div className="space-y-3">
              {pipelineCases.filter(c => c.stage === stage).map(c => {
                const d = getCaseDetails(c.id);
                const docPct = Math.round((d.documents.filter(x => x.done).length / d.documents.length) * 100);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left metric-card border-t-4 ${stageColors[stage]} hover:shadow-md transition-shadow`}
                  >
                    <p className="font-semibold text-sm text-foreground">{c.homeowner}</p>
                    <p className="text-xs text-muted-foreground mt-1">{c.address}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar size={12} />{c.auction_date}</span>
                      <span className={`px-1.5 py-0.5 rounded ${c.equity_pct <= 15 ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>{c.equity_pct}%</span>
                    </div>
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>Docs {docPct}%</span>
                        <span>{d.days_in_stage}d in stage</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${docPct}%` }} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2"><User size={10} className="inline mr-1" />{c.agent_name} · {c.bank}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">0 denials to date · 12 active cases · avg. close 67 days · Click any card for full case detail</p>

      <CaseDetailDrawer
        caseData={selected}
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </div>
  );
}
