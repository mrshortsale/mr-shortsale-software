import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Agent } from '@/data/agents';
import { aiActivityFeed } from '@/data/activity';
import { Activity, Zap, CheckCircle2, ArrowRight } from 'lucide-react';

interface Props {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusStyle: Record<string, string> = {
  active: 'bg-accent text-accent-foreground',
  working: 'bg-secondary text-secondary-foreground',
  idle: 'bg-muted text-muted-foreground',
};

export default function AgentActivityDrawer({ agent, open, onOpenChange }: Props) {
  if (!agent) return null;
  const Icon = agent.icon;

  // Filter activity feed by this agent's sources, fallback to first 8
  const filtered = aiActivityFeed.filter(a => agent.activitySources.includes(a.source));
  const log = (filtered.length >= 6 ? filtered : aiActivityFeed).slice(0, 15);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto p-0">
        {/* Header strip */}
        <div className={`bg-gradient-to-br ${agent.gradient} p-6 text-primary-foreground`}>
          <SheetHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-card/20 backdrop-blur flex items-center justify-center text-2xl">
                {agent.emoji}
              </div>
              <div className="text-left">
                <SheetTitle className="text-primary-foreground text-2xl flex items-center gap-2">
                  {agent.name}
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${statusStyle[agent.status]}`}>
                    {agent.status}
                  </span>
                </SheetTitle>
                <p className="text-sm opacity-90">{agent.role}</p>
              </div>
            </div>
            <p className="text-sm opacity-95 text-left leading-relaxed">{agent.shortDescription}</p>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* What I do */}
          <section>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Icon size={12} /> What I do
            </h4>
            <ul className="space-y-2">
              {agent.longDescription.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 size={14} className="text-accent mt-0.5 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Powered by */}
          <section>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Powered by</h4>
            <div className="flex flex-wrap gap-1.5">
              {agent.stack.map(s => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </section>

          {/* This week's impact */}
          <section>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">This week's impact</h4>
            <div className="grid grid-cols-3 gap-3">
              <ImpactStat label="Hours saved" value={agent.weeklyImpact.hoursSaved} />
              <ImpactStat label="Actions" value={agent.weeklyImpact.actions} />
              <ImpactStat label="Accuracy" value={agent.weeklyImpact.accuracy} />
            </div>
          </section>

          {/* Live activity log */}
          <section>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity size={12} className="text-accent" /> Recent activity
            </h4>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {log.map((a, i) => (
                <div key={a.id + i} className="flex items-start gap-2 text-xs p-2 rounded-md bg-muted/40 hover:bg-muted/70">
                  <span className="font-bold text-secondary shrink-0 font-mono">{a.source}</span>
                  <span className="text-foreground flex-1">{a.message}</span>
                  <span className="text-muted-foreground shrink-0">{a.ts}</span>
                </div>
              ))}
            </div>
          </section>

          {/* How it integrates */}
          <section className="bg-muted/40 rounded-lg p-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap size={12} /> How it integrates
            </h4>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground flex-wrap">
              {agent.flow.split('→').map((step, i, arr) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-card border text-xs">{step.trim()}</span>
                  {i < arr.length - 1 && <ArrowRight size={12} className="text-muted-foreground" />}
                </span>
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ImpactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
