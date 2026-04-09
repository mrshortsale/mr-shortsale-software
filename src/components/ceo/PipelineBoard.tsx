import { pipelineCases, PipelineStage } from '@/data/pipeline';
import { useState } from 'react';
import { Calendar, User, Building, X } from 'lucide-react';

const stages: PipelineStage[] = ['Initial Contact', 'Docs Collected', 'Bank Submitted', 'Pending Approval'];
const stageColors: Record<PipelineStage, string> = {
  'Initial Contact': 'border-t-secondary',
  'Docs Collected': 'border-t-accent',
  'Bank Submitted': 'border-t-warning',
  'Pending Approval': 'border-t-primary',
};

export default function PipelineBoard() {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const selected = pipelineCases.find(c => c.id === selectedCase);

  return (
    <div className="relative">
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
              {pipelineCases.filter(c => c.stage === stage).map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCase(c.id)}
                  className={`w-full text-left metric-card border-t-4 ${stageColors[stage]} hover:shadow-md transition-shadow`}
                >
                  <p className="font-semibold text-sm text-foreground">{c.homeowner}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.address}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar size={12} />{c.auction_date}</span>
                    <span className={`px-1.5 py-0.5 rounded ${c.equity_pct <= 15 ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>{c.equity_pct}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2"><User size={10} className="inline mr-1" />{c.agent_name}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">0 denials to date · 12 active cases · avg. close 67 days</p>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedCase(null)}>
          <div className="absolute inset-0 bg-foreground/30" />
          <div className="relative w-full max-w-md bg-card shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selected.homeowner}</h2>
                  <p className="text-sm text-muted-foreground">{selected.address}</p>
                </div>
                <button onClick={() => setSelectedCase(null)}><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <InfoRow label="Stage" value={selected.stage} />
                <InfoRow label="Auction Date" value={selected.auction_date} />
                <InfoRow label="Equity" value={`${selected.equity_pct}%`} />
                <InfoRow label="Bank" value={selected.bank} />
                <InfoRow label="Attorney" value={selected.attorney} />
                <InfoRow label="Agent" value={selected.agent_name} />
                {selected.submission_date && <InfoRow label="Submitted" value={selected.submission_date} />}
                {selected.expected_close && <InfoRow label="Expected Close" value={selected.expected_close} />}
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-foreground mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{selected.notes}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
